// GLOBAL CONSTANTS
const CURRENT_USER_KEY = 'user';

// Helpers
function getSavedUser() {
  const user = localStorage.getItem(CURRENT_USER_KEY);
  return user ? JSON.parse(user) : null;
}

function getTodayStr() {
  return new Date().toDateString();
}

// ---------------------------
// INDEX PAGE LOGIC (LOGIN)
// ---------------------------
function openLogin() {
  const panel = document.getElementById("loginPanel");
  if (panel) panel.classList.add("active");
}

function closeLogin() {
  const panel = document.getElementById("loginPanel");
  if (panel) panel.classList.remove("active");
}

async function handleLogin() {
  const nameInput = document.getElementById("nameInput");
  const passInput = document.getElementById("passwordInput");
  
  if (!nameInput || !passInput) return;
  
  const username = nameInput.value.trim();
  const password = passInput.value.trim();

  if (!username || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Login failed");
      return;
    }
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
    window.location.href = "team.html";
  } catch (err) {
    alert("Error connecting to server");
  }
}

// ---------------------------
// TEAM PAGE LOGIC
// ---------------------------
if (window.location.pathname.endsWith('team.html')) {
  document.addEventListener("DOMContentLoaded", renderTeam);
}

async function renderTeam() {
  const user = getSavedUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  
  // Handle admin UI
  const addForm = document.querySelector(".add-member-form");
  if (addForm) {
    addForm.style.display = (user.role === 'admin') ? 'flex' : 'none';
  }

  try {
    const [usersRes, checkinsRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/checkins')
    ]);
    
    const members = await usersRes.json();
    const allCheckins = await checkinsRes.json();
    
    const today = getTodayStr();
    const todayCheckins = allCheckins.filter(c => c.date === today);
    const checkedInUserIds = new Set(todayCheckins.map(c => c.userId));

    const list = document.getElementById("membersList");
    if (!list) return;

    list.innerHTML = "";
    
    let myStatus = null;
    
    members.forEach(member => {
      // MongoDB IDs are returned as strings in ._id
      if (member._id === user._id) myStatus = checkedInUserIds.has(member._id) ? today : null;
      
      const isCheckedIn = checkedInUserIds.has(member._id);
      list.innerHTML += `
        <div class="member">
          <span>${member.username} ${member._id === user._id ? '(You)' : ''}</span>
          <div class="dot ${isCheckedIn ? 'green' : 'red'}"></div>
        </div>
      `;
    });

    const btn = document.querySelector(".check-btn");
    const statusText = document.getElementById("statusText");
    if (myStatus) {
      btn.textContent = "CHECKED IN";
      btn.style.background = "#4caf50";
      if (statusText) statusText.textContent = "✔ Checked In Today";
    } else {
      btn.textContent = "CHECK IN";
      btn.style.background = "#ff5252";
      if (statusText) statusText.textContent = "Tap to Check In";
    }
  } catch (err) {
    console.error("Error rendering team:", err);
  }
}

async function checkIn() {
  const user = getSavedUser();
  if (!user) return;

  const today = getTodayStr();
  try {
    await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user._id, date: today })
    });
    renderTeam();
  } catch (err) {
    console.error("Error checking in:", err);
  }
}

async function addMember() {
  const user = getSavedUser();
  if (!user || user.role !== 'admin') {
    alert("Only admins can add members directly.");
    return;
  }

  const nameInput = document.getElementById("newMemberName");
  if (!nameInput) return;
  const newUsername = nameInput.value.trim();
  if (!newUsername) return;

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Error adding user");
      return;
    }
    
    nameInput.value = "";
    renderTeam();
  } catch (err) {
    console.error("Error adding member:", err);
  }
}

// ---------------------------
// WORKOUT PAGE LOGIC
// ---------------------------
if (window.location.pathname.endsWith('workout.html')) {
  document.addEventListener("DOMContentLoaded", renderWorkout);
}

let activeDayIdx = (new Date().getDay() + 5) % 6; // Default to today

async function renderWorkout() {
  const user = getSavedUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const workouts = ["Pull", "Push", "Legs", "Pull", "Push", "Legs"];
  
  const todayLabel = document.getElementById("todayWorkoutLabel");
  if (todayLabel) {
    todayLabel.textContent = `Viewing Day ${activeDayIdx + 1}: ${workouts[activeDayIdx]}`;
  }
  
  const grid = document.getElementById("workoutGrid");
  if (grid) {
    grid.innerHTML = "";
    workouts.forEach((w, idx) => {
      grid.innerHTML += `
        <div class="workout-card ${idx === activeDayIdx ? 'active' : ''}" onclick="selectDay(${idx})">
          <div>Day ${idx + 1}</div>
          <div style="font-size: 18px; margin-top: 5px;">${w}</div>
        </div>
      `;
    });
  }

  try {
    const [exRes, checkinsRes] = await Promise.all([
      fetch('/api/exercises'),
      fetch('/api/checkins')
    ]);
    
    const allExercises = await exRes.json();
    const allCheckins = await checkinsRes.json();

    // Render Exercises
    const exerciseList = document.getElementById("exerciseList");
    if (exerciseList) {
      const currentDayExercises = allExercises.filter(e => e.dayIdx === activeDayIdx);

      exerciseList.innerHTML = "";
      currentDayExercises.forEach(ex => {
        exerciseList.innerHTML += `
          <div class="exercise-item">
            <span>${ex.name}</span>
            <span class="delete-ex" onclick="deleteExercise('${ex._id}')">❌</span>
          </div>
        `;
      });
    }

    // Render Weekly Chart
    const chart = document.getElementById("weeklyChart");
    if (chart) {
      chart.innerHTML = "";
      
      const userCheckins = allCheckins.filter(c => c.userId === user._id);
      const historySet = new Set(userCheckins.map(c => c.date));

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toDateString();
        
        const isChecked = historySet.has(dStr);
        
        chart.innerHTML += `
          <div class="day-col">
            <div class="day-name">${days[d.getDay()]}</div>
            <div class="status-icon" style="color: ${isChecked ? '#4caf50' : '#ff5252'}">${isChecked ? '✔' : '✖'}</div>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error("Error rendering workout page:", err);
  }
}

function selectDay(idx) {
  activeDayIdx = idx;
  renderWorkout();
}

async function addExercise() {
  const input = document.getElementById("newExerciseName");
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;

  try {
    await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayIdx: activeDayIdx, name })
    });
    
    input.value = "";
    renderWorkout();
  } catch (err) {
    console.error("Error adding exercise:", err);
  }
}

async function deleteExercise(id) {
  try {
    await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
    renderWorkout();
  } catch (err) {
    console.error("Error deleting exercise:", err);
  }
}
