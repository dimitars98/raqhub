-- ============================================================================
-- Kortello: coach bookings, opening hours, member bookings (12 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261011_rls_hardening.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- What it does
--   1. Clubs     opening hours per weekday (clubs.opening_hours)
--   2. Coaches   no double-booking a coach, busy times for the booking form
--   3. Owners    club owners see and manage bookings with their coaches
--   4. Members   players see bookings the club made for their membership
--   5. Guard     the booking trigger knows about coaches and opening hours
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. OPENING HOURS
--
-- Seven entries, Monday first:
--   [{"open": true, "from": "07:00", "to": "22:00"}, ... ]
-- Empty (null) means the club has not set hours yet: 07:00 to 22:00 every day.
-- ----------------------------------------------------------------------------
alter table public.clubs
  add column if not exists opening_hours jsonb;

alter table public.clubs
  drop constraint if exists clubs_opening_hours_shape;
alter table public.clubs
  add constraint clubs_opening_hours_shape check (
    opening_hours is null
    or (jsonb_typeof(opening_hours) = 'array'
        and jsonb_array_length(opening_hours) = 7)
  );


-- ----------------------------------------------------------------------------
-- 2. COACHES: one booking at a time per coach
--
-- Same rule courts already have. Added only if existing bookings don't
-- already overlap; otherwise it is skipped with a notice.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_coach_overlap'
  ) then
    begin
      alter table public.bookings
        add constraint bookings_no_coach_overlap
        exclude using gist (
          coach_id with =,
          tstzrange(starts_at, ends_at, '[)') with &&
        )
        where (coach_id is not null
               and status <> all (array['cancelled', 'no_show']));
    exception when exclusion_violation then
      raise notice 'SKIPPED bookings_no_coach_overlap: some coach bookings already overlap. Fix them, then run this file again.';
    end;
  end if;
end;
$$;

-- Taken times of one coach on one day, for the booking form. Times only.
create or replace function public.get_coach_busy_slots(p_coach_id uuid, p_day date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.coach_id = p_coach_id
    and b.status not in ('cancelled', 'no_show')
    and b.starts_at < ((p_day + 1)::timestamp at time zone 'Europe/Skopje')
    and b.ends_at   > (p_day::timestamp at time zone 'Europe/Skopje');
$$;


-- ----------------------------------------------------------------------------
-- 3. CLUB OWNERS AND COACH BOOKINGS
--
-- A lesson with a coach has no court, so the court-based policies miss it.
-- These let the owner of the coach's club see and update those bookings.
-- ----------------------------------------------------------------------------
drop policy if exists "bookings_select_coach_club_owner" on public.bookings;
create policy "bookings_select_coach_club_owner" on public.bookings
  for select to authenticated
  using (
    coach_id in (
      select co.id
      from public.coaches co
      join public.clubs cl on cl.id = co.club_id
      where cl.owner_id = (select auth.uid())
    )
  );

drop policy if exists "bookings_update_coach_club_owner" on public.bookings;
create policy "bookings_update_coach_club_owner" on public.bookings
  for update to authenticated
  using (
    coach_id in (
      select co.id
      from public.coaches co
      join public.clubs cl on cl.id = co.club_id
      where cl.owner_id = (select auth.uid())
    )
  )
  with check (
    coach_id in (
      select co.id
      from public.coaches co
      join public.clubs cl on cl.id = co.club_id
      where cl.owner_id = (select auth.uid())
    )
  );


-- ----------------------------------------------------------------------------
-- 4. MEMBERS SEE BOOKINGS THE CLUB MADE FOR THEM
--
-- When staff book a court "for a member", the booking points at the member
-- row, not at a user account. This links them through the confirmed email,
-- the same way the membership lookup already works. Read-only for the player.
-- ----------------------------------------------------------------------------
create or replace function public.my_member_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.id), '{}')
  from auth.users u
  join public.members m on lower(m.email) = lower(u.email)
  where u.id = auth.uid()
    and u.email_confirmed_at is not null;
$$;

revoke execute on function public.my_member_ids() from public, anon;
grant execute on function public.my_member_ids() to authenticated;

drop policy if exists "bookings_select_as_member" on public.bookings;
create policy "bookings_select_as_member" on public.bookings
  for select to authenticated
  using (member_id = any (public.my_member_ids()));


-- ----------------------------------------------------------------------------
-- 5. BOOKING GUARD (replaces the version from 11 Oct)
--
-- Same rules as before, plus:
--   - the owner of a coach's club is treated like the owner of a court's club
--   - a player's booking must fall inside the club's opening hours
-- ----------------------------------------------------------------------------
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

  -- Owner of the club this court (or, for a lesson, this coach) belongs to.
  if (v_court_id is not null and exists (
        select 1
        from public.courts c
        join public.clubs cl on cl.id = c.club_id
        where c.id = v_court_id and cl.owner_id = v_uid))
     or (v_court_id is null and v_coach_id is not null and exists (
        select 1
        from public.coaches co
        join public.clubs cl on cl.id = co.club_id
        where co.id = v_coach_id and cl.owner_id = v_uid)) then
    return new;
  end if;

  -- ---- Player: UPDATE (only cancelling) -------------------------------------
  if tg_op = 'UPDATE' then
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

  if new.court_id is not null then
    select c.price_per_hour, c.club_id, cl.opening_hours
      into v_rate, v_club_id, v_hours
    from public.courts c
    join public.clubs cl on cl.id = c.club_id
    where c.id = new.court_id
      and c.is_active is true
      and cl.is_active is true;
  else
    select co.price_per_hour, co.club_id, cl.opening_hours
      into v_rate, v_club_id, v_hours
    from public.coaches co
    left join public.clubs cl on cl.id = co.club_id
    where co.id = new.coach_id
      and co.is_active is true;
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

commit;
