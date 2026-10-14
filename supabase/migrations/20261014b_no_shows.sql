-- ============================================================================
-- ServeTime: no-shows (14 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261014_booking_rules.sql.
-- Wrapped in a transaction; safe to run a second time.
--
-- Adds one booking rule, max_no_shows (0 = off): after that many no-shows in
-- the last 90 days, a player can no longer book online at that club. The
-- club can still book for them, and un-marking a no-show lifts the pause.
-- This file replaces enforce_booking_rules() with a version that also checks
-- it; everything else in that function is unchanged.
-- ============================================================================

begin;

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
  v_no_shows    int;
  v_email       text;
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
  v_no_shows   := coalesce((v_rules ->> 'max_no_shows')::int, 0);

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
  -- Repeat no-shows: online booking pauses until the club forgives one
  -- (changes its status) or the oldest is more than 90 days ago. Counts the
  -- player's own bookings and those the club made for their membership.
  if v_no_shows > 0 then
    select u.email into v_email from auth.users u where u.id = v_uid;

    select count(*) into v_count
    from public.bookings b
    left join public.courts c on c.id = b.court_id
    left join public.coaches co on co.id = b.coach_id
    where b.status = 'no_show'
      and b.starts_at > now() - interval '90 days'
      and coalesce(c.club_id, co.club_id) = v_club_id
      and (b.player_id = new.player_id
           or b.member_id in (
             select m.id from public.members m
             where m.club_id = v_club_id
               and v_email is not null
               and lower(m.email) = lower(v_email)));

    if v_count >= v_no_shows then
      raise exception 'Booking rule: online booking is paused after % missed bookings. Please contact the club.', v_count
        using errcode = '22023';
    end if;
  end if;

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

commit;
