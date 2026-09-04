// NYC Weekly Rundown — renders data/events.json into the page.
// The JSON is regenerated daily (see README) so this script always just
// reflects whatever's current, computing "Today/Tomorrow" labels live.

const CATEGORY_META = {
  cost: { label: "Cost-Effective Fun", emoji: "🎈" },
  sports: { label: "Sports & Movement", emoji: "🏃" },
  hobby: { label: "Hobby & Interest", emoji: "🎲" },
  celebration: { label: "Celebrations & Seasonal", emoji: "🎉" },
  unique: { label: "NYC-Unique Experience", emoji: "🗽" },
  food: { label: "Free Food", emoji: "🍽️" },
};

let activeFilter = "all";
let DATA = null;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function relativeDayLabel(dateISO) {
  const today = new Date(todayISO() + "T00:00:00");
  const target = new Date(dateISO + "T00:00:00");
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  return null;
}

function formatDateLong(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function priceBadgeClass(priceTier) {
  return priceTier === "free" ? "price-badge free" : "price-badge";
}

function eventMatchesFilter(ev) {
  if (activeFilter === "all") return true;
  if (activeFilter === "freefood") return !!ev.freeFood;
  return ev.categories.includes(activeFilter);
}

function renderTags(categories, freeFood) {
  const tags = categories
    .map((c) => {
      const meta = CATEGORY_META[c];
      if (!meta) return "";
      return `<span class="tag ${c}">${meta.emoji} ${meta.label}</span>`;
    })
    .join("");
  const foodTag = freeFood ? `<span class="tag food-tag">🍽️ Free food</span>` : "";
  return `<div class="tag-row">${tags}${foodTag}</div>`;
}

function renderCard(ev) {
  const highlightClass = ev.highlight ? " highlight" : "";
  return `
    <article class="event-card${highlightClass}">
      <div class="event-top">
        <h3 class="event-title"><a href="${ev.link}" target="_blank" rel="noopener">${ev.title}</a></h3>
        <span class="${priceBadgeClass(ev.priceTier)}">${ev.priceNote}</span>
      </div>
      <p class="event-desc">${ev.description}</p>
      <div class="event-meta">
        <div><span class="label">📍</span> ${ev.location}</div>
        <div><span class="label">🕐</span> ${ev.schedule}</div>
        <div><span class="label">✅</span> ${ev.prereqs}</div>
      </div>
      ${renderTags(ev.categories, ev.freeFood)}
    </article>
  `;
}

function groupByCategory(events) {
  const groups = {};
  for (const ev of events) {
    for (const c of ev.categories) {
      if (!groups[c]) groups[c] = [];
      if (!groups[c].includes(ev)) groups[c].push(ev);
    }
  }
  return groups;
}

function renderFlexible() {
  const section = document.getElementById("flexible-section");
  const list = document.getElementById("flexible-list");
  const items = (DATA.flexible || []).filter(eventMatchesFilter);
  if (items.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  list.innerHTML = items.map(renderCard).join("");
}

function renderDays() {
  const container = document.getElementById("days-container");
  const today = todayISO();
  const days = (DATA.days || [])
    .filter((d) => d.date >= today)
    .slice(0, 7);

  let anyVisible = false;
  const blocks = days.map((day) => {
    const events = day.events.filter(eventMatchesFilter);
    if (events.length === 0) return "";
    anyVisible = true;

    const groups = groupByCategory(events);
    const catOrder = ["cost", "sports", "hobby", "celebration", "unique", "food"];
    const groupsHtml = catOrder
      .filter((c) => groups[c] && groups[c].length)
      .map((c) => {
        const meta = CATEGORY_META[c];
        return `
          <div class="category-group">
            <div class="category-label">${meta.emoji} ${meta.label}</div>
            <div class="card-grid">${groups[c].map(renderCard).join("")}</div>
          </div>
        `;
      })
      .join("");

    const rel = relativeDayLabel(day.date);
    const holidayTag = day.holiday ? `<span class="holiday-tag">${day.holiday}</span>` : "";

    return `
      <section class="day-block">
        <div class="day-heading">
          <h2>${day.weekday}</h2>
          <span class="day-date">${formatDateLong(day.date)}</span>
          ${rel ? `<span class="day-relative">${rel}</span>` : ""}
          ${holidayTag}
        </div>
        ${groupsHtml}
      </section>
    `;
  });

  container.innerHTML = blocks.join("");
  document.getElementById("empty-state").hidden = anyVisible || (DATA.flexible || []).some(eventMatchesFilter);
}

function renderAll() {
  renderFlexible();
  renderDays();
}

function buildFilterChips() {
  const nav = document.getElementById("filters");
  const cats = Object.entries(CATEGORY_META);
  const extra = `<button class="chip" data-filter="freefood">🍽️ Free Food Only</button>`;
  const chips = cats
    .map(([key, meta]) => `<button class="chip" data-filter="${key}">${meta.emoji} ${meta.label}</button>`)
    .join("");
  nav.insertAdjacentHTML("beforeend", chips + extra);

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    nav.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
    renderAll();
  });
}

function setUpdatedBadge() {
  const badge = document.getElementById("updated-badge");
  try {
    const gen = new Date(DATA.meta.generatedAt);
    badge.textContent = `Updated ${gen.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  } catch {
    badge.textContent = "";
  }
}

async function init() {
  buildFilterChips();
  try {
    const res = await fetch("data/events.json", { cache: "no-store" });
    DATA = await res.json();
  } catch (err) {
    document.getElementById("days-container").innerHTML =
      '<p class="empty-state">Could not load event data. Try refreshing.</p>';
    return;
  }
  setUpdatedBadge();
  renderAll();
}

init();
