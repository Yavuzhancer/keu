-- Keu database schema (Supabase / Postgres), first migration.
--
-- Applied automatically by Supabase's GitHub integration on push to main
-- (each file in supabase/migrations/ runs once, in filename order). Future
-- schema changes go in new, later-timestamped files; never edit this one after
-- it has been applied.
-- Without the integration: paste this file into Dashboard → SQL Editor and run
-- it once on a fresh project (then don't also enable the integration, or it
-- will try to apply it a second time).
-- After it has run, set the venue PIN (see the bottom of this file / README).
--
-- Security model, no Supabase Auth needed:
--   * Players are anonymous. They can read venues, tables, opening hours and the
--     public settings, see which slots are taken (busy_slots(), no names), and
--     insert app bookings.
--   * Venue staff log in with a PIN via venue_login(), which returns a random
--     session token. The app sends it as the `x-venue-token` header, and the RLS
--     policies below only allow reading/updating bookings and settings when that
--     header matches a live session for the venue.

create extension if not exists pgcrypto with schema extensions;   -- crypt(), digest(), gen_random_bytes()
create extension if not exists btree_gist with schema extensions; -- uuid "=" inside the overlap constraint


-- =====================================================================
-- Tables
-- =====================================================================

create table public.venues (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  name                 text not null,
  address              text not null,
  city                 text not null,
  price_cents          int not null check (price_cents >= 0),
  student_price_cents  int not null check (student_price_cents >= 0),
  off_peak_price_cents int not null check (off_peak_price_cents >= 0), -- before 17:00 and on Sundays
  created_at           timestamptz not null default now()
);

create table public.tables (
  id       uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  type     text not null check (type in ('pool', 'snooker')),
  number   int  not null check (number > 0),
  walk_in  boolean not null default false, -- kept free for walk-ins; synced from venue_settings.hold_back
  unique (venue_id, type, number),
  unique (venue_id, id) -- lets bookings check that the table belongs to the venue
);

-- Minutes from midnight. close_minutes can run past 1440 into the next night (01:00 = 1500).
create table public.opening_hours (
  venue_id      uuid not null references public.venues (id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6), -- 0 = Sunday, like JS getDay()
  open_minutes  int not null check (open_minutes between 0 and 1439),
  close_minutes int not null check (close_minutes > open_minutes and close_minutes <= 2880),
  primary key (venue_id, weekday)
);

create table public.venue_settings (
  venue_id       uuid primary key references public.venues (id) on delete cascade,
  hold_back      int not null default 0 check (hold_back between 0 and 10), -- pool tables kept for walk-ins
  prepay_weekend boolean not null default false,
  -- Private: never readable through the API (see grants below).
  pin_hash       text, -- bcrypt; null = venue login disabled
  failed_logins  int not null default 0,
  locked_until   timestamptz
);

create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues (id) on delete cascade,
  table_id         uuid not null,
  date             date not null,
  start_minutes    int  not null check (start_minutes between 0 and 2879),
  duration_minutes int  not null check (duration_minutes between 30 and 360),
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  phone            text check (char_length(phone) <= 30),
  players          int  not null check (players between 1 and 12),
  source           text not null check (source in ('app', 'phone')),
  status           text not null default 'booked' check (status in ('booked', 'arrived', 'noshow', 'cancelled')),
  paid             boolean not null default false,
  created_at       timestamptz not null default now(),
  foreign key (venue_id, table_id) references public.tables (venue_id, id) on delete cascade,

  -- No two active bookings may overlap on the same table. Times are turned into
  -- absolute minutes (days since 2000-01-01 × 1440 + start), so a Friday 01:00
  -- booking (start 1500) also clashes with anything at Saturday 01:00.
  -- Cancelled bookings free the table; no-shows still hold it (same as the venue view).
  constraint bookings_no_overlap exclude using gist (
    table_id with =,
    int4range((date - date '2000-01-01') * 1440 + start_minutes,
              (date - date '2000-01-01') * 1440 + start_minutes + duration_minutes) with &&
  ) where (status <> 'cancelled')
);

create index bookings_venue_date on public.bookings (venue_id, date);

-- Venue login sessions. Only the sha256 of each token is stored.
create table public.venue_sessions (
  token_hash text primary key,
  venue_id   uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);


