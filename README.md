# Keu

Book a pool or snooker table at a pool café in Delft, a bit like Playtomic for padel.
The first venue is **Poolcafé de Peper** (Peperstraat 13): 6 pool tables, 2 snooker tables.

- **Book a table** (public, no login): pick pool or snooker, a day, how long, a time and a
  table, then name, phone, players, student rate and payment. Availability comes from the real
  bookings in the database.
- **Venue view** (behind a PIN): a timeline of all tables per day. Tap a booking to mark it
  arrived, no-show or cancelled. Tap an empty spot to add a phone or WhatsApp booking. Settings
  for walk-in tables and weekend prepayment.

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
  schema.sql           tables, constraints, RLS, functions, seed data
  dev-seed.sql         optional fake bookings for demos
```

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (pick an EU region, e.g. Frankfurt).
2. In the dashboard, open **SQL Editor → New query**, paste all of
   [supabase/schema.sql](supabase/schema.sql) and click **Run**. Run it once, on a fresh project.
3. Set the venue PIN. In a new query, with your own PIN or password in place of `change-me`
   (longer is safer; the login locks for 5 minutes after 5 wrong tries):
   ```sql
   update public.venue_settings
      set pin_hash = extensions.crypt('change-me', extensions.gen_salt('bf'))
    where venue_id = (select id from public.venues where slug = 'de-peper');
   ```
   Run the same statement again any time to change it.
4. Optional, for demos: run [supabase/dev-seed.sql](supabase/dev-seed.sql) to fill the next 7
   days with believable bookings. Remove them later with
   `delete from public.bookings where phone = '06 0000 0000';`
5. Copy your keys from **Project Settings → API Keys** (or the **Connect** button): the
   **Project URL** and the **anon** (or **publishable**) key. Never use the `service_role`/secret key
   in the app.

### How access works

There is no Supabase Auth yet. Row Level Security (see the bottom half of `schema.sql`) does the work:

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
- **One venue** (`de-peper`, set in `src/App.tsx`). The schema already supports more.
- Times use the phone's clock and time zone, which is fine while everyone is in Delft.
