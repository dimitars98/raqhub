-- ============================================================================
-- Kortello: booking rules per club (14 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261013_plans_trial.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- What it does
--   1. clubs.booking_rules: the club's rules, set in Settings > Booking Rules
--   2. A check on every booking a PLAYER makes or cancels. Club owners (and
--      the SQL Editor) are never limited, so the club can still book anything
--      for a member or walk-in.
--
-- Rules (missing = the default in brackets; keep in step with
-- src/lib/bookingRules.ts)
--   durations       booking lengths players may choose, in minutes [60,90,120]
--   max_days_ahead  how many days, counting today, players can book    [14]
--   cancel_hours    no cancelling online this close to the start, 0=off [0]
--   max_per_day     bookings per player per day at this club, 0=no limit [0]
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. COLUMN
-- ----------------------------------------------------------------------------
alter table public.clubs
  add column if not exists booking_rules jsonb;

alter table public.clubs
  drop constraint if exists clubs_booking_rules_shape;
alter table public.clubs
  add constraint clubs_booking_rules_shape check (
    booking_rules is null or jsonb_typeof(booking_rules) = 'object'
  );


-- ----------------------------------------------------------------------------
-- 2. THE CHECK
--
-- Runs after bookings_guard_player (triggers run in name order), so the end
-- time and status are already worked out when it looks at the booking.
-- Error messages start with "Booking rule:" so the app can show them as is.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_role        text := coalesce(auth.jwt() ->> 'role', '');
  v_court_id    uuid;
  v_coach_id    uuid;
  v_club_id     uuid;
  v_owner_id    uuid;
  v_rules       jsonb;
  v_durations   jsonb;
  v_days_ahead  int;
  v_cancel_h    int;
  v_per_day     int;
  v_day         date;
  v_today       date;
  v_count       int;
begin
  -- Only requests coming through the API as a signed-in user are checked.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_court_id := new.court_id;
    v_coach_id := new.coach_id;
  else
    v_court_id := old.court_id;
    v_coach_id := old.coach_id;
  end if;

  -- The club this booking belongs to (through the court, or the coach).
  if v_court_id is not null then
    select cl.id, cl.owner_id, cl.booking_rules
      into v_club_id, v_owner_id, v_rules
    from public.courts c
    join public.clubs cl on cl.id = c.club_id
    where c.id = v_court_id;
  elsif v_coach_id is not null then
    select cl.id, cl.owner_id, cl.booking_rules
      into v_club_id, v_owner_id, v_rules
    from public.coaches co
    join public.clubs cl on cl.id = co.club_id
    where co.id = v_coach_id;
  end if;

  -- No club, or the club's own owner: no limits.
  if v_club_id is null or v_owner_id is not distinct from v_uid then
    return new;
  end if;

  v_rules      := coalesce(v_rules, '{}'::jsonb);
  v_durations  := coalesce(v_rules -> 'durations', '[60, 90, 120]'::jsonb);
  v_days_ahead := coalesce((v_rules ->> 'max_days_ahead')::int, 14);
  v_cancel_h   := coalesce((v_rules ->> 'cancel_hours')::int, 0);
  v_per_day    := coalesce((v_rules ->> 'max_per_day')::int, 0);

  -- ---- Cancelling ---------------------------------------------------------
  if tg_op = 'UPDATE' then
    if new.status = 'cancelled'
       and old.status in ('pending', 'confirmed')
       and v_cancel_h > 0
       and old.starts_at - make_interval(hours => v_cancel_h) < now() then
      raise exception 'Booking rule: this club only allows cancelling up to % hours before the start. Please call the club.', v_cancel_h
        using errcode = '22023';
    end if;
    return new;
  end if;

  -- ---- New booking --------------------------------------------------------
  if jsonb_typeof(v_durations) = 'array'
     and not (v_durations @> to_jsonb(new.duration_min)) then
    raise exception 'Booking rule: this club doesn''t take % minute bookings.', new.duration_min
      using errcode = '22023';
  end if;

  v_day   := (new.starts_at at time zone 'Europe/Skopje')::date;
  v_today := (now() at time zone 'Europe/Skopje')::date;

  if v_days_ahead > 0 and v_day > v_today + (v_days_ahead - 1) then
    raise exception 'Booking rule: this club takes bookings up to % days ahead.', v_days_ahead
      using errcode = '22023';
  end if;

  if v_per_day > 0 then
    select count(*) into v_count
    from public.bookings b
    left join public.courts c on c.id = b.court_id
    left join public.coaches co on co.id = b.coach_id
    where b.player_id = new.player_id
      and b.status not in ('cancelled', 'no_show')
      and (b.starts_at at time zone 'Europe/Skopje')::date = v_day
      and coalesce(c.club_id, co.club_id) = v_club_id;

    if v_count >= v_per_day then
      raise exception 'Booking rule: you can make up to % bookings a day at this club.', v_per_day
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_rules_check on public.bookings;
create trigger bookings_rules_check
  before insert or update on public.bookings
  for each row execute function public.enforce_booking_rules();

commit;
