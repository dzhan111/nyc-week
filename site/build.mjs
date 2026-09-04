// Renders every week JSON in the data directory into a static site under dist/.
// Zero dependencies on purpose: this runs in CI on a bare Node and should never
// break because of a transitive package.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  validateWeek,
  eventDay,
  dayIndex,
} from "../scripts/validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA_DIR = path.resolve(ROOT, argValue("--data", "data/weeks"));
const OUT_DIR = path.resolve(ROOT, argValue("--out", "dist"));

const SITE_TITLE = "NYC Week";
const TAGLINE = "What's on in New York over the next seven days.";

// ---------------------------------------------------------------- formatting

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function weekdayOf(dateOnly) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function fmtDay(dateOnly) {
  const [, m, d] = dateOnly.split("-").map(Number);
  return `${weekdayOf(dateOnly)}, ${MONTHS[m - 1]} ${d}`;
}

function fmtRange(startDate, endDate) {
  const [, sm, sd] = startDate.split("-").map(Number);
  const [, em, ed] = endDate.split("-").map(Number);
  const left = `${MONTHS[sm - 1]} ${sd}`;
  const right = sm === em ? `${ed}` : `${MONTHS[em - 1]} ${ed}`;
  return `${left} – ${right}`;
}

// Reads the wall-clock time as authored in the ISO string. Deliberately does not
// go through Date: the offset in the string is already NYC time, and parsing
// would re-interpret it in whatever timezone the CI runner happens to use.
function wallTime(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return min === 0 ? `${h} ${ampm}` : `${h}:${String(min).padStart(2, "0")} ${ampm}`;
}

function fmtWhen(ev) {
  if (ev.all_day) return "All day";
  const start = wallTime(ev.start);
  if (!start) return "";
  const end = ev.end ? wallTime(ev.end) : null;
  return end ? `${start} – ${end}` : start;
}

function fmtPrice(price) {
  return price.tier === "free" ? "Free" : price.tier;
}

function fmtPrereqs(p) {
  const bits = [];
  if (p.rsvp) bits.push("RSVP required");
  if (p.skill_level) bits.push(p.skill_level);
  if (p.gear) bits.push(`bring ${p.gear}`);
  if (p.age) bits.push(p.age);
  if (p.wait) bits.push(p.wait);
  return bits.join(" · ");
}

// ---------------------------------------------------------------- components

function renderEvent(ev) {
  const when = fmtWhen(ev);
  const prereqs = fmtPrereqs(ev.prereqs);
  const loc = ev.location;
  const where = [loc.venue, loc.neighborhood].filter(Boolean).join(" · ");
  const isFree = ev.price.tier === "free";

  return `
        <article class="event" id="${esc(ev.id)}"
                 data-category="${esc(ev.category)}"
                 data-borough="${esc(loc.borough)}"
                 data-free="${isFree ? "1" : "0"}"
                 data-freefood="${ev.free_food ? "1" : "0"}">
          <div class="event-head">
            <h4 class="event-title">
              <a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(ev.title)}</a>
            </h4>
            <span class="badges">
              <span class="badge price ${isFree ? "is-free" : ""}">${esc(fmtPrice(ev.price))}</span>
              ${ev.free_food ? `<span class="badge freefood">Free food</span>` : ""}
            </span>
          </div>
          <p class="event-desc">${esc(ev.description)}</p>
          <p class="event-meta">
            <span class="where">${esc(where)}</span>
            <span class="sep" aria-hidden="true">·</span>
            <span class="borough">${esc(loc.borough)}</span>
            ${when ? `<span class="sep" aria-hidden="true">·</span><span class="when">${esc(when)}</span>` : ""}
          </p>
          ${ev.price.note ? `<p class="event-note">${esc(ev.price.note)}</p>` : ""}
          ${prereqs ? `<p class="event-prereqs">${esc(prereqs)}</p>` : ""}
          <p class="event-source">via ${esc(ev.source)}</p>
        </article>`;
}

