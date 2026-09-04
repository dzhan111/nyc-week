# nyc-week

What's on in New York over the next seven days — researched automatically once a week and
published as a static site, with every past week kept in the archive.

**Live:** https://dzhan111.github.io/nyc-week/

Each Thursday a GitHub Action asks Claude to research events across six categories
(cheap fun, sports to join, hobbies, celebrations, NYC-unique things, and free food),
writes the results to `data/weeks/`, and rebuilds the site.

## Local development

```bash
npm install
npm run build:fixture && npm run serve   # http://localhost:8231
```

That uses sample data and costs nothing. To do a real research run you need an
`ANTHROPIC_API_KEY` in your environment; `npm run research:dry` prints the results
without writing anything.

## Setup

1. Add `ANTHROPIC_API_KEY` under Settings → Secrets and variables → Actions.
2. Set Settings → Pages → Source to **GitHub Actions**.
3. Run the **Research week** workflow manually once to populate the first week.

See [CLAUDE.md](CLAUDE.md) for architecture notes.
