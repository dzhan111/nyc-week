# nyc-week

A small, dependency-free static site (`index.html` + `styles.css` + `app.js` + `data/events.json`) showing free/cheap NYC events, sports meetups, hobby nights, and free-food pop-ups for the next 7 days — grouped by day and category, with light/dark mode and category filters.

No build step, no framework — three files reading one JSON file. That's the whole app.

## Deploy to Vercel (one-time, ~2 minutes)

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`dzhan111/nyc-week`).
2. Leave every setting default — no build command, no output directory override, no environment variables needed. Vercel serves it as-is.
3. Deploy. Every future push to `main` auto-redeploys, live in seconds.

Or from the CLI, from inside this repo: `npx vercel --prod`.

## How "daily updating" actually works

This site is just a renderer — it displays whatever is in `data/events.json`. Keeping that file fresh is a research task (there's no single API covering free pop-ups, pickup sports, museum free-nights, and street fairs), not something a serverless function can do well on its own.

**Not set up yet.** To make this genuinely update on its own, a daily automated research run would regenerate `data/events.json` and push it here, which Vercel then auto-deploys. That needs a GitHub token scoped to just this repo — ask for that whenever you want it wired up.

**In the meantime**, the site stays accurate day-to-day even without a refresh: `app.js` computes "Today / Tomorrow / In N days" live from the visitor's clock and hides any day that's already passed — it just has a shrinking window until the data file is regenerated.

## Editing the data by hand

Open `data/events.json`. Each entry in `days[]` is one calendar date; each event has:

```json
{
  "title": "...", "link": "...", "description": "...",
  "priceTier": "free | $ | $$ | $$$",
  "priceNote": "human-readable price, e.g. '$5 drop-in fee'",
  "location": "neighborhood + venue",
  "schedule": "date/time details",
  "prereqs": "RSVP? skill level? age restriction? gear?",
  "categories": ["cost", "sports", "hobby", "celebration", "unique", "food"],
  "freeFood": true | false
}
```

Recurring, non-dated things (pickup chess, Staten Island Ferry, etc.) go in the top-level `flexible[]` array instead of under a specific day.