-- =====================================================================
-- Triggers
-- =====================================================================

-- Bookings must fit inside that day's opening hours.
create function public.bookings_check_hours() returns trigger
language plpgsql set search_path = '' as $$
declare
  h public.opening_hours;
begin
  select * into h from public.opening_hours
   where venue_id = new.venue_id and weekday = extract(dow from new.date);
  if not found then
    raise exception 'The venue is closed on %', new.date using errcode = 'check_violation';
  end if;
  if new.start_minutes < h.open_minutes or new.start_minutes + new.duration_minutes > h.close_minutes then
    raise exception 'Booking falls outside opening hours' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger bookings_check_hours
  before insert or update of date, start_minutes, duration_minutes on public.bookings
  for each row execute function public.bookings_check_hours();

-- hold_back = N marks the N highest-numbered pool tables as walk-in only.
-- security definer: the venue session may change settings but not tables directly.
create function public.sync_walk_in() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tables t
     set walk_in = t.id in (select p.id from public.tables p
                             where p.venue_id = new.venue_id and p.type = 'pool'
                             order by p.number desc limit new.hold_back)
   where t.venue_id = new.venue_id;
  return new;
end $$;

create trigger venue_settings_sync_walk_in
  after insert or update of hold_back on public.venue_settings
  for each row execute function public.sync_walk_in();


-- =====================================================================
-- Venue session functions
-- =====================================================================

-- sha256 of the x-venue-token request header ('' when absent).
create function public.request_venue_token_hash() returns text
language sql stable set search_path = '' as $$
  select encode(extensions.digest(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-venue-token', ''),
    'sha256'), 'hex')
$$;

-- The venue the current request is logged in to, or null. Used by the RLS policies.
create function public.venue_session_venue() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.venue_id from public.venue_sessions s
   where s.token_hash = public.request_venue_token_hash() and s.expires_at > now()
$$;

