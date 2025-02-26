const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS to allow frontend to call backend
app.use(cors());
app.use(express.json()); // Ensure the server can handle JSON requests

// Connect to SQLite database
let dbPromise = open({
    filename: "database.sqlite",
    driver: sqlite3.Database
});

async function initDB() {
    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deviceId TEXT NOT NULL,
            activity TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    `);
    console.log("Database initialized ✅");
}
initDB();

// POST route to log activity
app.post("/logs", async (req, res) => {
    const { deviceId, activity, timestamp } = req.body;

    if (!deviceId || !activity || !timestamp) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const db = await dbPromise;
        await db.run(
            "INSERT INTO logs (deviceId, activity, timestamp) VALUES (?, ?, ?)", 
            [deviceId, activity, timestamp]
        );

        res.json({ message: "Activity logged successfully" });
    } catch (err) {
        console.error("Error saving log:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET route to fetch logs for a specific device
app.get("/logs/:deviceId", async (req, res) => {
    const { deviceId } = req.params;

    try {
        const db = await dbPromise;
        const logs = await db.all("SELECT * FROM logs WHERE deviceId = ?", [deviceId]);

        res.json({ logs });
    } catch (err) {
        console.error("Error retrieving logs:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start the server
app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    await initDB(); // Ensure DB is initialized when the server starts
});
