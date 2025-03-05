const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

require("dotenv").config();

// Add error logging to verify environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', decoded.username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
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

    // Check if username exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: "Username exists" });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{
        username,
        password: hashedPass,
        is_admin: false
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET);
    res.json({ 
      token,
      username: user.username,
      isAdmin: user.is_admin
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/logs", authenticate, async (req, res) => {
  try {
    const { activity } = req.body;
    if (!activity) return res.status(400).json({ error: "Missing activity" });

    const { error } = await supabase
      .from('logs')
      .insert([{
        username: req.user.username,
        activity,
        timestamp: new Date().toISOString()
      }]);

    if (error) throw error;
    res.json({ message: "Activity logged" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/logs/user/:username", authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (username !== req.user.username && !req.user.is_admin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .eq('username', username)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/admin/logs", authenticate, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Quick tasks endpoints
app.get("/quick-tasks", authenticate, async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('quick_tasks')
      .select('*')
      .eq('username', req.user.username);

    if (error) throw error;
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/quick-tasks", authenticate, async (req, res) => {
  try {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Missing task" });

    const { error } = await supabase
      .from('quick_tasks')
      .insert([{
        username: req.user.username,
        task
      }]);

    if (error) throw error;
    res.json({ message: "Task added" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/quick-tasks/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: task } = await supabase
      .from('quick_tasks')
      .select('username')
      .eq('id', id)
      .single();

    if (!task || task.username !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { error } = await supabase
      .from('quick_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
