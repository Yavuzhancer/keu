-- DEV ONLY: fills the next 7 days with believable bookings, so the venue view
-- doesn't look empty in a demo. Busy Friday/Saturday nights, quiet afternoons.
-- Run in the Supabase SQL editor after the init migration. Safe to run more than once
-- (it skips slots that are already taken).
--
-- Every seeded booking has phone '06 0000 0000'. To remove them all:
--   delete from public.bookings where phone = '06 0000 0000';

do $$
declare
  v_id   uuid := (select id from public.venues where slug = 'de-peper');
  names  text[] := array['Daan','Sanne','Mehmet','Lotte','Jesse','Priya','Bram','Femke','Ahmet','Noor','Ruben','Yara',
                         'Lucas','Isa','Thijs','Elif','Max','Fleur','Omar','Julia','Sem','Zeynep','Milan','Anouk','Wouter','Mila'];
  inits  text := 'ABDGHJKMPSTVW';
  d      date;
  dow    int;
  h      public.opening_hours;
  t      public.tables;
  m      int;
  dur    int;
  busy   float;
begin
  for d in select generate_series(current_date, current_date + 6, interval '1 day')::date loop
    dow := extract(dow from d);
    select * into h from public.opening_hours where venue_id = v_id and weekday = dow;
    continue when not found;

    for t in select * from public.tables where venue_id = v_id and not walk_in loop
      m := h.open_minutes + case when random() < .5 then 0 else 30 end;
      while m <= h.close_minutes - 60 loop
        -- How likely a table is taken at this time of day (same curve as the old demo).
        busy := case
          when m < 1020 then case when dow in (5, 6) then .3 else .1 end
          when m < 1140 then case when dow in (5, 6) then .6 when dow = 4 then .35 else .22 end
          when m < 1380 then case when dow in (5, 6) then .85 when dow = 4 then .6 when dow = 0 then .3 else .4 end
          else case when dow in (5, 6) then .55 else .2 end
        end;
        if random() < busy then
          dur := (array[60, 60, 90, 120])[1 + floor(random() * 4)::int];
          if m + dur > h.close_minutes then m := m + 30; continue; end if;
          begin
            insert into public.bookings (venue_id, table_id, date, start_minutes, duration_minutes, name, phone,
                                         players, source, created_at)
            values (v_id, t.id, d, m, dur,
                    names[1 + floor(random() * array_length(names, 1))::int] || ' ' || substr(inits, 1 + floor(random() * length(inits))::int, 1) || '.',
                    '06 0000 0000',
                    case when t.type = 'snooker' then 2 else (array[2, 2, 3, 4])[1 + floor(random() * 4)::int] end,
                    case when random() < .6 then 'app' else 'phone' end,
                    now() - interval '2 days'); -- older than a day, so they don't show as "new"
          exception when exclusion_violation then
            null; -- slot already taken: skip it
          end;
          m := m + dur + case when random() < .25 then 30 else 0 end;
        else
          m := m + 30;
        end if;
      end loop;
    end loop;
  end loop;
end $$;
