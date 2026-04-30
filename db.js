const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS checkins (
        userId INTEGER NOT NULL,
        dateStr TEXT NOT NULL,
        PRIMARY KEY (userId, dateStr),
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dayIdx INTEGER NOT NULL,
        name TEXT NOT NULL
      )
    `);
  });
}

function getUser(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getMembers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM users WHERE role = ?', ['member'], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function createUser(username, role) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (username, role) VALUES (?, ?)', [username, role], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, username, role });
    });
  });
}

function getCheckinsForToday(dateStr) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM checkins WHERE dateStr = ?', [dateStr], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getCheckinsByUser(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM checkins WHERE userId = ?', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.dateStr));
    });
  });
}

function addCheckin(userId, dateStr) {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO checkins (userId, dateStr) VALUES (?, ?)', [userId, dateStr], function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function removeCheckin(userId, dateStr) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM checkins WHERE userId = ? AND dateStr = ?', [userId, dateStr], function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function getExercises() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM exercises', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addExercise(dayIdx, name) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO exercises (dayIdx, name) VALUES (?, ?)', [dayIdx, name], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, dayIdx, name });
    });
  });
}

function removeExercise(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM exercises WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

module.exports = {
  initDb,
  getUser,
  createUser,
  getMembers,
  getCheckinsForToday,
  getCheckinsByUser,
  addCheckin,
  removeCheckin,
  getExercises,
  addExercise,
  removeExercise
};
