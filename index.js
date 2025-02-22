const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Connect to SQLite
const db = new sqlite3.Database("./activity_logs.db", (err) => {
  if (err) console.error("Database Error: ", err.message);
  else console.log("Connected to SQLite database.");
});

// Create Table
db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    activity TEXT
  )
`);

// API to log an activity
app.post("/log", (req, res) => {
  const { activity } = req.body;
  if (!activity) return res.status(400).json({ error: "Activity is required" });

  const timestamp = new Date().toISOString();
  db.run("INSERT INTO logs (timestamp, activity) VALUES (?, ?)", [timestamp, activity], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ message: "Logged successfully!" });
  });
});

// API to get all logs
app.get("/logs", (req, res) => {
  db.all("SELECT * FROM logs", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
