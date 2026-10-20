# Keu

Book a pool, snooker or billiards table at a pool café in Delft, a bit like Playtomic for padel.
The demo venue is **Pool and Billiards Delft** (Voorhofdreef 1): prices and hours from their
site, table counts estimated (8 pool, 3 snooker, 2 biljart). The first demo venue, Poolcafé de
Peper, declined and was removed.

- **Book a table** (public, no login): pick a game, a day, how long, a time and a table, then
  name, phone, players and payment. Availability comes from the real bookings in the database.
  Online booking stops at the venue's last start time (21:00); later guests walk in.
- **Venue view** (behind a PIN): a timeline of all tables per day. Tap a booking to mark it
  arrived, no-show or cancelled. Tap an empty spot to add a phone or WhatsApp booking. Settings
  for walk-in tables, the last online start time and weekend prepayment.

It's still labelled a concept demo in the app (badge and footer) until the venue agrees to use it.
The original single-file prototype is in [demo/keu-demo.html](demo/keu-demo.html).

## Stack

- Vite + React + TypeScript, plain CSS (the prototype's design, in [src/styles.css](src/styles.css))
- Supabase (Postgres) through `@supabase/supabase-js`. No backend of our own.
- GitHub Pages hosting via GitHub Actions. Hash routing (`#/`, `#/venue`) and a relative
  base path, so it works under any repo name.

```
src/
  App.tsx              header, tabs, routing, shared state
  i18n.ts              EN/NL strings and date/money formatting
  lib/api.ts           every database call
  lib/supabase.ts      Supabase client (+ venue session header)
  lib/rules.ts         prices, prepay, availability helpers
  player/              booking flow
  venue/               PIN screen, timeline, sheets, settings
supabase/
  migrations/          database schema: tables, constraints, RLS, functions, venue data
  dev-seed.sql         optional fake bookings for demos
```

## Set up Supabase

The schema lives in [supabase/migrations/](supabase/migrations/). Supabase's GitHub integration
applies new files there on every push to `main`, and records which ones it has run.

1. Push this repo to GitHub first (see [Deploy](#deploy-to-github-pages)).
2. Create a project at [supabase.com](https://supabase.com) (pick an EU region, e.g. Frankfurt).
   Under **GitHub (optional)** choose this repo. For an existing project, use
   **Project Settings → Integrations → GitHub** instead. Set the Supabase directory to `.` (the
   repo root), the production branch to `main`, and turn on **Deploy to production**.
3. Check the first migration ran: **Table Editor** should list `venues`, `tables`, `bookings`
   and the rest. If it's empty, push a commit to `main` (or use **Sync** in the integration settings).
   - No GitHub integration? Paste each file in [supabase/migrations/](supabase/migrations/), oldest
     first, into **SQL Editor → New query** and run it once instead. Don't do both, or the second
     run fails on tables that already exist.
4. Set the venue PIN. In **SQL Editor → New query**, with your own PIN or password in place of
   `change-me` (longer is safer; the login locks for 5 minutes after 5 wrong tries):
   ```sql
   update public.venue_settings
      set pin_hash = extensions.crypt('change-me', extensions.gen_salt('bf'))
    where venue_id = (select id from public.venues where slug = 'pool-and-billiards-delft');
   ```
   Run the same statement again any time to change it. Never put the PIN in a migration file:
   the repo is public.
5. Optional, for demos: run [supabase/dev-seed.sql](supabase/dev-seed.sql) in the SQL Editor to fill
   the next 7 days with believable bookings. Remove them later with
   `delete from public.bookings where phone = '06 0000 0000';`
6. Copy your keys from **Project Settings → API Keys** (or the **Connect** button): the
   **Project URL** and the **anon** (or **publishable**) key. Never use the `service_role`/secret key
   in the app.

### Changing the database later

Add a new file such as `supabase/migrations/20261101090000_add_student_price.sql` with only the
change (`alter table …`), commit and push. Never edit a migration that has already run.

### How access works

There is no Supabase Auth yet. Row Level Security (bottom half of the init migration) does the work:

- Anyone can read venues, tables, opening hours and the public settings. They can see *which*
  slots are taken through the `busy_slots()` function, but never names or phone numbers. They
  can insert app bookings, which the database forces to be unpaid, not on walk-in tables, and
  within two weeks.
- Venue staff log in with the PIN. `venue_login()` checks it against a bcrypt hash and returns a
  random session token (valid 30 days). The app sends it as an `x-venue-token` header, and the
  policies only let requests with a live token read or update that venue's bookings and settings.
- An exclusion constraint makes double bookings impossible, even with two phones booking at
  the same moment. A trigger keeps bookings inside opening hours.

## Run locally

Needs Node 20.19+ (22 or 24 recommended).

```bash
npm install
cp .env.example .env   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Open http://localhost:5173. To try it on your phone on the same Wi-Fi, run
`npm run dev -- --host` and open the "Network" URL it prints.

Other scripts: `npm run build` (typecheck + production build into `dist/`), `npm run lint`,
`npm run preview` (serve the build).

## Deploy to GitHub Pages

1. Create an empty repository on GitHub and push this one to it (see below).
2. **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main` (or run the workflow from the **Actions** tab). The
   [deploy workflow](.github/workflows/deploy.yml) builds and publishes to
   `https://<your-username>.github.io/<repo-name>/`.

The anon key ends up in the public JavaScript bundle. That's expected for Supabase; RLS is what
protects the data. Keeping it in secrets just keeps it out of the git history.

## Not done yet

- **iDEAL prepayment** is a UI option only. Every booking is stored with `paid = false` and the
  player is told to pay at the bar. Mollie or Stripe comes later.
- **Reminder texts** and **cancelling from the app** are mentioned in the confirmation text but
  not built.
- **No spam protection** on public bookings beyond the database rules. Add rate limiting or a
  captcha before real traffic.
- **One venue** (`pool-and-billiards-delft`, set in `src/App.tsx`). The schema already supports more.
- **Table counts are estimates.** Correct them once known, e.g. add a migration that inserts or
  deletes rows in `public.tables` for the venue.
- Times use the phone's clock and time zone, which is fine while everyone is in Delft.