function renderDay(dateOnly, events) {
  const byCategory = CATEGORIES.map((cat) => [cat, events.filter((e) => e.category === cat)]).filter(
    ([, list]) => list.length > 0,
  );

  const groups = byCategory
    .map(
      ([cat, list]) => `
      <section class="category" data-category="${esc(cat)}">
        <h3 class="category-title">${esc(CATEGORY_LABELS[cat])}</h3>
        ${list.map(renderEvent).join("\n")}
      </section>`,
    )
    .join("\n");

  return `
    <section class="day" id="day-${esc(dateOnly)}" data-day="${esc(dateOnly)}">
      <h2 class="day-title">
        <span class="day-relative"></span>
        <span class="day-date">${esc(fmtDay(dateOnly))}</span>
        <span class="day-count">${events.length}</span>
      </h2>
      ${groups}
    </section>`;
}

function renderFilters() {
  const chips = [
    `<button class="chip is-on" data-filter="category" data-value="all">All</button>`,
    ...CATEGORIES.map(
      (c) => `<button class="chip" data-filter="category" data-value="${esc(c)}">${esc(CATEGORY_LABELS[c])}</button>`,
    ),
  ].join("\n          ");

  return `
      <div class="filters">
        <div class="chips" role="group" aria-label="Filter by category">
          ${chips}
        </div>
        <div class="toggles">
          <label class="toggle"><input type="checkbox" id="only-free"> Free only</label>
          <label class="toggle"><input type="checkbox" id="only-freefood"> Free food only</label>
          <label class="toggle borough-pick">
            Borough
            <select id="borough">
              <option value="all">Any</option>
              <option>Manhattan</option>
              <option>Brooklyn</option>
              <option>Queens</option>
              <option>The Bronx</option>
              <option>Staten Island</option>
            </select>
          </label>
        </div>
      </div>`;
}