-- Returns a session token for a correct PIN, otherwise null.
-- 5 wrong tries in a row lock the login for 5 minutes.
create function public.venue_login(venue_slug text, pin text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.venue_settings;
  token text;
begin
  select st.* into s
    from public.venue_settings st join public.venues v on v.id = st.venue_id
   where v.slug = venue_slug
     for update of st;
  if not found or s.pin_hash is null or s.locked_until > now() then
    return null;
  end if;

  if pin is null or extensions.crypt(pin, s.pin_hash) is distinct from s.pin_hash then
    update public.venue_settings
       set failed_logins = case when failed_logins >= 4 then 0 else failed_logins + 1 end,
           locked_until  = case when failed_logins >= 4 then now() + interval '5 minutes' else locked_until end
     where venue_id = s.venue_id;
    return null; -- not an exception, so the counter update above is kept
  end if;

  update public.venue_settings set failed_logins = 0 where venue_id = s.venue_id;
  delete from public.venue_sessions where expires_at < now();
  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.venue_sessions (token_hash, venue_id, expires_at)
  values (encode(extensions.digest(token, 'sha256'), 'hex'), s.venue_id, now() + interval '30 days');
  return token;
end $$;

create function public.venue_logout() returns void
language sql security definer set search_path = '' as $$
  delete from public.venue_sessions where token_hash = public.request_venue_token_hash()
$$;

-- What players see: which tables are taken when. No names or phone numbers.
create function public.busy_slots(venue uuid, from_date date, to_date date)
returns table (table_id uuid, date date, start_minutes int, duration_minutes int)
language sql stable security definer set search_path = '' as $$
  select b.table_id, b.date, b.start_minutes, b.duration_minutes
    from public.bookings b
   where b.venue_id = venue
     and b.date between from_date and least(to_date, from_date + 31)
     and b.status <> 'cancelled'
$$;

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.bookings_check_hours(), public.sync_walk_in() from public, anon, authenticated;


-- =====================================================================
-- Row Level Security and grants
-- =====================================================================
-- Supabase grants everything on public tables to the API roles by default.
-- Start from nothing and grant only what the app needs.

alter table public.venues         enable row level security;
alter table public.tables         enable row level security;
alter table public.opening_hours  enable row level security;
alter table public.venue_settings enable row level security;
alter table public.bookings       enable row level security;
alter table public.venue_sessions enable row level security; -- no policies: only reachable via the functions above

revoke all on public.venues, public.tables, public.opening_hours, public.venue_settings,
              public.bookings, public.venue_sessions from anon, authenticated;

-- Anyone: read venue info.
grant select on public.venues, public.tables, public.opening_hours to anon, authenticated;
create policy "Anyone can read venues" on public.venues for select to anon, authenticated using (true);
create policy "Anyone can read tables" on public.tables for select to anon, authenticated using (true);
create policy "Anyone can read opening hours" on public.opening_hours for select to anon, authenticated using (true);

-- Settings: public columns readable by anyone, changeable only by the venue session.
-- pin_hash, failed_logins and locked_until are not granted, so the API can't read them.
grant select (venue_id, hold_back, prepay_weekend) on public.venue_settings to anon, authenticated;
grant update (hold_back, prepay_weekend) on public.venue_settings to anon, authenticated;
create policy "Anyone can read venue settings" on public.venue_settings
  for select to anon, authenticated using (true);
create policy "Venue session can update its settings" on public.venue_settings
  for update to anon, authenticated
  using (venue_id = (select public.venue_session_venue()))
  with check (venue_id = (select public.venue_session_venue()));

-- Bookings.
grant select on public.bookings to anon, authenticated;
grant insert (id, venue_id, table_id, date, start_minutes, duration_minutes, name, phone, players, source, status, paid)
  on public.bookings to anon, authenticated;
grant update (status, paid) on public.bookings to anon, authenticated;

create policy "Anyone can book a free table through the app" on public.bookings
  for insert to anon, authenticated
  with check (
    source = 'app' and status = 'booked' and paid = false
    -- today (with a day of slack for time zones) up to two weeks ahead
    and date between current_date - 1 and current_date + 14
    and not exists (select 1 from public.tables t where t.id = bookings.table_id and t.walk_in)
  );
create policy "Venue session can read its bookings" on public.bookings
  for select to anon, authenticated
  using (venue_id = (select public.venue_session_venue()));
create policy "Venue session can add bookings" on public.bookings
  for insert to anon, authenticated
  with check (venue_id = (select public.venue_session_venue()));
create policy "Venue session can update its bookings" on public.bookings
  for update to anon, authenticated
  using (venue_id = (select public.venue_session_venue()))
  with check (venue_id = (select public.venue_session_venue()));
-- No delete policy: bookings are cancelled, never deleted, from the app.


-- =====================================================================
-- Seed: Poolcafé de Peper, Peperstraat 13, Delft
-- =====================================================================

insert into public.venues (slug, name, address, city, price_cents, student_price_cents, off_peak_price_cents)
values ('de-peper', 'Poolcafé de Peper', 'Peperstraat 13', 'Delft', 960, 840, 720);

insert into public.tables (venue_id, type, number)
select v.id, t.type, t.number
  from public.venues v,
       (select 'snooker' as type, generate_series(1, 2) as number
        union all
        select 'pool', generate_series(1, 6)) t
 where v.slug = 'de-peper';

-- Sun 17:00–24:00, Mon–Thu 17:00–01:00, Fri–Sat 14:00–02:00
insert into public.opening_hours (venue_id, weekday, open_minutes, close_minutes)
select v.id, h.weekday, h.open_minutes, h.close_minutes
  from public.venues v,
       (values (0, 1020, 1440), (1, 1020, 1500), (2, 1020, 1500), (3, 1020, 1500),
               (4, 1020, 1500), (5, 840, 1560), (6, 840, 1560)) h (weekday, open_minutes, close_minutes)
 where v.slug = 'de-peper';

-- Pool tables 5 and 6 start as walk-in tables (the trigger sets tables.walk_in).
insert into public.venue_settings (venue_id, hold_back, prepay_weekend)
select id, 2, false from public.venues where slug = 'de-peper';


-- =====================================================================
-- Next step: set the venue PIN (pick your own; longer is safer).
-- Run this separately in the SQL editor, with your PIN in place of 'change-me':
--
--   update public.venue_settings
--      set pin_hash = extensions.crypt('change-me', extensions.gen_salt('bf'))
--    where venue_id = (select id from public.venues where slug = 'de-peper');
-- =====================================================================
