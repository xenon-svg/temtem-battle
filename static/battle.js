/* ============================================
   Phase 2 — Battle Setup Logic
   ============================================ */

/* ---------- DOM references ---------- */
const selectTeamSection = document.getElementById("select-team-section");
const selectTeamBtn     = document.getElementById("select-team-btn");
const modeOptions       = document.getElementById("mode-options");
const randomBtn         = document.getElementById("random-btn");
const selectionBtn      = document.getElementById("selection-btn");
const statusMsg         = document.getElementById("status-msg");
const teamsContainer    = document.getElementById("teams-container");
const player1Slots      = document.getElementById("player1-slots");
const player2Slots      = document.getElementById("player2-slots");
const pickerSection     = document.getElementById("picker-section");
const pickerSearch      = document.getElementById("picker-search");
const pickerGrid        = document.getElementById("picker-grid");
const resetBtn          = document.getElementById("reset-btn");

/* ---------- State ---------- */
const TEAM_SIZE = 3;

let allTemtems = [];          // loaded from /all-temtems
let team1 = [];               // Player 1's picks
let team2 = [];               // Player 2's picks
let currentPlayer = 1;        // whose turn it is in Selection mode
let selectionModeActive = false;

/* ============================================
   Sound Effects — Web Audio API
   ============================================ */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

/**
 * Play a simple tone.
 * @param {number} freq - Frequency in Hz
 * @param {number} duration - In seconds
 * @param {string} type - 'sine' | 'square' | 'triangle' | 'sawtooth'
 * @param {number} volume - 0 to 1
 */