function page({ title, base, body, weekJson }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(TAGLINE)}">
<link rel="stylesheet" href="${base}styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>🗽</text></svg>">
</head>
<body>
${body}
${weekJson ? `<script type="application/json" id="week-data">${weekJson.replace(/</g, "\\u003c")}</script>\n<script src="${base}app.js" defer></script>` : ""}
</body>
</html>
`;
}

function renderWeekPage(week, { base, isCurrent, otherWeeks }) {
  const days = [...new Set(week.events.map(eventDay))].sort();
  const dayNav = days
    .map((d) => {
      const dd = Number(d.slice(8, 10));
      return `<a href="#day-${esc(d)}" data-daylink="${esc(d)}"><span>${weekdayOf(d)}</span><b>${dd}</b></a>`;
    })
    .join("\n            ");

  const sections = days.map((d) => renderDay(d, week.events.filter((e) => eventDay(e) === d))).join("\n");

  const generated = new Date(week.generated_at);
  const generatedLabel = `${MONTHS[generated.getUTCMonth()]} ${generated.getUTCDate()}, ${generated.getUTCFullYear()}`;

  const body = `
  <header class="site-header">
    <div class="wrap">
      <div class="brand">
        <h1><a href="${base}index.html">${esc(SITE_TITLE)}</a></h1>
        <p class="tagline">${esc(TAGLINE)}</p>
      </div>
      <nav class="site-nav">
        <a href="${base}archive/index.html">Archive${otherWeeks ? ` (${otherWeeks})` : ""}</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
    ${week.fixture ? `<p class="fixture-banner"><b>Sample data.</b> These are placeholder events for testing the layout, not real listings.</p>` : ""}
    ${!isCurrent ? `<p class="archive-banner">Archived week. <a href="${base}index.html">See the current week →</a></p>` : ""}

    <div class="week-head">
      <h2 class="week-range">${esc(fmtRange(week.week_start, week.week_end))}</h2>
      <p class="week-sub"><span class="count-live">${week.events.length}</span> events · researched ${esc(generatedLabel)}</p>
    </div>

    ${renderFilters()}

    <nav class="day-nav" aria-label="Jump to day">
      <div class="day-nav-inner">
            ${dayNav}
      </div>
    </nav>

    <p class="no-results" hidden>Nothing matches those filters.</p>

    ${sections}
  </main>

  <footer class="site-footer wrap">
    <p>Regenerated weekly by <a href="https://github.com/dzhan111/nyc-week">nyc-week</a>. Always double-check times on the event's own page before heading out.</p>
  </footer>`;

  return page({
    title: isCurrent ? SITE_TITLE : `${fmtRange(week.week_start, week.week_end)} · ${SITE_TITLE}`,
    base,
    body,
    weekJson: JSON.stringify({ days }),
  });
}

function renderArchive(weeks, base) {
  const rows = weeks
    .map(
      (w) => `
        <li>
          <a href="${base}weeks/${esc(w.week_start)}/index.html">
            <span class="arch-range">${esc(fmtRange(w.week_start, w.week_end))}</span>
            <span class="arch-count">${w.events.length} events</span>
          </a>
        </li>`,
    )
    .join("\n");

  const body = `
  <header class="site-header">
    <div class="wrap">
      <div class="brand">
        <h1><a href="${base}index.html">${esc(SITE_TITLE)}</a></h1>
        <p class="tagline">${esc(TAGLINE)}</p>
      </div>
      <nav class="site-nav"><a href="${base}index.html">Current week</a></nav>
    </div>
  </header>
  <main class="wrap">
    <div class="week-head"><h2 class="week-range">Archive</h2>
    <p class="week-sub">${weeks.length} week${weeks.length === 1 ? "" : "s"} on record.</p></div>
    <ul class="archive-list">${rows}</ul>
  </main>
  <footer class="site-footer wrap"><p>Regenerated weekly by <a href="https://github.com/dzhan111/nyc-week">nyc-week</a>.</p></footer>`;

  return page({ title: `Archive · ${SITE_TITLE}`, base, body, weekJson: null });
}

function renderEmpty() {
  const body = `
  <header class="site-header">
    <div class="wrap"><div class="brand">
      <h1>${esc(SITE_TITLE)}</h1>
      <p class="tagline">${esc(TAGLINE)}</p>
    </div></div>
  </header>
  <main class="wrap">
    <div class="week-head"><h2 class="week-range">No weeks yet</h2>
    <p class="week-sub">The first research run hasn't landed. Trigger the <code>research</code> workflow to populate this page.</p></div>
  </main>`;
  return page({ title: SITE_TITLE, base: "", body, weekJson: null });
}

// ---------------------------------------------------------------------- main

function loadWeeks() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const full = path.join(DATA_DIR, f);
      const week = JSON.parse(fs.readFileSync(full, "utf8"));
      const errors = validateWeek(week);
      if (errors.length) {
        console.error(`\n${full} failed validation:`);
        for (const e of errors) console.error(`  - ${e}`);
        process.exit(1);
      }
      return week;
    })
    .sort((a, b) => dayIndex(b.week_start) - dayIndex(a.week_start));
}

function write(rel, contents) {
  const dest = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
  return rel;
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  fs.copyFileSync(path.join(ROOT, "site/styles.css"), path.join(OUT_DIR, "styles.css"));
  fs.copyFileSync(path.join(ROOT, "site/app.js"), path.join(OUT_DIR, "app.js"));
  // Pages would otherwise run the output through Jekyll and drop nothing we need,
  // but skipping it makes builds faster and avoids surprises with underscores.
  fs.writeFileSync(path.join(OUT_DIR, ".nojekyll"), "");

  const weeks = loadWeeks();
  const written = ["styles.css", "app.js"];

  if (weeks.length === 0) {
    written.push(write("index.html", renderEmpty()));
    console.log(`No week data in ${path.relative(ROOT, DATA_DIR)} — wrote placeholder index.`);
    return;
  }

  const [current, ...rest] = weeks;
  written.push(write("index.html", renderWeekPage(current, { base: "", isCurrent: true, otherWeeks: rest.length })));

  for (const w of weeks) {
    written.push(
      write(
        `weeks/${w.week_start}/index.html`,
        renderWeekPage(w, { base: "../../", isCurrent: w === current, otherWeeks: weeks.length - 1 }),
      ),
    );
  }

  written.push(write("archive/index.html", renderArchive(weeks, "../")));

  console.log(`Built ${written.length} files into ${path.relative(ROOT, OUT_DIR)}/`);
  console.log(`  current week: ${current.week_start} → ${current.week_end} (${current.events.length} events)`);
  console.log(`  archive: ${weeks.length} week(s)`);
}

main();
