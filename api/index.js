const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (Serverless-friendly)
let cachedDb = null;

// Disable buffering globally so errors are thrown immediately if connection fails
mongoose.set('bufferCommands', false);

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI is not set in environment variables. Defaulting to localhost.");
  }
  const uri = MONGODB_URI || 'mongodb://localhost:27017/gym-bro';
  
  const db = await mongoose.connect(uri, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
  });
  cachedDb = db;
  return db;
}

// Ensure DB is connected before any route
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Database connection failed:', err);
    res.status(500).json({ 
      error: `Database Error: ${err.message}. Please check your MONGODB_URI format, password, and MongoDB Atlas Network Access.` 
    });
  }
});

// Schemas & Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' }
});
const User = mongoose.model('User', userSchema);

const checkinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }
});
const Checkin = mongoose.model('Checkin', checkinSchema);

const exerciseSchema = new mongoose.Schema({
  dayIdx: { type: Number, required: true },
  name: { type: String, required: true }
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Routes
// ---------------------------
// Users (Login/Members)
// ---------------------------
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    let user = await User.findOne({ username });
    
    if (password === 'admin') {
      if (!user) {
        user = await User.create({ username, role: 'admin' });
      } else if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Username taken by a member.' });
      }
    } else if (password === 'gym') {
      if (!user) {
        user = await User.create({ username, role: 'member' });
      } else if (user.role !== 'member') {
        return res.status(403).json({ error: 'Username taken by an admin.' });
      }
    } else {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const user = await User.create({ username, role: 'member' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------
// Checkins
// ---------------------------
app.get('/api/checkins', async (req, res) => {
  try {
    const checkins = await Checkin.find();
    res.json(checkins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkins', async (req, res) => {
  try {
    const { userId, date } = req.body;
    let checkin = await Checkin.findOne({ userId, date });
    
    if (checkin) {
      await Checkin.findByIdAndDelete(checkin._id);
      res.json({ checkedIn: false });
    } else {
      checkin = await Checkin.create({ userId, date });
      res.json({ checkedIn: true, checkin });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------
// Exercises
// ---------------------------
app.get('/api/exercises', async (req, res) => {
  try {
    const exercises = await Exercise.find();
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exercises', async (req, res) => {
  try {
    const { dayIdx, name } = req.body;
    const exercise = await Exercise.create({ dayIdx, name });
    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/exercises/:id', async (req, res) => {
  try {
    await Exercise.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