function playTone(freq, duration = 0.12, type = "sine", volume = 0.15) {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

/* Ready-made sound effects */
const SFX = {
  click:    () => playTone(520, 0.06, "square", 0.08),
  pick:     () => playTone(660, 0.10, "triangle", 0.12),
  unpick:   () => playTone(300, 0.10, "sine", 0.10),
  ready:    () => {
    // Little ascending fanfare
    playTone(523, 0.10, "sine", 0.14); // C5
    setTimeout(() => playTone(659, 0.10, "sine", 0.14), 100); // E5
    setTimeout(() => playTone(784, 0.18, "sine", 0.16), 200); // G5
  },
  reset:    () => {
    playTone(400, 0.08, "sine", 0.10);
    setTimeout(() => playTone(300, 0.12, "sine", 0.10), 80);
  },
};

selectTeamBtn.addEventListener("click", () => {
  SFX.click();
  selectTeamSection.classList.add("hidden");
  modeOptions.classList.remove("hidden");
  statusMsg.textContent = "Choose how to build the teams.";
});

randomBtn.addEventListener("click", () => {
  SFX.click();
  startRandomMode();
});

selectionBtn.addEventListener("click", () => {
  SFX.click();
  startSelectionMode();
});

resetBtn.addEventListener("click", () => {
  SFX.reset();
  resetBattle();
});

/* ============================================
   Initial setup
   ============================================ */
selectTeamBtn.addEventListener("click", () => {
  selectTeamSection.classList.add("hidden");
  modeOptions.classList.remove("hidden");
  statusMsg.textContent = "Choose how to build the teams.";
});

randomBtn.addEventListener("click", startRandomMode);
selectionBtn.addEventListener("click", startSelectionMode);
resetBtn.addEventListener("click", resetBattle);

/* ============================================
   RANDOM MODE
   ============================================ */
async function startRandomMode() {
  statusMsg.textContent = "Rolling the dice... ?";

  try {
    const res = await fetch("/random-teams");
    const data = await res.json();

    if (!res.ok) {
      statusMsg.textContent = data.error || "Could not fetch random teams.";
      return;
    }

    team1 = data.player1;
    team2 = data.player2;

    renderTeams();
    teamsContainer.classList.remove("hidden");
    resetBtn.classList.remove("hidden");
    modeOptions.classList.add("hidden");
    statusMsg.textContent = "⚔️ Random teams ready — let the battle begin!";
    // ? NEW — play fanfare + show HP comparison
    SFX.ready();
    showHPComparison();
  } catch (err) {
    statusMsg.textContent = "Network error. Please try again.";
  }
}

/* ============================================
   SELECTION MODE
   ============================================ */
async function startSelectionMode() {
  statusMsg.textContent = "Loading Temtems...";

  // Load all Temtems once
  if (!allTemtems.length) {
    try {
      const res = await fetch("/all-temtems");
      allTemtems = await res.json();
    } catch (err) {
      statusMsg.textContent = "Failed to load Temtem list.";
      return;
    }
  }

  selectionModeActive = true;
  currentPlayer = 1;
  team1 = [];
  team2 = [];

  modeOptions.classList.add("hidden");
  teamsContainer.classList.remove("hidden");
  pickerSection.classList.remove("hidden");
  resetBtn.classList.remove("hidden");

  renderTeams();
  renderPicker();
  updateTurnPrompt();
}

/* ---------- Picker rendering ---------- */
function renderPicker(filter = "") {
  const q = filter.trim().toLowerCase();
  const available = allTemtems.filter(t => {
    if (q && !t.name.toLowerCase().includes(q)) return false;
    return true;
  });

  pickerGrid.innerHTML = available
    .map(t => {
      const picked = isPicked(t.name);
      return `
        <div class="picker-card ${picked ? "disabled" : ""}" data-name="${t.name}">
          <img src="${t.image}" alt="${t.name}" />
          <div class="picker-name">${t.name}</div>
          <div class="picker-hp">HP ${t.hp}</div>
        </div>
      `;
    })
    .join("");

  // Attach click handlers
  pickerGrid.querySelectorAll(".picker-card:not(.disabled)").forEach(card => {
    card.addEventListener("click", () => handlePick(card.dataset.name));
  });
}

function isPicked(name) {
  return team1.some(t => t.name === name) || team2.some(t => t.name === name);
}

/* ---------- Handle a pick ---------- */
function handlePick(name) {
  if (!selectionModeActive) return;

  const temtem = allTemtems.find(t => t.name === name);
  if (!temtem) return;

  // Safety: already picked
  if (isPicked(name)) return;

  if (currentPlayer === 1) {
    team1.push(temtem);
  } else {
    team2.push(temtem);
  }

  renderTeams();
  renderPicker(pickerSearch.value);

  // Check if both teams are full
  if (team1.length === TEAM_SIZE && team2.length === TEAM_SIZE) {
    selectionModeActive = false;
    pickerSection.classList.add("hidden");
    statusMsg.textContent = "⚔️ Both teams are ready — let the battle begin!";
    SFX.ready();
    showHPComparison();
    return;
  }

  // Switch player if current player's team is full, otherwise alternate
  if (currentPlayer === 1 && team1.length === TEAM_SIZE) {
    currentPlayer = 2;
  } else if (currentPlayer === 2 && team2.length === TEAM_SIZE) {
    currentPlayer = 1;
  } else {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
  }

  updateTurnPrompt();
}

/* ---------- Turn prompt ---------- */
function updateTurnPrompt() {
  if (!selectionModeActive) return;
  statusMsg.textContent = `Player ${currentPlayer}, pick your Temtem (${team1.length + team2.length}/6 chosen).`;
}

/* ---------- Picker search filter ---------- */
pickerSearch.addEventListener("input", () => {
  renderPicker(pickerSearch.value);
});

/* ============================================
   RENDER TEAMS
   ============================================ */
function renderTeams() {
  player1Slots.innerHTML = renderSlots(team1);
  player2Slots.innerHTML = renderSlots(team2);
}

function renderSlots(team) {
  let html = "";
  for (let i = 0; i < TEAM_SIZE; i++) {
    const t = team[i];
    if (t) {
      html += `
        <div class="team-slot filled">
          <img src="${t.image}" alt="${t.name}" />
          <div class="slot-info">
            <span class="slot-name">${t.name}</span>
            <span class="slot-hp">HP ${t.hp}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="team-slot">
          <span class="slot-empty">Empty slot</span>
        </div>
      `;
    }
  }
  return html;
}

/* ============================================
   HP Comparison
   ============================================ */
const hpCompare     = document.getElementById("hp-compare");
const hpBarP1       = document.getElementById("hp-bar-p1");
const hpBarP2       = document.getElementById("hp-bar-p2");
const hpTotalP1     = document.getElementById("hp-total-p1");
const hpTotalP2     = document.getElementById("hp-total-p2");
const hpAdvantage   = document.getElementById("hp-advantage");
function showHPComparison() {
  const total1 = team1.reduce((sum, t) => sum + (t.hp || 0), 0);
  const total2 = team2.reduce((sum, t) => sum + (t.hp || 0), 0);
  const maxHP  = Math.max(total1, total2, 1);

  hpTotalP1.textContent = total1;
  hpTotalP2.textContent = total2;

  // Reset widths first so the transition replays cleanly
  hpBarP1.style.transition = "none";
  hpBarP2.style.transition = "none";
  hpBarP1.style.width = "0%";
  hpBarP2.style.width = "0%";

  hpCompare.classList.remove("hidden");

  // Force a reflow, then re-enable transition and animate
  void hpBarP1.offsetWidth;

  requestAnimationFrame(() => {
    hpBarP1.style.transition = "";
    hpBarP2.style.transition = "";
    hpBarP1.style.width = `${(total1 / maxHP) * 100}%`;
    hpBarP2.style.width = `${(total2 / maxHP) * 100}%`;
  });

  // ...advantage message logic stays the same...
}

/* ============================================
   RESET
   ============================================ */
function resetBattle() {
  team1 = [];
  team2 = [];
  currentPlayer = 1;
  hpBarP1.style.width = "0%";
  hpBarP2.style.width = "0%";
  selectionModeActive = false;

  statusMsg.textContent = "";
  teamsContainer.classList.add("hidden");
  pickerSection.classList.add("hidden");
  modeOptions.classList.add("hidden");
  resetBtn.classList.add("hidden");
  selectTeamSection.classList.remove("hidden");
  hpCompare.classList.add("hidden");

  player1Slots.innerHTML = "";
  player2Slots.innerHTML = "";
  pickerGrid.innerHTML = "";
  pickerSearch.value = "";
}