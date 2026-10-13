# repiq

Personal workout tracker (Dutch UI). Next.js 16 App Router, React 19, Prisma 6 on Postgres, next-auth v4 (email + password, JWT), QStash + web-push notifications, Tailwind 4, lucide-react, motion. Deployed on Vercel as project `workout-tracker` (team `jiram`).

Design (do not restyle): lavender `#baa3d0` background, near-black `#141416` rounded cards, Anton display font with Inter text, lucide icons, floating pill bottom bar, Dutch copy.

## Setup

```bash
npm install
cp .env.example .env   # fill in values, see below
npx prisma migrate deploy
npm run dev            # webpack dev server (Serwist needs webpack builds)
```

`npm run build` runs `prisma generate && prisma migrate deploy && next build --webpack`. Vercel runs the same command, so migrations apply on every deploy. **Never use `prisma db push` against production.** Builds use `--webpack` because Serwist does not support Turbopack yet.

## Environment

Copy `.env.example`. Everything except `VERCEL_AUTOMATION_BYPASS_SECRET` is required in production. `ALLOW_MEMORY_RATELIMIT` is test-only (see below) and must never be set in production.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (pooled EU URL recommended, see Regions) |
| `NEXTAUTH_SECRET` | Signs the session JWT |
| `NEXTAUTH_URL` | Public origin next-auth uses for callbacks |
| `APP_URL` | `https://` origin used to schedule rest-timer callbacks |
| `CRON_SECRET` | Bearer token for the morning notification cron (missing = reject) |
| `QSTASH_TOKEN` | Publishes delayed rest-timer jobs |
| `QSTASH_CURRENT_SIGNING_KEY` | Verifies QStash signatures (missing = reject) |
| `QSTASH_NEXT_SIGNING_KEY` | Verifies the next QStash signing key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser push subscription key |
| `VAPID_PRIVATE_KEY` | Signs web push messages |
| `VAPID_SUBJECT` | `mailto:` contact required by web push. No default is built in |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis for rate limiting (missing = fail closed in prod) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Lets QStash reach a deployment protected by Vercel Authentication |
| `ALLOW_MEMORY_RATELIMIT` | Test-only escape hatch for local e2e (`1` = in-memory fallback) |

### Rate limiting

Sign-in: 5 attempts per 15 minutes, enforced per email **and** per IP. Sign-up: 3 per hour per IP. Dutch message: "Te veel pogingen. Probeer het later opnieuw." Backed by `@upstash/ratelimit` + `@upstash/redis`; without the Upstash vars the app fails closed in production (in-memory fallback only in dev/test, or with `ALLOW_MEMORY_RATELIMIT=1`).

## Backup before any migration

```bash
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```

Keep the dump until the deploy is verified. All schema changes are additive, nullable or defaulted, and never drop user data.

## Regions and connection pooling

Vercel functions run in `fra1` (see `vercel.json`), next to the users in the Netherlands. Move the Postgres database to an EU region too if it isn't already:

1. Create a new EU (e.g. `eu-central-1` / Frankfurt) Postgres in the database provider.
2. `pg_dump` the old database and restore into the new one.
3. Update `DATABASE_URL` in Vercel env vars (production) and locally.
4. Redeploy and verify, then decommission the old database.

Use a single Prisma client instance (`lib/prisma.ts`, module-level singleton reused by warm serverless functions). For serverless, point `DATABASE_URL` at a pooled connection string (PgBouncer, e.g. Supabase/Neon pooler) with a low connection limit (`connection_limit=1&pgbouncer=true`); use the direct URL only for migrations.

## Migrations on the existing production database

The production database was created with `prisma db push`, so it has the tables but no `_prisma_migrations` history. Do not let the baseline migration create those tables again.

Before the release that contains `prisma/migrations/20260930180000_review_fixes` starts serving traffic, run this once against the production `DATABASE_URL`:

```bash
npx prisma migrate resolve --applied 20260929120000_baseline
npx prisma migrate deploy
```

`migrate resolve` records the baseline as already applied and does not execute it. `migrate deploy` then runs only the review migration (adds `User.sessionVersion`, replaces `User.restMessageId` with a `RestTimer` row per device, adds indexes, dedupes before unique indexes).

Later migrations (e.g. `20261013120000_workout_sessions`) apply with `npx prisma migrate deploy` only. That migration is additive and backfills safely: exercise library defaults (`defaultSets`, `repGoal`, `restSeconds`, `archived`), per-plan values copied into `PlanExercise` overrides (`setsOverride`, `restOverride`), per-plan order renumbered before the unique order constraint (an exercise may now appear twice per plan), `LogEntry.weight` nulled for non-weight exercises, `WorkoutLog.status` (`in_progress`/`finished`/`abandoned`, old rows default `finished`), `RestTimer.status` (`pending`/`sent`/`cancelled`/`failed`) + session link, and `User.lastMorningSentDate`.

