-- ============================================================================
-- Kortello: closing courts (27 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261026_open_matches.sql.
-- Safe to run a second time.
--
-- A club closes one or more courts (or all of them) for a stretch of time:
-- repairs, rain, a tournament, a holiday. While a court is closed:
--   - nobody can book it, from any screen (a rule on the bookings table)
--   - the booking pages show those hours as taken
--   - a lesson is given another court, if one is free
-- Closing cancels the bookings already in that time. Their players get a
-- notification (and an email from the app) with the reason. A group's session
-- is cancelled the same way as cancelling it by hand, so the parents hear too.
--
-- Reopening deletes the closure. Cancelled bookings stay cancelled.
--
--   1. The court_closures table
--   2. court_closed(): is this court closed at this time?
--   3. The rule on the bookings table
--   4. close_courts() and reopen_courts()
--   5. Taken times for the booking pages (get_busy_slots, get_coach_busy_slots)
--   6. Upcoming closures on a club's public page
--   7. Existing functions, with one line each for closures:
--      guard_player_booking (lessons skip closed courts), notify_booking
--      (close_courts tells players itself), notification_category
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. THE TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.court_closures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  -- The closed courts. Null: every court of the club, new ones included.
  court_ids  uuid[],
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text not null default 'other'
             check (reason in ('maintenance', 'weather', 'tournament', 'event', 'holiday', 'other')),
  note       text check (char_length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists court_closures_club_ends on public.court_closures (club_id, ends_at);

-- The club's owner and staff read them. Changes go through close_courts and
-- reopen_courts only.
alter table public.court_closures enable row level security;

drop policy if exists "court_closures_select_club" on public.court_closures;
create policy "court_closures_select_club" on public.court_closures
  for select using (public.manages_club(club_id));

revoke insert, update, delete on public.court_closures from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. IS THIS COURT CLOSED THEN?
-- ----------------------------------------------------------------------------
create or replace function public.court_closed(p_court uuid, p_from timestamptz, p_to timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.court_closures cc
    join public.courts c on c.club_id = cc.club_id
    where c.id = p_court
      and (cc.court_ids is null or p_court = any (cc.court_ids))
      and cc.starts_at < p_to
      and cc.ends_at   > p_from
  );
$$;


-- ----------------------------------------------------------------------------
-- 3. NO BOOKINGS ON A CLOSED COURT
--
-- Same error code as the overlap rule (23P01), so every screen that skips a
-- taken week or session skips a closed one too. The message starts with
-- "court_closed", so the app can say why.
-- Named "bookings_zz_..." so it runs after the other checks: by then a lesson
-- has been given its court.
-- ----------------------------------------------------------------------------
create or replace function public.guard_court_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.court_id is null or new.status not in ('confirmed', 'pending') then
    return new;
  end if;
  -- An active booking that keeps its court and time (check-in, notes…).
  if tg_op = 'UPDATE'
     and old.status in ('confirmed', 'pending')
     and new.court_id = old.court_id
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at then
    return new;
  end if;
  if public.court_closed(new.court_id, new.starts_at, new.ends_at) then
    raise exception 'court_closed: this court is closed at that time'
      using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_zz_closure_guard on public.bookings;
create trigger bookings_zz_closure_guard
  before insert or update on public.bookings
  for each row execute function public.guard_court_closure();


-- ----------------------------------------------------------------------------
-- 4. CLOSING AND REOPENING
-- ----------------------------------------------------------------------------

-- Close courts (p_courts null: all of them) from p_starts to p_ends.
-- p_reason_text: the reason in the club's language, for the group sessions'
-- cancel reason (the app sends it).
-- Returns {"id", "cancelled": n,
--          "people": [{booking_id, name, email, locale, court, coach,
--                      starts_at, ends_at, duration_min, total_price, reference}],
--          "groups": [{group, starts_at, ends_at,
--                      contacts: [{name, contact_name, email}]}]}
-- so the app can email everyone.
create or replace function public.close_courts(
  p_club uuid, p_courts uuid[], p_starts timestamptz, p_ends timestamptz,
  p_reason text, p_note text default null, p_reason_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_courts    uuid[];
  v_id        uuid;
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_club_name text;
  v_count     integer := 0;
  v_people    jsonb := '[]'::jsonb;
  v_groups    jsonb := '[]'::jsonb;
  v_contacts  jsonb;
  v_session   uuid;
  v_player    uuid;
  v_coach     uuid;
  v_data      jsonb;
  b           record;
  r           record;
begin
  if not public.manages_club(p_club) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if public.club_locked(p_club) then
    raise exception 'club_locked' using errcode = '42501';
  end if;
  if p_starts is null or p_ends is null or p_ends <= p_starts then
    raise exception 'The closure must end after it starts' using errcode = '22023';
  end if;
  if p_ends <= now() then
    raise exception 'That time has already passed' using errcode = '22023';
  end if;
  if p_ends - p_starts > interval '366 days' then
    raise exception 'A closure can be up to a year' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('maintenance', 'weather', 'tournament', 'event', 'holiday', 'other') then
    raise exception 'Unknown reason' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 200 then
    raise exception 'The note can be up to 200 characters' using errcode = '22023';
  end if;

  if p_courts is not null then
    select array_agg(distinct x) into v_courts from unnest(p_courts) x;
    if v_courts is null then
      raise exception 'Pick at least one court' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_courts) x
      where not exists (select 1 from public.courts c where c.id = x and c.club_id = p_club)
    ) then
      raise exception 'That court is not at this club' using errcode = '22023';
    end if;
  end if;

  insert into public.court_closures (club_id, court_ids, starts_at, ends_at, reason, note, created_by)
  values (p_club, v_courts, p_starts, p_ends, p_reason, v_note, auth.uid())
  returning id into v_id;

  select c.name into v_club_name from public.clubs c where c.id = p_club;

  perform set_config('kortello.closure_rpc', 'on', true);

  for b in
    select bk.*, k.name as court_name,
           cp.full_name as coach_name, co.profile_id as coach_user,
           coalesce(pp.full_name, m.full_name, bk.walk_in_name) as who,
           coalesce(lower(u.email), lower(m.email)) as who_email
    from public.bookings bk
    join public.courts k on k.id = bk.court_id
    left join public.coaches co on co.id = bk.coach_id
    left join public.profiles cp on cp.id = co.profile_id
    left join public.profiles pp on pp.id = bk.player_id
    left join auth.users u on u.id = bk.player_id
    left join public.members m on m.id = bk.member_id
    where k.club_id = p_club
      and (v_courts is null or bk.court_id = any (v_courts))
      and bk.status in ('confirmed', 'pending')
      and bk.starts_at < p_ends
      and bk.ends_at   > greatest(p_starts, now())
    order by bk.starts_at
  loop
    v_count := v_count + 1;

    -- A group's session: cancelled like a coach cancels one (parents hear).
    if b.group_id is not null then
      select s.id into v_session
      from public.group_sessions s
      where s.booking_id = b.id and s.status = 'scheduled'
      limit 1;
      if v_session is not null then
        select coalesce(jsonb_agg(jsonb_build_object(
                 'name', x.name, 'contact_name', x.contact_name, 'email', x.email)), '[]'::jsonb)
          into v_contacts
        from public.cancel_group_session(v_session, coalesce(p_reason_text, v_note)) x;
        v_groups := v_groups || jsonb_build_object(
          'group', b.walk_in_name, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
          'contacts', v_contacts);
        perform set_config('kortello.closure_rpc', 'on', true);
        continue;
      end if;
    end if;

    update public.bookings set status = 'cancelled' where id = b.id;

    v_data := jsonb_build_object(
      'booking_id', b.id, 'court', b.court_name, 'coach', b.coach_name,
      'club', v_club_name, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
      'reason', p_reason, 'note', v_note);
    v_player := coalesce(b.player_id, public.account_of_member(b.member_id));
    perform public.notify(v_player, p_club, 'court_closed', v_data, '/my-bookings',
                          'court_closed:' || b.id::text);
    v_coach := b.coach_user;
    if v_coach is not null and v_coach is distinct from v_player then
      perform public.notify(v_coach, p_club, 'court_closed', v_data, '/my-bookings',
                            'court_closed:' || b.id::text);
    end if;

    if b.who_email is not null then
      v_people := v_people || jsonb_build_object(
        'booking_id', b.id, 'name', b.who, 'email', b.who_email, 'locale', b.locale,
        'court', b.court_name, 'coach', b.coach_name,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'duration_min', b.duration_min, 'total_price', b.total_price,
        'reference', b.reference);
    end if;
  end loop;

  perform set_config('kortello.closure_rpc', '', true);

  return jsonb_build_object('id', v_id, 'cancelled', v_count, 'people', v_people, 'groups', v_groups);
end;
$$;

-- Reopen: the closure goes. Bookings it cancelled stay cancelled.
create or replace function public.reopen_courts(p_closure uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
begin
  select cc.club_id into v_club from public.court_closures cc where cc.id = p_closure;
  if v_club is null then
    return;
  end if;
  if not public.manages_club(v_club) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.court_closures where id = p_closure;
end;
$$;

revoke execute on function public.close_courts(uuid, uuid[], timestamptz, timestamptz, text, text, text) from public, anon;
revoke execute on function public.reopen_courts(uuid) from public, anon;
grant execute on function public.close_courts(uuid, uuid[], timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.reopen_courts(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. TAKEN TIMES FOR THE BOOKING PAGES
--
-- get_busy_slots: a court's bookings on one day, and now its closed times
-- too (closed = true). Times only, nothing about who booked. Any older
-- version is replaced, whatever its arguments were.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_busy_slots'
  loop
    execute 'drop function ' || r.sig;
  end loop;
end;
$$;

create function public.get_busy_slots(p_court_id uuid, p_day date)
returns table (starts_at timestamptz, ends_at timestamptz, closed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (p_day::timestamp at time zone 'Europe/Skopje')       as day_start,
           ((p_day + 1)::timestamp at time zone 'Europe/Skopje') as day_end
  )
  select b.starts_at, b.ends_at, false
  from public.bookings b, bounds
  where b.court_id = p_court_id
    and b.status not in ('cancelled', 'no_show')
    and b.starts_at < bounds.day_end
    and b.ends_at   > bounds.day_start

  union all

  select greatest(cc.starts_at, bounds.day_start), least(cc.ends_at, bounds.day_end), true
  from public.court_closures cc
  join public.courts c on c.club_id = cc.club_id, bounds
  where c.id = p_court_id
    and (cc.court_ids is null or p_court_id = any (cc.court_ids))
    and cc.starts_at < bounds.day_end
    and cc.ends_at   > bounds.day_start;
$$;

grant execute on function public.get_busy_slots(uuid, date) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 6. UPCOMING CLOSURES ON A CLUB'S PUBLIC PAGE
--
-- Closures running now or starting in the next 30 days, with court names
-- (null: the whole club). The note is left out: it can be internal.
-- ----------------------------------------------------------------------------
create or replace function public.upcoming_club_closures(p_club uuid)
returns table (starts_at timestamptz, ends_at timestamptz, reason text, courts text[])
language sql
stable
security definer
set search_path = ''
as $$
  select cc.starts_at, cc.ends_at, cc.reason,
         case when cc.court_ids is null then null
              else (select array_agg(c.name order by c.name)
                    from public.courts c where c.id = any (cc.court_ids) and c.is_active is true)
         end
  from public.court_closures cc
  where cc.club_id = p_club
    and cc.ends_at > now()
    and cc.starts_at < now() + interval '30 days'
    and (cc.court_ids is null or exists (
          select 1 from public.courts c where c.id = any (cc.court_ids) and c.is_active is true))
  order by cc.starts_at
  limit 10;
$$;

grant execute on function public.upcoming_club_closures(uuid) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 7. EXISTING FUNCTIONS, WITH A LINE FOR CLOSURES
--
-- Copies of the latest versions (20261024_groups.sql, 20261026_open_matches.sql,
-- 20261015_lessons_hold_court.sql), with the lines marked "closures" added.
-- ----------------------------------------------------------------------------

-- Lessons: the free court it gets is one that isn't closed.
create or replace function public.guard_player_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text := coalesce(auth.jwt() ->> 'role', '');
  v_court_id  uuid;
  v_coach_id  uuid;
  v_club_id   uuid;
  v_rate      numeric;
  v_discount  numeric := 0;
  v_hours     jsonb;
  v_day       jsonb;
  v_start     timestamp;
  v_end       timestamp;
  v_specs     text[];   -- lesson: the coach's specialities
  v_free      uuid;     -- lesson: the court it gets
begin
  -- Only requests coming through the API as a signed-in user are checked.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  -- groups: a group function checked the rights already.
  if coalesce(current_setting('kortello.group_rpc', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_court_id := new.court_id;
    v_coach_id := new.coach_id;
  else
    v_court_id := old.court_id;
    v_coach_id := old.coach_id;
  end if;

  -- Owner or staff of the club this court (or, for a lesson, this coach)
  -- belongs to.
  if (v_court_id is not null and exists (
        select 1
        from public.courts c
        join public.clubs cl on cl.id = c.club_id
        where c.id = v_court_id and public.manages_club(cl.id)))
     or (v_court_id is null and v_coach_id is not null and exists (
        select 1
        from public.coaches co
        join public.clubs cl on cl.id = co.club_id
        where co.id = v_coach_id and public.manages_club(cl.id))) then
    return new;
  end if;

  -- ---- Player: UPDATE (only cancelling) -------------------------------------
  if tg_op = 'UPDATE' then
    -- groups: a group's session is cancelled through the group.
    if old.group_id is not null then
      raise exception 'This court time belongs to a group'
        using errcode = '42501';
    end if;
    if new.status = 'cancelled'
       and old.status in ('pending', 'confirmed', 'cancelled') then
      new := old;
      new.status := 'cancelled';
      return new;
    end if;
    raise exception 'Players can only cancel a booking'
      using errcode = '42501';
  end if;

  -- ---- Player: INSERT -------------------------------------------------------
  if new.player_id is distinct from v_uid then
    raise exception 'You can only book for yourself'
      using errcode = '42501';
  end if;

  new.group_id := null;  -- groups

  if new.duration_min is null
     or new.duration_min < 30
     or new.duration_min > 240 then
    raise exception 'Invalid booking duration'
      using errcode = '22023';
  end if;

  if new.starts_at < now() - interval '5 minutes' then
    raise exception 'That time has already passed'
      using errcode = '22023';
  end if;

  -- lesson: a booking with a coach is priced by the coach, whatever court
  -- was sent; the court is chosen further down.
  if new.coach_id is not null then
    select co.price_per_hour, co.club_id, cl.opening_hours, co.specializations
      into v_rate, v_club_id, v_hours, v_specs
    from public.coaches co
    left join public.clubs cl on cl.id = co.club_id
    where co.id = new.coach_id
      and co.is_active is true;
  else
    select c.price_per_hour, c.club_id, cl.opening_hours
      into v_rate, v_club_id, v_hours
    from public.courts c
    join public.clubs cl on cl.id = c.club_id
    where c.id = new.court_id
      and c.is_active is true
      and cl.is_active is true;
  end if;

  if v_rate is null then
    raise exception 'This court or coach is not available'
      using errcode = '22023';
  end if;

  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);

  -- Opening hours, in the club's local time.
  if v_hours is not null then
    v_start := new.starts_at at time zone 'Europe/Skopje';
    v_end   := new.ends_at   at time zone 'Europe/Skopje';
    v_day   := v_hours -> (extract(isodow from v_start)::int - 1);

    if coalesce((v_day ->> 'open')::boolean, false) is false then
      raise exception 'The club is closed on that day'
        using errcode = '22023';
    end if;

    if v_start::time < (v_day ->> 'from')::time
       or v_end::date <> v_start::date
       or v_end::time > (v_day ->> 'to')::time then
      raise exception 'That time is outside the club''s opening hours'
        using errcode = '22023';
    end if;
  end if;

  -- lesson: take a free court at the coach's club. If two players grab the
  -- last court at the same moment, the court overlap rule stops the second.
  if new.coach_id is not null then
    new.court_id := null;

    if v_club_id is not null and exists (
      select 1 from public.courts c
      where c.club_id = v_club_id and c.is_active is true
    ) then
      select c.id into v_free
      from public.courts c
      where c.club_id = v_club_id
        and c.is_active is true
        and not public.court_closed(c.id, new.starts_at, new.ends_at)  -- closures
        and not exists (
          select 1
          from public.bookings b
          where b.court_id = c.id
            and b.status not in ('cancelled', 'no_show')
            and b.starts_at < new.ends_at
            and b.ends_at   > new.starts_at
        )
      order by
        exists (
          select 1 from unnest(coalesce(v_specs, '{}'::text[])) s
          where lower(s) like '%' || c.sport::text || '%'
        ) desc,
        c.name,
        c.id
      limit 1;

      if v_free is null then
        raise exception 'No court is free at that time'
          using errcode = '22023';
      end if;

      new.court_id := v_free;
    end if;
  end if;

  -- Member discount: active membership at THIS club, confirmed email.
  if v_club_id is not null then
    select coalesce(max(mp.discount_pct), 0)
      into v_discount
    from auth.users u
    join public.members m on lower(m.email) = lower(u.email)
    join public.membership_plans mp on mp.id = m.plan_id
    where u.id = v_uid
      and u.email_confirmed_at is not null
      and m.club_id = v_club_id
      and m.status = 'active';
  end if;

  v_discount := least(greatest(coalesce(v_discount, 0), 0), 100);

  new.total_price := round(v_rate * new.duration_min / 60.0 * (1 - v_discount / 100.0), 2);
  new.status      := 'confirmed';
  new.member_id   := null;
  new.walk_in_name := null;
  new.checked_in_at := null;
  new.stripe_payment_intent_id := null;

  return new;
end;
$$;

-- Closing courts sends its own notification, with the reason.
create or replace function public.notify_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_club         uuid;
  v_club_name    text;
  v_club_phone   text;
  v_court        text;
  v_coach        text;
  v_coach_user   uuid;
  v_who          text;
  v_player       uuid;
  v_by_club      boolean;
  v_data         jsonb;
  v_kind         text;
begin
  -- Only changes made by a signed-in person count; the hourly job's own
  -- changes (e.g. marking bookings completed) notify nobody.
  if v_actor is null then
    return null;
  end if;
  -- groups: the group functions tell the players themselves.
  if new.group_id is not null then
    return null;
  end if;
  -- closures: close_courts tells the players itself, with the reason.
  if coalesce(current_setting('kortello.closure_rpc', true), '') = 'on' then
    return null;
  end if;
  if tg_op = 'UPDATE' and not (new.status = 'cancelled' and old.status is distinct from 'cancelled') then
    return null;
  end if;
  if tg_op = 'INSERT' and new.status not in ('confirmed', 'pending') then
    return null;
  end if;

  select k.name, k.club_id into v_court, v_club
    from public.courts k where k.id = new.court_id;
  if new.coach_id is not null then
    select p.full_name, co.profile_id, coalesce(v_club, co.club_id)
      into v_coach, v_coach_user, v_club
      from public.coaches co
      left join public.profiles p on p.id = co.profile_id
      where co.id = new.coach_id;
  end if;
  if v_club is null then
    return null;
  end if;
  select c.name, c.phone into v_club_name, v_club_phone from public.clubs c where c.id = v_club;

  v_who := coalesce(
    (select p.full_name from public.profiles p where p.id = new.player_id),
    (select m.full_name from public.members m where m.id = new.member_id),
    new.walk_in_name
  );
  v_player := coalesce(new.player_id, public.account_of_member(new.member_id));
  v_by_club := public.manages_club(v_club);

  v_data := jsonb_build_object(
    'booking_id', new.id,
    'who', v_who,
    'court', v_court,
    'coach', v_coach,
    'starts_at', new.starts_at,
    'ends_at', new.ends_at,
    'price', new.total_price,
    'weekly', new.series_id is not null,
    'club', v_club_name,
    'club_phone', v_club_phone
  );

  if not v_by_club then
    -- A player did it: tell the club (and the coach, for a lesson).
    v_kind := case
      when tg_op = 'UPDATE' then 'booking_cancelled'
      when new.coach_id is not null then 'lesson_new'
      else 'booking_new'
    end;
    perform public.notify_club(
      v_club, v_kind, v_data,
      case when tg_op = 'UPDATE' then '/admin/bookings' else '/admin/timetable' end
    );
    if v_coach_user is not null then
      perform public.notify(v_coach_user, v_club, v_kind, v_data, '/my-bookings');
    end if;
  elsif v_player is not null then
    -- The club did it for a player: tell the player. A weekly series makes
    -- one notification, not one per week.
    if tg_op = 'INSERT' then
      perform public.notify(
        v_player, v_club, 'club_booked', v_data, '/my-bookings',
        'club_booked:' || coalesce(new.series_id, new.id)::text
      );
    else
      perform public.notify(
        v_player, v_club, 'club_cancelled', v_data, '/my-bookings',
        'club_cancelled:' || coalesce(new.series_id::text || ':' || current_date::text, new.id::text)
      );
    end if;
  end if;
  return null;
exception when others then
  -- A notification must never stop a booking.
  raise warning 'notify_booking: %', sqlerrm;
  return null;
end;
$$;

create or replace function public.notification_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'booking_new'        then 'bookings'
    when 'lesson_new'         then 'lessons'
    when 'booking_cancelled'  then 'cancellations'
    when 'tournament_joined'  then 'tournaments'
    when 'tournament_left'    then 'tournaments'
    when 'members_ending'     then 'members'
    when 'staff_joined'       then 'staff'
    when 'club_booked'        then 'club_changes'
    when 'club_cancelled'     then 'club_changes'
    when 'court_closed'       then 'club_changes'
    when 'reminder'           then 'reminders'
    when 'draw'               then 'tournaments'
    when 'membership_ending'  then 'membership'
    when 'group_signup'       then 'groups'
    when 'group_left'         then 'groups'
    when 'group_offer_answer' then 'groups'
    when 'group_absence'      then 'groups'
    when 'group_cancelled'    then 'groups'
    when 'group_added'        then 'groups'
    when 'group_fee_due'      then 'groups'
    when 'group_offer'        then 'always'
    when 'match_joined'       then 'matches'
    when 'match_request'      then 'matches'
    when 'match_left'         then 'matches'
    when 'match_full'         then 'matches'
    when 'match_answer'       then 'matches'
    when 'match_removed'      then 'matches'
    when 'match_cancelled'    then 'matches'
    when 'level_confirmed'    then 'matches'
    when 'level_check'        then 'matches'
    when 'match_keep_ask'     then 'always'
    when 'match_released'     then 'always'
    else 'always'
  end;
$$;

-- A closed court counts as taken when finding a court for a lesson.
create or replace function public.get_coach_busy_slots(p_coach_id uuid, p_day date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (p_day::timestamp at time zone 'Europe/Skopje')       as day_start,
           ((p_day + 1)::timestamp at time zone 'Europe/Skopje') as day_end
  ),
  club_courts as (
    select c.id
    from public.courts c
    join public.coaches co on co.club_id = c.club_id
    where co.id = p_coach_id
      and c.is_active is true
  ),
  blocks as (
    select g as block_start, g + interval '30 minutes' as block_end
    from bounds,
         generate_series(bounds.day_start, bounds.day_end - interval '30 minutes',
                         interval '30 minutes') g
  )
  select b.starts_at, b.ends_at
  from public.bookings b, bounds
  where b.coach_id = p_coach_id
    and b.status not in ('cancelled', 'no_show')
    and b.starts_at < bounds.day_end
    and b.ends_at   > bounds.day_start

  union all

  select bl.block_start, bl.block_end
  from blocks bl
  where exists (select 1 from club_courts)
    and not exists (
      select 1
      from club_courts cc
      where not exists (
        select 1
        from public.bookings b
        where b.court_id = cc.id
          and b.status not in ('cancelled', 'no_show')
          and b.starts_at < bl.block_end
          and b.ends_at   > bl.block_start
      )
      and not public.court_closed(cc.id, bl.block_start, bl.block_end)  -- closures
    );
$$;

commit;
