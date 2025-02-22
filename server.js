import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
app.use(cors());
app.use(express.json());

// Connect to SQLite Database
const dbPromise = open({
  filename: "./database.db",
  driver: sqlite3.Database,
});

(async () => {
  const db = await dbPromise;
  await db.run(
    "CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, deviceId TEXT, activity TEXT, timestamp TEXT)"
  );
})();

// 📌 API to log an activity for a specific deviceId
app.post("/logs", async (req, res) => {
  const { deviceId, activity, timestamp } = req.body;
  if (!deviceId || !activity) {
    return res.status(400).json({ error: "Missing deviceId or activity" });
  }

  const db = await dbPromise;
  await db.run("INSERT INTO logs (deviceId, activity, timestamp) VALUES (?, ?, ?)", [
    deviceId,
    activity,
    timestamp,
  ]);

  res.json({ success: true, message: "Activity logged successfully" });
});

// 📌 API to fetch logs for a specific deviceId
app.get("/logs/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  const db = await dbPromise;

  const logs = await db.all("SELECT * FROM logs WHERE deviceId = ?", [deviceId]);
  res.json(logs);
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
