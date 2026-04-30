const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

db.initDb();

// Passwords
const ADMIN_PASSWORD = "admin";
const MEMBER_PASSWORD = "gym";

// Helper for today
function getTodayStr() {
  return new Date().toDateString();
}

// 1. LOGIN endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  if (password === ADMIN_PASSWORD) {
    let user = await db.getUser(username);
    if (!user) {
      user = await db.createUser(username, 'admin');
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Username taken by a member.' });
    }
    return res.json({ user });
  } 
  
  if (password === MEMBER_PASSWORD) {
    let user = await db.getUser(username);
    if (!user) {
      // Auto-add new members if they use the correct general password
      user = await db.createUser(username, 'member');
    } else if (user.role !== 'member') {
      return res.status(403).json({ error: 'Username taken by an admin.' });
    }
    return res.json({ user });
  }

  return res.status(401).json({ error: 'Invalid password' });
});

// 2. GET TEAM STATUS endpoint
app.get('/api/team', async (req, res) => {
  try {
    const members = await db.getMembers();
    const today = getTodayStr();
    const checkins = await db.getCheckinsForToday(today);
    
    // Create a set of userIds checked in today
    const checkedInUserIds = new Set(checkins.map(c => c.userId));
    
    const teamStatus = members.map(m => ({
      id: m.id,
      name: m.username,
      checkedIn: checkedInUserIds.has(m.id) ? today : null
    }));

    res.json(teamStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ADMIN ADD MEMBER endpoint
app.post('/api/admin/members', async (req, res) => {
  const { adminId, newUsername } = req.body;
  // In a real app we'd verify adminId role via token, here we just trust it for simplicity
  if (!newUsername) return res.status(400).json({ error: 'Missing username' });

  try {
    let existing = await db.getUser(newUsername);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const newUser = await db.createUser(newUsername, 'member');
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CHECK-IN endpoint
app.post('/api/checkin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const today = getTodayStr();

  try {
    const checkins = await db.getCheckinsForToday(today);
    const isCheckedIn = checkins.some(c => c.userId === userId);

    if (isCheckedIn) {
      await db.removeCheckin(userId, today);
      res.json({ status: 'removed', checkedInDate: null });
    } else {
      await db.addCheckin(userId, today);
      res.json({ status: 'added', checkedInDate: today });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET USER HISTORY endpoint
app.get('/api/workout/history', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const history = await db.getCheckinsByUser(userId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. EXERCISES ENDPOINTS
app.get('/api/exercises', async (req, res) => {
  try {
    const exercises = await db.getExercises();
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exercises', async (req, res) => {
  const { dayIdx, name } = req.body;
  if (dayIdx === undefined || !name) return res.status(400).json({ error: 'Missing dayIdx or name' });

  try {
    const exercise = await db.addExercise(dayIdx, name);
    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/exercises/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.removeExercise(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
