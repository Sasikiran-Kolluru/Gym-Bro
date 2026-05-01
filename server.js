const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname)); // serve static files (HTML, CSS, JS)

const DB_FILE = path.join(__dirname, 'database.json');

// Helper to read DB
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { users: [], checkins: [], exercises: [] };
  }
}

// Helper to write DB
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Routes
// ---------------------------
// Users (Login/Members)
// ---------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const db = readDB();
  let user = db.users.find(u => u.username === username);
  
  if (password === 'admin') {
    if (!user) {
      user = { id: Date.now().toString(), username, role: 'admin' };
      db.users.push(user);
      writeDB(db);
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Username taken by a member.' });
    }
  } else if (password === 'gym') {
    if (!user) {
      user = { id: Date.now().toString(), username, role: 'member' };
      db.users.push(user);
      writeDB(db);
    } else if (user.role !== 'member') {
      return res.status(403).json({ error: 'Username taken by an admin.' });
    }
  } else {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json(user);
});

app.get('/api/users', (req, res) => {
  const db = readDB();
  res.json(db.users);
});

app.post('/api/users', (req, res) => {
  const { username } = req.body;
  const db = readDB();
  
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const user = { id: Date.now().toString(), username, role: 'member' };
  db.users.push(user);
  writeDB(db);
  res.json(user);
});

// ---------------------------
// Checkins
// ---------------------------
app.get('/api/checkins', (req, res) => {
  const db = readDB();
  res.json(db.checkins);
});

app.post('/api/checkins', (req, res) => {
  const { userId, date } = req.body;
  const db = readDB();
  
  const existingIdx = db.checkins.findIndex(c => c.userId === userId && c.date === date);
  
  if (existingIdx >= 0) {
    db.checkins.splice(existingIdx, 1);
    writeDB(db);
    res.json({ checkedIn: false });
  } else {
    const checkin = { id: Date.now().toString(), userId, date };
    db.checkins.push(checkin);
    writeDB(db);
    res.json({ checkedIn: true, checkin });
  }
});

// ---------------------------
// Exercises
// ---------------------------
app.get('/api/exercises', (req, res) => {
  const db = readDB();
  res.json(db.exercises);
});

app.post('/api/exercises', (req, res) => {
  const { dayIdx, name } = req.body;
  const db = readDB();
  
  const exercise = { id: Date.now().toString(), dayIdx, name };
  db.exercises.push(exercise);
  writeDB(db);
  
  res.json(exercise);
});

app.delete('/api/exercises/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  
  db.exercises = db.exercises.filter(e => e.id !== id);
  writeDB(db);
  
  res.json({ success: true });
});

// Serve frontend if not matching API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
