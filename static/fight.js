/* =========================================================
   Phase 3 – Fight Simulation: Attack Assignment
   Reuses teams selected in Phase 2 (battle.js)
   ========================================================= */

/* ---------- Config ---------- */
const TEMTEM_JSON_URL  = window.TEMTEM_JSON_URL  || "/static/temtem.json";
const ATTACKS_JSON_URL = window.ATTACKS_JSON_URL || "/static/attacks.json";

// Key used by battle.js to persist the selected teams.
const STORAGE_KEY = "selectedTeams";

/* ---------- Utilities ---------- */

/**
 * Fisher–Yates shuffle. Returns a NEW array; does not mutate the input.
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Pick up to `n` unique random keys from an object.
 * If `n` exceeds the number of keys, all keys are returned.
 * @param {Object} obj
 * @param {number} n
 * @returns {string[]}
 */
function pickRandomKeys(obj, n) {
  const keys = Object.keys(obj || {});
  return shuffle(keys).slice(0, Math.min(n, keys.length));
}

/**
 * Fetch a JSON file and return the parsed object.
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
  }
  return res.json();
}

/* ---------- Core: Attack Assignment ---------- */

/**
 * Assign 3 attacks to a Temtem based on its type(s).
 *
 * Rules:
 *   - 1 type  → 3 attacks from that type
 *   - 2 types → 2 attacks from the FIRST type + 1 from the SECOND type
 *
 * @param {Object} temtem       - Temtem object from temtem.json
 * @param {Object} attacksData  - Full attacks.json object
 * @returns {Array<{name:string, damage:number, type:string}>}
 */
function assignAttacks(temtem, attacksData) {
  const types = Object.keys(temtem.type || {});
  const assigned = [];

  if (types.length === 0) {
    console.warn(`Temtem "${temtem.name}" has no type; skipping attack assignment.`);
    return assigned;
  }

  // --- Single-type Temtem: 3 attacks from that type ---
  if (types.length === 1) {
    const type = types[0];
    const pool = attacksData[type] || {};
    pickRandomKeys(pool, 3).forEach(name => {
      assigned.push({ name, damage: pool[name], type });
    });
    return assigned;
  }

  // --- Dual-type Temtem: 2 from first type + 1 from second type ---
  const [firstType, secondType] = types;
  const firstPool  = attacksData[firstType]  || {};
  const secondPool = attacksData[secondType] || {};

  pickRandomKeys(firstPool, 2).forEach(name => {
    assigned.push({ name, damage: firstPool[name], type: firstType });
  });
  pickRandomKeys(secondPool, 1).forEach(name => {
    assigned.push({ name, damage: secondPool[name], type: secondType });
  });

  return assigned;
}

/* ---------- Rendering ---------- */

/**
 * Build a DOM card for a single Temtem, including its assigned attacks.
 * @param {Object} temtem
 * @returns {HTMLElement}
 */
function renderTemtemCard(temtem) {
  const card = document.createElement("div");
  card.className = "temtem-card fight-card";

  const typeBadges = Object.keys(temtem.type || {})
    .map(t => `<span class="type-badge" title="${t}">${t}</span>`)
    .join("");

  const attackList = (temtem.assignedAttacks || [])
    .map(a => `
      <li class="attack-item">
        <span class="attack-name">${a.name}</span>
        <span class="attack-type">${a.type}</span>
        <span class="attack-dmg">${a.damage}</span>
      </li>
    `)
    .join("");

  card.innerHTML = `
    <img src="${temtem.image}" alt="${temtem.name}" class="temtem-img" />
    <h3 class="temtem-name">${temtem.name}</h3>
    <p class="temtem-number">${temtem.number}</p>
    <div class="temtem-types">${typeBadges}</div>
    <p class="temtem-hp">HP: ${temtem.hp}</p>
    <ul class="attack-list">${attackList}</ul>
  `;

  return card;
}

/**
 * Render an entire team into a container.
 * @param {string} containerId
 * @param {Array}  team
 */
function renderTeam(containerId, team) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  team.forEach(t => container.appendChild(renderTemtemCard(t)));
}

/* ---------- Storage Helpers ---------- */

/**
 * Read the selected teams from localStorage.
 *
 * Accepts either of these shapes (to stay compatible with battle.js):
 *   { teamA: [...], teamB: [...] }        // names or full objects
 *   { player: [...], opponent: [...] }    // alternative naming
 *
 * @returns {{teamA: Array, teamB: Array}}
 */
function readSelectedTeams() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    console.warn(`No "${STORAGE_KEY}" found in localStorage.`);
    return { teamA: [], teamB: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse selectedTeams:", err);
    return { teamA: [], teamB: [] };
  }

  const teamA = parsed.teamA || parsed.player   || [];
  const teamB = parsed.teamB || parsed.opponent || [];
  return { teamA, teamB };
}

/* ---------- Orchestration ---------- */

/**
 * Resolve a team entry (name string OR full object) to a full Temtem object
 * from temtem.json, then assign attacks.
 *
 * @param {Array}  teamEntries
 * @param {Array}  allTemtem
 * @param {Object} attacksData
 * @returns {Array} Temtem objects enriched with `assignedAttacks`
 */
function prepareTeam(teamEntries, allTemtem, attacksData) {
  return teamEntries
    .map(entry => {
      // Entry may be a full object or just a name string.
      const temtem =
        typeof entry === "string"
          ? allTemtem.find(t => t.name === entry)
          : entry;

      if (!temtem) {
        console.warn("Unknown Temtem entry:", entry);
        return null;
      }

      return {
        ...temtem,
        assignedAttacks: assignAttacks(temtem, attacksData),
      };
    })
    .filter(Boolean);
}

/**
 * Main entry point.
 */
async function initFight() {
  try {
    const [allTemtem, attacksData] = await Promise.all([
      loadJSON(TEMTEM_JSON_URL),
      loadJSON(ATTACKS_JSON_URL),
    ]);

    const { teamA, teamB } = readSelectedTeams();

    const preparedA = prepareTeam(teamA, allTemtem, attacksData);
    const preparedB = prepareTeam(teamB, allTemtem, attacksData);

    renderTeam("team-a-grid", preparedA);
    renderTeam("team-b-grid", preparedB);

    // Expose for the next phase (actual battle simulation).
    window.battleState = {
      teamA: preparedA,
      teamB: preparedB,
    };

    // Enable the "Proceed" button once everything is ready.
    const proceedBtn = document.getElementById("proceed-btn");
    if (proceedBtn) {
      proceedBtn.disabled = false;
      proceedBtn.addEventListener("click", () => {
        // Next phase will hook into this.
        console.log("Battle state ready:", window.battleState
