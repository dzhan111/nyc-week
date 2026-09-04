# nyc-week

A weekly rundown of NYC events, researched by Claude and published to GitHub Pages.

## The one rule

**The model produces data, never HTML.** `scripts/fetch-week.mjs` writes a JSON file;
`site/build.mjs` renders every JSON file into the site. Keep that split. It means the
whole archive can be restyled with one build, and a malformed model response can't
corrupt the published markup.

## Layout

| Path | What it does |
|---|---|
| `prompts/research.md` | The research prompt. Edit here to change *what* gets found — no code change needed. |
| `scripts/validate.mjs` | Schema checks, shared by the fetcher and the build. The only gate between a bad response and the live site. |
| `scripts/fetch-week.mjs` | Calls the Claude API with web search, writes `data/weeks/<week_start>.json`. |
| `site/build.mjs` | All week JSON → `dist/`. Zero dependencies, on purpose. |
| `site/app.js` | Client-side filters and the relative day labels ("Today"/"Tomorrow"). |
| `data/weeks/*.json` | The archive. Append-only — never rewrite a past week. |
| `data/fixtures/` | Synthetic data for testing the build. Never published as real listings. |

## Commands

```bash
npm run build:fixture   # build from the sample data, no API spend
npm run serve           # serve dist/ at localhost:8231
npm run research:dry    # real API call, prints results, writes nothing
npm run research        # real API call, writes data/weeks/<today>.json
npm run build           # build from real data
```

## Conventions

- **Node 20+, ESM.** `__dirname` doesn't exist — derive paths from `import.meta.url`.
- **Dates are NYC dates.** Event timestamps carry an explicit `-04:00`/`-05:00` offset, and
  the code reads the wall-clock time out of the string rather than going through `Date`,
  so a UTC CI runner can't shift an event by a day. `nycToday()` and `todayISO()` both
  anchor to `America/New_York`.
- **Relative day labels are computed in the browser**, not at build time — the site is
  rebuilt weekly, so a baked-in "Today" would be wrong by day two.
- **Adding a category** means updating `CATEGORIES` and `CATEGORY_LABELS` in
  `scripts/validate.mjs`, the chip list in `site/build.mjs`, and `prompts/research.md`.

## API details that matter

- Model is `claude-opus-5` with adaptive thinking and `effort: "high"`.
- Web search is the server-side tool `web_search_20260209`. Don't also declare
  `code_execution` — that variant runs it internally and a second execution environment
  confuses the model. `max_uses` is the main cost lever.
- The call uses `client.beta.messages.stream` because `betas` and `fallbacks` are only
  accepted on the beta namespace.
- Results come back through a `strict: true` client tool (`submit_week`) rather than
  `output_config.format`, since this request also carries a server tool.
- `stop_reason: "pause_turn"` is expected on long research runs — the server tool loop
  pauses every 10 iterations. Resume by appending the assistant turn and re-sending, with
  no extra user message.

## Workflows

`research.yml` (weekly, Thursday) writes and commits the week, then **calls** `deploy.yml`
directly. It has to call it: a push made with the default `GITHUB_TOKEN` does not trigger
other workflows, and the calling job re-declares `pages`/`id-token` permissions because a
reusable workflow only receives what its caller holds.
