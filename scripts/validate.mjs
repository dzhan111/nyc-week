// Shared schema checks for a week file. Hand-written on purpose: the site build
// stays dependency-free, and the rules here are the only thing standing between
// a bad model response and the published site.

export const CATEGORIES = [
  "cost-effective",
  "sports",
  "hobby",
  "celebrations",
  "nyc-unique",
  "free-food",
];

export const CATEGORY_LABELS = {
  "cost-effective": "Cost-effective fun",
  sports: "Sports & movement",
  hobby: "Hobby & interest",
  celebrations: "Celebrations & seasonal",
  "nyc-unique": "NYC-unique",
  "free-food": "Free food",
};

export const PRICE_TIERS = ["free", "$", "$$", "$$$"];

const BOROUGHS = [
  "Manhattan",
  "Brooklyn",
  "Queens",
  "The Bronx",
  "Staten Island",
  "Multiple",
];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

// Parses a YYYY-MM-DD as a UTC calendar day, so day arithmetic never drifts
// with the runner's timezone.
export function dayIndex(dateOnly) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// The calendar day an event falls on, in NYC terms. Timestamps carry an explicit
// offset, so slicing the date off the string is both correct and cheap.
export function eventDay(event) {
  return event.start.slice(0, 10);
}

/**
 * Validates a parsed week object. Returns an array of human-readable problems;
 * empty means the file is safe to commit and render.
 */
export function validateWeek(week) {
  const errors = [];
  const bad = (msg) => errors.push(msg);

  if (!isObj(week)) return ["week is not an object"];

  for (const field of ["week_start", "week_end"]) {
    if (!isStr(week[field]) || !DATE_ONLY.test(week[field])) {
      bad(`${field} must be a YYYY-MM-DD string (got ${JSON.stringify(week[field])})`);
    }
  }
  if (!isStr(week.generated_at) || Number.isNaN(Date.parse(week.generated_at))) {
    bad("generated_at must be an ISO timestamp");
  }
  if (!Array.isArray(week.events) || week.events.length === 0) {
    bad("events must be a non-empty array");
    return errors;
  }
  if (errors.length) return errors;

  const startDay = dayIndex(week.week_start);
  const endDay = dayIndex(week.week_end);
  if (endDay < startDay) bad("week_end is before week_start");
  if (endDay - startDay > 8) bad(`week spans ${endDay - startDay + 1} days; expected at most 9`);

  const seenIds = new Set();

  week.events.forEach((ev, i) => {
    const at = (msg) => bad(`events[${i}] (${ev?.title ?? "untitled"}): ${msg}`);
    if (!isObj(ev)) return bad(`events[${i}] is not an object`);

    if (!isStr(ev.id)) at("missing id");
    else if (seenIds.has(ev.id)) at(`duplicate id "${ev.id}"`);
    else seenIds.add(ev.id);

    if (!isStr(ev.title)) at("missing title");
    if (!isStr(ev.description)) at("missing description");

    if (!isStr(ev.url)) at("missing url");
    else if (!/^https?:\/\//.test(ev.url)) at(`url is not http(s): ${ev.url}`);

    if (!CATEGORIES.includes(ev.category)) at(`unknown category "${ev.category}"`);

    if (!isObj(ev.price)) at("missing price");
    else if (!PRICE_TIERS.includes(ev.price.tier)) at(`unknown price tier "${ev.price.tier}"`);

    if (typeof ev.free_food !== "boolean") at("free_food must be a boolean");

    if (!isObj(ev.location)) at("missing location");
    else {
      if (!isStr(ev.location.venue)) at("missing location.venue");
      if (!isStr(ev.location.neighborhood)) at("missing location.neighborhood");
      if (!BOROUGHS.includes(ev.location.borough)) at(`unknown borough "${ev.location.borough}"`);
    }

    if (!isStr(ev.start) || Number.isNaN(Date.parse(ev.start))) {
      at("start must be an ISO timestamp");
    } else {
      const d = dayIndex(eventDay(ev));
      if (d < startDay || d > endDay) at(`start ${ev.start} falls outside the week window`);
    }
    if (ev.end != null && Number.isNaN(Date.parse(ev.end))) at("end must be null or an ISO timestamp");
    if (typeof ev.all_day !== "boolean") at("all_day must be a boolean");

    if (!isObj(ev.prereqs)) at("missing prereqs");
    else if (typeof ev.prereqs.rsvp !== "boolean") at("prereqs.rsvp must be a boolean");

    if (!isStr(ev.source)) at("missing source");
  });

  return errors;
}

// Deterministic id so the same event keeps its anchor across regenerations.
export function slugId(title, dateOnly) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${dateOnly}-${slug}`;
}
