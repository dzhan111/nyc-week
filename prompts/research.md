Research NYC events happening over the next 7 days, starting today, and submit them
with the `submit_week` tool.

## Who this is for

A recent grad living in NYC. Budget-conscious but willing to spend occasionally on
something special. Skip expensive restaurant recommendations unless genuinely unique.
Skip anything needing pricey reservations, and anything where the value doesn't match
the cost — unless it's a rare or special occasion.

## Categories

Find events across all six. Aim for roughly 5-12 per category, but quality beats quantity.

- `cost-effective` — free or cheap: walks, markets, free museum nights, outdoor movies.
  Occasional paid concerts and big events are fine.
- `sports` — pickup or community sports to actually join: soccer, basketball, volleyball,
  running clubs and races, climbing meetups. Other sports welcome as long as they involve
  real activity, not spectating.
- `hobby` — chess nights, conventions, trivia, board game nights, park screenings,
  block parties, farmers markets, maker fairs.
- `celebrations` — cultural celebrations, big retail sale days, seasonal festivals.
- `nyc-unique` — things a new NYC resident shouldn't miss, even if touristy-adjacent,
  as long as they're genuinely worthwhile and not overpriced tourist traps.
- `free-food` — store openings, brand activations, tastings, sample days, food festivals
  with free entry, giveaways, or any event where free food is a notable draw.

## Sources to search

NYC.gov events calendar, Time Out New York, NYC Parks events, Meetup.com, Eventbrite NYC,
NYC Runs, local sports leagues (NYC Social, Big City Basketball, Volo Sports), Secret NYC,
NYC for Free, r/AskNYC, r/nyc, r/FoodNYC, and neighborhood or borough-specific sources
where useful.

## Accuracy rules — these matter more than coverage

This output is published to a public website without human review before it goes live.

- **Only include events you actually found and verified through search.** Never invent an
  event, a date, a venue, or a URL. A short, accurate list is a success; a long list with
  three fabricated entries is a failure.
- **Every `url` must be a real page you retrieved** that describes this specific event (or
  its recurring series). If you can't produce a working link, drop the event.
- **Only include events whose date you confirmed** falls inside the window. If a source is
  vague about timing, drop it rather than guessing.
- For recurring events (a weekly pickup game, a regular trivia night), use the specific
  occurrence inside this window, and say it's recurring in the description.
- If a detail is unknown, use `null`. Do not fill fields with plausible-sounding guesses —
  an empty `gear` field is fine, an invented one is not.

## Field notes

- `description` — 1-2 sentences. What it is and why it's worth going. No marketing voice.
- `price.tier` — `free`, `$` (under ~$20), `$$` (~$20-60), `$$$` (over ~$60).
- `price.note` — short qualifier when useful ("free entry, food sold separately").
- `free_food` — true only when free food is an actual draw, not incidental.
- `location.borough` — one of: Manhattan, Brooklyn, Queens, The Bronx, Staten Island, Multiple.
- `start` / `end` — ISO 8601 with the correct NYC UTC offset, e.g. `2026-09-04T18:00:00-04:00`.
  Use `end: null` when the end time isn't stated.
- `all_day` — true for festivals and markets that run most of the day.
- `prereqs` — `rsvp` is required and boolean. `skill_level`, `gear`, `age`, and `wait`
  are free text or null. Note lines and waits when they're a real factor.
- `source` — the publication or site you found it on, e.g. "Time Out New York".
- `id` — `YYYY-MM-DD-kebab-title`, matching the event's own date.

Spread events across the week and across boroughs where you can. Favor things that are
distinctly worth a New Yorker's evening over generic listings.
