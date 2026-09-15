# immersemoar

One account to track everything you consume in Japanese — anime, manga, visual novels, light novels, books, movies, series, YouTube, podcasts, drama CDs, games — with the language-learning metrics layered on top: **hours, characters, streaks, levels, goals, rankings and clubs**.

Think Toggl for immersion, with a library attached.

## What it does

- **Timer + backdated logging.** Start a timer against anything in your library (or a free-form label), or log a past session with duration and native units (episodes, chapters, pages, characters…).
- **Log in an instant** (`/log/new`): pick a medium → search your library and AniList / VNDB / TMDB / Google Books → fill in the details. New titles are added to your library automatically, with covers, Japanese titles and known lengths.
- **Library** with status (planning / in progress / paused / finished / dropped), progress in native units capped at the known total, ratings, notes. Sessions bump progress automatically; hitting the total auto-finishes.
- **History**: any day, week, month, year or custom range; per-day/week/month charts; heatmap; by-type and top-item breakdowns.
- **Progression**: XP (1 XP per minute, so every medium is worth the same), overall / reading / listening levels, current and longest streak, daily averages, reading speed (chars/hour), month-over-month comparison.
- **Goals**: "1000 hours in 2026", "2M characters of VNs this month" — any metric, any medium, any period, with an on-pace marker.
- **Ranking**: global and per-medium leaderboards (week / month / year / all time), public profile pages, opt-out in settings.
- **Clubs**: public or private (join code), tagged, up to 100 members, member leaderboard, and voting on what to consume together next.
- **Texthooker**: connect **LunaTranslator** (`ws://localhost:2333/api/ws/text/origin`) or **Textractor** (`ws://localhost:6677`) from the browser; lines stream in, characters and *active* time (idle gaps excluded) are counted, and one click saves the session against your VN.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind v4 + shadcn/ui (Base UI) · Drizzle ORM · Postgres (PGlite embedded for local dev) · Better Auth (email + password).

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then set BETTER_AUTH_SECRET (see the file)
pnpm db:push                 # creates ./.pglite with the schema
pnpm dev
```

Open http://localhost:3000, create an account, add something to your library, start the timer.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | yes | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` locally; your public URL in production |
| `DATABASE_URL` | production | Postgres connection string. Unset = embedded PGlite in `./.pglite` |
| `TMDB_API_KEY` | optional | Enables movie/series search. Free at themoviedb.org → Settings → API |
| `GOOGLE_BOOKS_API_KEY` | optional | Books search works without it (rate-limited) |

AniList and VNDB need no keys.

### Local database (PGlite)

Without `DATABASE_URL` the app uses an embedded Postgres in `./.pglite`. It is **single-process**: stop `pnpm dev` before running `pnpm db:push` or `pnpm build`, otherwise the data directory can be corrupted (delete `./.pglite` and push again if that happens).

### Scripts

| Script | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` / `pnpm start` | production |
| `pnpm db:push` | apply the Drizzle schema (dev) |
| `pnpm db:generate` / `pnpm db:migrate` | SQL migrations for production |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm lint` / `pnpm typecheck` | |

## Data model

```
media_items          shared across users; deduplicated on (source, source_id)
library_entries      user × item: status, progress (native unit), rating, notes
immersion_sessions   the core primitive: started_at, duration, optional item, optional amount + unit
active_timers        one running timer per user
goals                metric (time | unit), optional media type, date range, target
clubs / club_members / club_picks / club_pick_votes
```

Time is the common denominator (all sessions have a duration); native units stay per-medium. Days are bucketed in the **user's timezone** (captured at signup, editable in settings).

## Texthooker notes

The Texthooker page opens a WebSocket **from your browser to your own machine**; nothing about your game text touches the server until you press *Save session*. Each message is treated as one line (plain text, or JSON with a `text` field). Characters are counted excluding whitespace and punctuation. Gaps between lines longer than the idle threshold (default 3 min) are not counted as reading time.
