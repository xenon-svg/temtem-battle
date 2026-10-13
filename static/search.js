/* ============================================
   Phase 2 — Search with Autocomplete
   ============================================ */

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const cardContainer = document.getElementById("card-container");
const errorMsg = document.getElementById("error-msg");
const suggestionsBox = document.getElementById("suggestions");

let debounceTimer;

/* ============================================
   Autocomplete — fetch suggestions as user types
   ============================================ */
input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();

  if (!q) {
    hideSuggestions();
    return;
  }

  // Debounce so we don't spam the server on every keystroke
  debounceTimer = setTimeout(() => fetchSuggestions(q), 180);
});

async function fetchSuggestions(q) {
  try {
    const res = await fetch(`/suggest?q=${encodeURIComponent(q)}`);
    const names = await res.json();

    if (!names.length) {
      hideSuggestions();
      return;
    }

    suggestionsBox.innerHTML = names
      .map(name => `<li class="suggestion-item">${name}</li>`)
      .join("");
    suggestionsBox.classList.add("visible");

    // Attach click handlers to each suggestion
    document.querySelectorAll(".suggestion-item").forEach(li => {
      li.addEventListener("click", () => {
        input.value = li.textContent;
        hideSuggestions();
        form.dispatchEvent(new Event("submit"));
      });
    });
  } catch (err) {
    // Silently ignore suggestion errors — search still works
    hideSuggestions();
  }
}

function hideSuggestions() {
  suggestionsBox.innerHTML = "";
  suggestionsBox.classList.remove("visible");
}

/* ============================================
   Hide suggestions when clicking outside
   ============================================ */
document.addEventListener("click", (e) => {
  if (!e.target.closest(".input-wrapper")) {
    hideSuggestions();
  }
});

/* ============================================
   Search — fetch and render the Temtem card
   ============================================ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorMsg.textContent = "";
  cardContainer.innerHTML = "";
  hideSuggestions();

  const query = input.value.trim();
  if (!query) return;

  try {
    const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.error || "Something went wrong.";
      return;
    }

    renderCard(data);
  } catch (err) {
    errorMsg.textContent = "Network error. Please try again.";
  }
});

/* ============================================
   Card renderer — same as Phase 1
   ============================================ */
function renderCard(t) {
  // Build type badges (skip the Temtem's own image URL)
  const typeEntries = Object.entries(t.type).filter(
    ([key]) => key.toLowerCase() !== t.name.toLowerCase()
  );

  const typeBadges = typeEntries
    .map(([typeName, iconUrl]) => `
      <div class="type-badge">
        <img src="${iconUrl}" alt="${typeName}" />
        <span>${typeName}</span>
      </div>
    `)
    .join("");

  const techniques = t.techniques
    .map(tech => `<li class="technique">⚔️ ${tech}</li>`)
    .join("");

  cardContainer.innerHTML = `
    <div class="poke-card">
      <div class="card-header">
        <span class="card-number">${t.number}</span>
        <span class="card-hp">HP ${t.hp}</span>
      </div>

      <div class="card-image">
        <img src="${t.image}" alt="${t.name}" />
      </div>

      <h2 class="card-name">${t.name}</h2>

      <div class="card-types">${typeBadges}</div>

      <div class="card-techniques">
        <h3>Techniques</h3>
        <ul>${techniques}</ul>
      </div>
    </div>
  `;
}