// Researches the coming week's NYC events and writes data/weeks/<week_start>.json.
//
// Runs unattended in CI, so it fails loudly rather than writing anything it isn't
// sure about: a response that doesn't validate never reaches the repo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { validateWeek, CATEGORIES, PRICE_TIERS, slugId } from "./validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data/weeks");
const MODEL = "claude-opus-5";
const MAX_SEARCHES = 25;      // main cost lever: web search bills per use
const MAX_CONTINUATIONS = 6;  // server tool loop pauses every 10 iterations

// ------------------------------------------------------------------- helpers

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const argValue = (f, d) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};

// "Today" in New York, independent of where the runner is. GitHub's runners are
// UTC, so without this a run scheduled at 11:00 UTC in winter would be a day off.
function nycToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(dateOnly, n) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// ------------------------------------------------------------- tool contract

const nullableString = { type: ["string", "null"] };

const eventSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    url: { type: "string" },
    description: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    price: {
      type: "object",
      properties: {
        tier: { type: "string", enum: PRICE_TIERS },
        note: nullableString,
      },
      required: ["tier", "note"],
      additionalProperties: false,
    },
    free_food: { type: "boolean" },
    location: {
      type: "object",
      properties: {
        venue: { type: "string" },
        neighborhood: { type: "string" },
        borough: {
          type: "string",
          enum: ["Manhattan", "Brooklyn", "Queens", "The Bronx", "Staten Island", "Multiple"],
        },
      },
      required: ["venue", "neighborhood", "borough"],
      additionalProperties: false,
    },
    start: { type: "string" },
    end: nullableString,
    all_day: { type: "boolean" },
    prereqs: {
      type: "object",
      properties: {
        rsvp: { type: "boolean" },
        skill_level: nullableString,
        gear: nullableString,
        age: nullableString,
        wait: nullableString,
      },
      required: ["rsvp", "skill_level", "gear", "age", "wait"],
      additionalProperties: false,
    },
    source: { type: "string" },
  },
  required: [
    "id", "title", "url", "description", "category", "price",
    "free_food", "location", "start", "end", "all_day", "prereqs", "source",
  ],
  additionalProperties: false,
};

// A strict client tool rather than output_config.format: this request also carries
// the server-side web search tool, and a strict tool is the combination the SDK
// documents working alongside other tools. `strict: true` gives the same schema
// guarantee. We never return a tool_result — the call itself is the payload.
const submitWeek = {
  name: "submit_week",
  description:
    "Submit the researched events for the week. Call this exactly once, after you have " +
    "finished searching. Include only events you verified through search.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      events: { type: "array", items: eventSchema },
    },
    required: ["events"],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------- main

async function research(weekStart, weekEnd) {
  const client = new Anthropic();
  const promptBody = fs.readFileSync(path.join(ROOT, "prompts/research.md"), "utf8");

  const userMessage =
    `Today is ${weekStart}. The window is ${weekStart} through ${weekEnd} inclusive.\n\n` +
    promptBody;

  const messages = [{ role: "user", content: userMessage }];
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES },
    submitWeek,
  ];

  let searches = 0;

  for (let turn = 0; turn < MAX_CONTINUATIONS; turn++) {
    // Streaming: a research turn over dozens of search results runs long enough
    // to trip the non-streaming HTTP timeout.
    // beta namespace: `betas` + `fallbacks` are only accepted there.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools,
      messages,
    });
    const response = await stream.finalMessage();

    searches += response.content.filter((b) => b.type === "server_tool_use").length;

    if (response.stop_reason === "refusal") {
      const detail = response.stop_details ?? {};
      throw new Error(`Model declined the request (${detail.category ?? "unknown"}): ${detail.explanation ?? ""}`);
    }

    const submission = response.content.find(
      (b) => b.type === "tool_use" && b.name === "submit_week",
    );
    if (submission) {
      console.log(`Research complete after ${turn + 1} turn(s), ~${searches} searches.`);
      return submission.input;
    }

    if (response.stop_reason === "pause_turn") {
      // Server-side tool loop hit its iteration limit. Re-send with the paused
      // assistant turn appended and the server picks up where it left off. No
      // extra user message — the trailing server_tool_use block is the signal.
      messages.push({ role: "assistant", content: response.content });
      console.log(`  …paused after ~${searches} searches, resuming (turn ${turn + 2})`);
      continue;
    }

    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    throw new Error(
      `Model finished with stop_reason "${response.stop_reason}" without calling submit_week.\n` +
        `Response text:\n${text.slice(0, 2000)}`,
    );
  }

  throw new Error(`Gave up after ${MAX_CONTINUATIONS} continuations without a submission.`);
}

async function main() {
  const weekStart = argValue("--start", nycToday());
  const weekEnd = addDays(weekStart, 6);

  console.log(`Researching NYC events for ${weekStart} → ${weekEnd}…`);

  const result = await research(weekStart, weekEnd);

  const week = {
    week_start: weekStart,
    week_end: weekEnd,
    generated_at: new Date().toISOString(),
    events: (result.events ?? []).map((ev) => ({
      ...ev,
      // Regenerate ids locally so they're always well-formed and unique, rather
      // than trusting the model to keep the convention.
      id: slugId(ev.title, ev.start.slice(0, 10)),
    })),
  };

  // Deduplicate on id — the same event can surface from two sources.
  const seen = new Set();
  week.events = week.events.filter((ev) => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  const errors = validateWeek(week);
  if (errors.length) {
    console.error(`\nRefusing to write: the response failed validation (${errors.length} problems):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, week.events.filter((e) => e.category === c).length]),
  );
  console.log(`${week.events.length} events:`, byCategory);

  if (hasFlag("--dry-run")) {
    console.log("\n--dry-run: not writing. Sample:");
    console.log(JSON.stringify(week.events.slice(0, 2), null, 2));
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const dest = path.join(DATA_DIR, `${weekStart}.json`);
  fs.writeFileSync(dest, JSON.stringify(week, null, 2) + "\n");
  console.log(`Wrote ${path.relative(ROOT, dest)}`);
}

main().catch((err) => {
  // Most specific first — a 401 and a 429 need different responses from whoever
  // reads the failed workflow run.
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("Authentication failed. Is ANTHROPIC_API_KEY set correctly?");
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error("Rate limited by the API. Re-run the workflow later.");
  } else if (err instanceof Anthropic.BadRequestError) {
    console.error(`Bad request — the API rejected the call:\n${err.message}`);
  } else if (err instanceof Anthropic.APIConnectionError) {
    console.error(`Could not reach the API: ${err.message}`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`API error (status ${err.status}): ${err.message}`);
  } else {
    console.error(err.message ?? err);
  }
  process.exit(1);
});
