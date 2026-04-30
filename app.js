// GLOBAL CONSTANTS
const API_BASE = '/api';

function getSavedUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
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
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Login failed");
      return;
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "team.html";
  } catch (err) {
    console.error(err);
    alert("Could not connect to server");
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
    const res = await fetch(`${API_BASE}/team`);
    const team = await res.json();

    const list = document.getElementById("membersList");
    if (!list) return;

    list.innerHTML = "";
    
    // Find logged in user status
    let myStatus = null;
    
    team.forEach(member => {
      if (member.id === user.id) myStatus = member.checkedIn;
      
      const isCheckedIn = !!member.checkedIn;
      list.innerHTML += `
        <div class="member">
          <span>${member.name} ${member.id === user.id ? '(You)' : ''}</span>
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
    console.error("Error loading team:", err);
  }
}

async function checkIn() {
  const user = getSavedUser();
  if (!user) return;

  try {
    const res = await fetch(`${API_BASE}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    
    if (res.ok) {
      renderTeam();
    }
  } catch (err) {
    console.error("Check-in error:", err);
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
    const res = await fetch(`${API_BASE}/admin/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.id, newUsername })
    });
    
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
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

  // Render Exercises
  const exerciseList = document.getElementById("exerciseList");
  if (exerciseList) {
    try {
      const res = await fetch(`${API_BASE}/exercises`);
      const allExercises = await res.json();
      const currentDayExercises = allExercises.filter(e => e.dayIdx === activeDayIdx);

      exerciseList.innerHTML = "";
      currentDayExercises.forEach(ex => {
        exerciseList.innerHTML += `
          <div class="exercise-item">
            <span>${ex.name}</span>
            <span class="delete-ex" onclick="deleteExercise(${ex.id})">❌</span>
          </div>
        `;
      });
    } catch (err) {
      console.error("Error loading exercises:", err);
    }
  }

  // Render Weekly Chart from backend history
  const chart = document.getElementById("weeklyChart");
  if (chart) {
    chart.innerHTML = "";
    
    try {
      const res = await fetch(`${API_BASE}/workout/history?userId=${user.id}`);
      const historyStrArr = await res.json();
      const historySet = new Set(historyStrArr);

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      // Last 6 days
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
    } catch (err) {
      console.error("Error loading history:", err);
    }
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
    const res = await fetch(`${API_BASE}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayIdx: activeDayIdx, name })
    });
    if (res.ok) {
      input.value = "";
      renderWorkout();
    }
  } catch (err) {
    console.error("Error adding exercise:", err);
  }
}

async function deleteExercise(id) {
  try {
    const res = await fetch(`${API_BASE}/exercises/${id}`, { method: 'DELETE' });
    if (res.ok) {
      renderWorkout();
    }
  } catch (err) {
    console.error("Error deleting exercise:", err);
  }
}
