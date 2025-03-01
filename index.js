const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;

// Database initialization
async function initializeDB() {
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      activity TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(username) REFERENCES users(username)
    );
  `);

  // Create default admin if none exists
  const adminExists = await db.get(
    "SELECT 1 FROM users WHERE username = 'admin'"
  );
  if (!adminExists) {
    const hashedPass = await bcrypt.hash("admin123", 10);
    await db.run(
      "INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)",
      ["admin", hashedPass]
    );
    console.log("Default admin created: admin/admin123");
  }

  return db;
}

// Initialize app
async function initializeApp() {
  const db = await initializeDB();
  
  app.use(cors());
  app.use(express.json());

  // Authentication middleware
  const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await db.get("SELECT * FROM users WHERE id = ?", [decoded.id]);
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Routes
  app.post("/auth/signup", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Missing credentials" });
      }

      const hashedPass = await bcrypt.hash(password, 10);
      await db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPass]
      );
      res.status(201).json({ message: "User created" });
    } catch (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "Username exists" });
      }
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id }, JWT_SECRET);
      res.json({ 
        token,
        username: user.username,
        isAdmin: Boolean(user.is_admin)
      });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/logs", authenticate, async (req, res) => {
    try {
      const { activity } = req.body;
      if (!activity) return res.status(400).json({ error: "Missing activity" });

      await db.run(
        "INSERT INTO logs (username, activity) VALUES (?, ?)",
        [req.user.username, activity]
      );
      res.json({ message: "Activity logged" });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/logs", authenticate, async (req, res) => {
    try {
      const logs = await db.all(
        "SELECT * FROM logs WHERE username = ?",
        [req.user.username]
      );
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/admin/logs", authenticate, async (req, res) => {
    try {
      if (!req.user.is_admin) return res.status(403).json({ error: "Forbidden" });
      
      const logs = await db.all("SELECT * FROM logs");
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

initializeApp().catch(err => {
  console.error("Failed to initialize app:", err);
  process.exit(1);
});