A brand-new database can skip `migrate resolve` and run `npx prisma migrate deploy` only. Vercel runs `prisma migrate deploy` during the build.

## How it works

- **Exercises** (`/exercises`): personal library with type (gewicht / lichaamsgewicht / statisch), default sets, rep goal (reps, seconds for hold), rest seconds, archive flag. Renaming keeps history: stats and placeholders key on `exerciseId`, the name is only a snapshot.
- **Plans** (`/plans/[id]`): per-placement overrides for sets, rep goal and rest fall back to exercise defaults. One exercise may appear twice; order is unique per plan. Linked from `/schedule`.
- **Workout** (`/workout/active?planId=`): starting creates a server-side session (`in_progress`); reopening resumes it from the server on any device. Every set saves immediately via server action (optimistic UI + IndexedDB outbox that retries offline; localStorage is only a cache). One exercise per screen (`oefening X van N`, `set Y van Z`, previous/next/skip), weight input only for weight exercises, seconds for hold, placeholders from that exercise's last set plus "zelfde als vorige keer". Sets can be unchecked (edit), deleted, or added. Finish → `finished`; abandon (after confirm) → `abandoned`. Both cancel only pending notification rows of that session.
- **Rest timer**: countdown from the stored end timestamp, Skip only (`OVERSLAAN`). Server-side QStash scheduling with signed callback; each timer tracked (`pending`/`sent`/`cancelled`/`failed`, sent only if ≥1 push succeeded). Push endpoints never move between users. Fail closed on missing keys; scheduling failures never break set logging.
- **Morning reminder**: crons at 05:00/06:00/07:00 UTC; sends only when Amsterdam local time is 07:00, exactly once per user per day (`lastMorningSentDate` + dedupe key, covers CET and CEST).
- **Stats** (`/analytics`): volume per week and per plan, workouts per week, current/longest streak against the schedule, per-exercise progress chart (top weight, e1RM, best reps/hold), full workout history with per-workout detail.
- **Security**: Zod validation on all actions/routes, all queries scoped to the session user, CSP + `X-Content-Type-Options` + `Referrer-Policy` + `Permissions-Policy` + `frame-ancestors 'none'` in `next.config.ts`. Auth stays on next-auth v4: v5 changes the credentials/JWT/session callback surface our custom `sessionVersion` revocation relies on, so the upgrade is deferred as too risky for live sessions.
- **PWA**: Serwist worker (`app/sw.ts`, built to `public/sw.js`, gitignored) keeps the push + `notificationclick` handlers; precached app shell; network-only for `/api` and auth routes; NetworkFirst (3s) for page navigations so dynamic pages never serve stale when online, with a cached fallback offline. Sign-out clears caches, the IndexedDB outbox and local storage. Installable with `apple-touch-icon.png` (180px) + favicon + manifest icons.

## Testing push

- **iPhone**: open the site in Safari, Share → Add to Home Screen, open the installed app, accept notifications there. Web push only works from the Home Screen app, not the browser tab.
- **Android**: open the site in Chrome → menu → Add to Home screen (or the install prompt) → accept notifications.
- Rest timer: log a set during a workout; a "Rust voorbij" push arrives after the rest period (Skip cancels it). Morning reminder: sent at 07:00 Amsterdam time on scheduled training days.

## Testing

```bash
npm run lint          # eslint
npx tsc --noEmit      # types
npm test              # vitest unit tests
npm run build         # prisma generate + migrate deploy + next build --webpack
npm run e2e           # Playwright full flow (needs local Postgres, see below)
```

Playwright e2e (`e2e/full-flow.spec.ts`, Chromium): sign up → onboarding → exercise (bodyweight) → plan (added twice) → schedule → workout one-exercise-at-a-time (no weight field, placeholders, Skip-only timer) → finish → second workout (placeholders, same-as-last) → stats. It needs Postgres:

```bash
docker run --name workout-e2e -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=workout_e2e -p 5433:5432 -d postgres:16
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/workout_e2e" npx prisma migrate deploy
npm run build   # with the e2e env from playwright.config.ts
npm run e2e
```

`playwright.config.ts` builds the env (dummy secrets, `ALLOW_MEMORY_RATELIMIT=1`) and starts `next start` on port 3100.

## Deploying

Push to `main` (Vercel auto-deploys; build runs migrations). Checklist: env vars set (no `ALLOW_MEMORY_RATELIMIT`), `DATABASE_URL` pooled EU, `APP_URL`/`NEXTAUTH_URL` on the public origin, VAPID + QStash + Upstash keys present, crons active. Lighthouse mobile, measured locally with `npx lighthouse` (production build, Moto G profile): `/login` scores performance 95 / accessibility 96 / best practices 100 / SEO 91. No pre-change baseline exists (never measured before this work). Authenticated pages (home, workout, stats) need a production run against real data: log in, then run Lighthouse mobile on `/`, `/workout/active?planId=<id>` mid-workout, and `/analytics`. Target 90+.
