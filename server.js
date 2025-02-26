const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000; // Use Render's PORT or default to 10000

app.use(express.json());
app.use(cors());

// Connect to SQLite database
const dbPromise = open({
    filename: "./database.sqlite",
    driver: sqlite3.Database
});

// API to log activity
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

// API to fetch logs for a specific device
app.get("/logs/:deviceId", async (req, res) => {
    const { deviceId } = req.params;
    try {
        const db = await dbPromise;
        const logs = await db.all("SELECT * FROM logs WHERE deviceId = ?", [deviceId]);
        res.json(logs);
    } catch (err) {
        console.error("Error fetching logs:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
