# TripSplit

Track shared expenses on a group trip and work out who owes whom at the end.

- One person starts a trip (any time before or during it) and invites friends by link or email.
- Anyone on the trip can log expenses in any currency. Each expense is split equally, by shares, or by exact amounts among any subset of people.
- The **Balances** tab shows each person's net position and the fewest payments needed to settle up. Payments can be recorded as they happen.
- The **History** tab records every change made by anyone (who did it, when, and what changed). Deleted expenses and payments can be restored, and edits can be reverted. Each expense also shows its own history.

## Stack

Next.js 16 (App Router, server actions), Drizzle ORM + Postgres, Auth.js with Google SSO, Nodemailer for SMTP invites, Tailwind v4. Runs as three containers: `app`, `db`, and `cloudflared`.

## Deploying

1. **Google OAuth client.** In Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID of type *Web application*. Add this authorized redirect URI:
   `https://<your-hostname>/api/auth/callback/google`
2. **Cloudflare tunnel.** In Zero Trust → Networks → Tunnels, create a tunnel. Add a public hostname pointing to service `http://app:3000`. Copy the tunnel token.
3. **Configure.** `cp .env.example .env` and fill it in. Generate `AUTH_SECRET` with `openssl rand -base64 32`. Set `AUTH_URL` to your public hostname; invite links are built from it.
4. **Run.** `docker compose up -d --build`

Database migrations run automatically when the app starts.

## How invites work

- **Invite link** (People tab): anyone who opens it and signs in with Google joins the trip. The owner can reset the link.
- **Add by email**: creates a pending member and, if SMTP is configured, emails them the link. When they sign in with that Google address, they're linked automatically.
- **Placeholder people**: add someone by name only to include them in splits right away. When they join through the link, they can pick "I'm already on the list" to claim that spot.

## Money handling

- Amounts are stored as integer minor units (cents, yen, …) and never as floats.
- Each expense stores its original currency, the exchange rate to the trip's base currency, and the converted amount. Rates are pre-filled from the ECB via [Frankfurter](https://frankfurter.dev) and can be edited to match what a card actually charged.
- Splits are allocated with the largest-remainder method, so the parts always add up exactly to the expense total.
- The base currency can't be changed after the first expense is added.

## History

Every create, edit, and delete of an expense, payment, person, or trip setting is written to the append-only `trip_event` table. For expenses and payments, the log entry is written in the same transaction as the change. Each row includes a full before/after JSON snapshot, with people's names stored alongside their ids so the history stays readable after renames. A restore or revert is logged as an event too, so nothing is ever lost. Nothing in the app deletes history rows. They're only removed when the whole trip is deleted.

## Live updates

Open trip pages update by themselves when someone else makes a change. A trigger on `trip_event` runs `pg_notify('trip_events', …)` when the change commits. The app keeps one `LISTEN` connection (`src/lib/realtime.ts`) and pushes changes to browsers over Server-Sent Events (`/api/trips/[id]/events`). The browser then soft-refreshes server data, which keeps anything half-typed in a form, and shows a toast such as "Bob added an expense". A heartbeat every 25s keeps the stream open through Cloudflare. Pages also catch up after reconnecting and when a phone brings the tab back to the foreground.

## Local development

Requires Node 22+ and Docker.

```sh
npm install
npm run dev:start      # starts Postgres + Mailpit, then the Next dev server
npm run db:seed        # optional: load a sample trip (re-runnable)
```

Open http://localhost:3000. Migrations run automatically when the server starts.

| | |
|---|---|
| App | http://localhost:3000 |
| Mailpit (catches all invite emails) | http://localhost:8025 |
| Postgres | `postgres://tripsplit:tripsplit@localhost:5432/tripsplit` |

**Signing in without Google.** In the dev server, the sign-in page shows a *Dev login* panel. One click signs you in as Alice, Bob, or Carol, who are the members of the seeded trip. You can also enter any email. It creates a real database session, the same as Google sign-in would. To be two people at once, use a private window or a second browser profile. The panel and its `/api/dev-login` endpoint only work when `NODE_ENV=development` and `DEV_LOGIN=true`, and production builds return 404.

**Real Google sign-in locally (optional).** Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to `.env.development.local` (gitignored). Use the redirect URI `http://localhost:3000/api/auth/callback/google`.

### Scripts

| | |
|---|---|
| `npm run dev:start` | `dev:up`, then `next dev` |
| `npm run dev:up` / `dev:down` | start / stop the dev services (data is kept) |
| `npm run dev:reset` | wipe the dev database, restart services, and re-seed |
| `npm run db:seed` | (re)create the sample trip |
| `npm run db:generate` | create a migration after editing `src/db/schema.ts` |
| `npm run db:studio` | browse the dev database with Drizzle Studio |
| `npm test` / `npm run typecheck` | unit tests / type check |

Dev config defaults live in `.env.development`, which is committed and has no real secrets. Personal overrides go in `.env.development.local`.

## Layout

```
src/
  auth.ts                 Auth.js config (Google, Drizzle adapter, database sessions)
  instrumentation.ts      runs migrations on server start
  db/schema.ts            all tables
  lib/money.ts            currency parsing/formatting, conversion, allocation
  lib/balances.ts         net balances + settle-up suggestions
  lib/members.ts          requireMember() access check used by every trip page/action
  lib/history.ts          audit-log snapshots, logging, and change descriptions
  app/actions/            server actions (trips, members, expenses, settlements)
  app/trips/[tripId]/     Expenses, Balances, People, History, Settings tabs
  app/join/[token]/       invite-link landing page
  app/api/dev-login/      dev-only sign-in bypass
scripts/seed.ts           sample data
compose.dev.yml           dev services (Postgres, Mailpit)
```
