-- Switch the demo venue from Poolcafé de Peper (they declined) to
-- Pool and Billiards Delft, Voorhofdreef 1.
--
-- * Removes De Peper with everything attached (tables, hours, settings,
--   bookings, sessions) so their name is no longer on a public page.
-- * Adds carom billiards ("biljart") as a third table type.
-- * Moves prices from venues to a per-type rates table: Pool and Billiards
--   charges per game type and has no student or off-peak prices.
-- * Adds venue_settings.last_start_minutes: the latest start time players can
--   book online. Pool and Billiards takes reservations for start times up to
--   21:00; later guests walk in. Staff can still add later bookings.
--
-- Prices and hours come from poolandbilliards.nl (October 2026). Table counts
-- are not published, so 8 pool / 3 snooker / 2 biljart is an estimate; fix
-- them with an update on public.tables once known.

delete from public.venues where slug = 'de-peper';


-- ---------- Carom billiards ----------

alter table public.tables drop constraint tables_type_check;
alter table public.tables add constraint tables_type_check check (type in ('pool', 'snooker', 'carom'));


-- ---------- Prices per table type ----------

create table public.rates (
  venue_id    uuid not null references public.venues (id) on delete cascade,
  type        text not null check (type in ('pool', 'snooker', 'carom')),
  price_cents int  not null check (price_cents >= 0), -- per hour
  primary key (venue_id, type)
);

alter table public.venues
  drop column price_cents,
  drop column student_price_cents,
  drop column off_peak_price_cents;

alter table public.rates enable row level security;
revoke all on public.rates from anon, authenticated;
grant select on public.rates to anon, authenticated;
create policy "Anyone can read rates" on public.rates for select to anon, authenticated using (true);


-- ---------- Last online start time ----------

alter table public.venue_settings
  add column last_start_minutes int check (last_start_minutes between 0 and 2879); -- null = until closing

grant select (last_start_minutes), update (last_start_minutes) on public.venue_settings to anon, authenticated;

drop policy "Anyone can book a free table through the app" on public.bookings;
create policy "Anyone can book a free table through the app" on public.bookings
  for insert to anon, authenticated
  with check (
    source = 'app' and status = 'booked' and paid = false
    -- today (with a day of slack for time zones) up to two weeks ahead
    and date between current_date - 1 and current_date + 14
    and not exists (select 1 from public.tables t where t.id = bookings.table_id and t.walk_in)
    and start_minutes <= coalesce(
      (select s.last_start_minutes from public.venue_settings s where s.venue_id = bookings.venue_id), 2879)
  );


-- ---------- Seed: Pool and Billiards, Voorhofdreef 1, Delft ----------

insert into public.venues (slug, name, address, city)
values ('pool-and-billiards-delft', 'Pool and Billiards', 'Voorhofdreef 1', 'Delft');

insert into public.tables (venue_id, type, number)
select v.id, t.type, t.number
  from public.venues v,
       (select 'snooker' as type, generate_series(1, 3) as number
        union all select 'pool', generate_series(1, 8)
        union all select 'carom', generate_series(1, 2)) t
 where v.slug = 'pool-and-billiards-delft';

-- Sun 16:00–23:00, Mon 16:00–00:00, Tue–Wed 13:00–00:00, Thu 16:00–00:00,
-- Fri 13:00–01:00, Sat 16:00–01:00
insert into public.opening_hours (venue_id, weekday, open_minutes, close_minutes)
select v.id, h.weekday, h.open_minutes, h.close_minutes
  from public.venues v,
       (values (0, 960, 1380), (1, 960, 1440), (2, 780, 1440), (3, 780, 1440),
               (4, 960, 1440), (5, 780, 1500), (6, 960, 1500)) h (weekday, open_minutes, close_minutes)
 where v.slug = 'pool-and-billiards-delft';

insert into public.rates (venue_id, type, price_cents)
select v.id, r.type, r.price_cents
  from public.venues v,
       (values ('pool', 1750), ('snooker', 1750), ('carom', 1000)) r (type, price_cents)
 where v.slug = 'pool-and-billiards-delft';

-- Pool tables 7 and 8 start as walk-in tables (the trigger sets tables.walk_in).
insert into public.venue_settings (venue_id, hold_back, prepay_weekend, last_start_minutes)
select id, 2, false, 21 * 60 from public.venues where slug = 'pool-and-billiards-delft';


-- =====================================================================
-- Next step: set this venue's PIN (De Peper's PIN was removed with it).
-- Run separately in the SQL editor, with your PIN in place of 'change-me':
--
--   update public.venue_settings
--      set pin_hash = extensions.crypt('change-me', extensions.gen_salt('bf'))
--    where venue_id = (select id from public.venues where slug = 'pool-and-billiards-delft');
-- =====================================================================
