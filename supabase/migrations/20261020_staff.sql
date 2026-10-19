-- ============================================================================
-- ServeTime: staff accounts (20 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261019_recurring_bookings.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A club owner invites staff (a receptionist, a coach) by email. When that
-- person signs in with the same, confirmed email address, they become staff
-- of the club.
--
-- What staff can do        the club's timetable, bookings and members:
--                          see them, add them, change them (not delete)
-- What stays owner-only    settings, plans, courts, coaches, tournaments,
--                          analytics, billing, inviting staff, deleting
--
-- The owner's own rules don't change. Staff get their own, separate rules
-- next to them, and the two booking checks that let the owner skip the
-- player limits now let staff skip them too.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. WHO IS STAFF
-- ----------------------------------------------------------------------------
create table if not exists public.club_staff (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  email        text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                                    and char_length(email) <= 254),
  -- Filled in when the invited person signs in with this email.
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);

create unique index if not exists club_staff_one_invite
  on public.club_staff (club_id, lower(email));
create index if not exists club_staff_user_idx
  on public.club_staff (user_id) where user_id is not null;

-- At most 20 people per club.
create or replace function public.limit_club_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  if (select count(*) from public.club_staff where club_id = new.club_id) >= 20 then
    raise exception 'A club can have at most 20 staff accounts'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists club_staff_limit on public.club_staff;
create trigger club_staff_limit
  before insert on public.club_staff
  for each row execute function public.limit_club_staff();


-- ----------------------------------------------------------------------------
-- 2. HELPERS
--
-- They run with the table owner's rights so the access rules below can use
-- them without looking at each other ("infinite recursion").
-- ----------------------------------------------------------------------------

-- The signed-in user is staff of this club.
create or replace function public.is_club_staff(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_staff s
    where s.club_id = p_club_id
      and s.user_id = (select auth.uid())
  );
$$;

-- The signed-in user owns this club or is staff of it.
create or replace function public.manages_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clubs c
    where c.id = p_club_id
      and c.owner_id = (select auth.uid())
  ) or public.is_club_staff(p_club_id);
$$;

-- A booking on this court, or with this coach, belongs to a club the
-- signed-in user is staff of.
create or replace function public.staff_can_book(p_court_id uuid, p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courts c
    where c.id = p_court_id and public.is_club_staff(c.club_id)
  ) or exists (
    select 1 from public.coaches co
    where co.id = p_coach_id and public.is_club_staff(co.club_id)
  );
$$;

-- The club the signed-in user is staff of (the first one), or null.
create or replace function public.my_staff_club()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.club_id from public.club_staff s
  where s.user_id = (select auth.uid())
  order by s.accepted_at nulls last, s.created_at
  limit 1;
$$;

-- Called by the app after sign-in: links open invites for the user's
-- confirmed email address to their account. Returns their staff club.
create or replace function public.accept_staff_invites()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.club_staff s
  set user_id = u.id,
      accepted_at = now()
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and lower(s.email) = lower(u.email)
    and s.user_id is null;
  return public.my_staff_club();
end;
$$;

revoke execute on function public.is_club_staff(uuid) from public, anon;
revoke execute on function public.manages_club(uuid) from public, anon;
revoke execute on function public.staff_can_book(uuid, uuid) from public, anon;
revoke execute on function public.my_staff_club() from public, anon;
revoke execute on function public.accept_staff_invites() from public, anon;
grant execute on function public.is_club_staff(uuid) to authenticated;
grant execute on function public.manages_club(uuid) to authenticated;
grant execute on function public.staff_can_book(uuid, uuid) to authenticated;
grant execute on function public.my_staff_club() to authenticated;
grant execute on function public.accept_staff_invites() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. ACCESS RULES
-- ----------------------------------------------------------------------------
alter table public.club_staff enable row level security;
grant select, insert, update, delete on public.club_staff to authenticated;

-- The owner manages their club's staff list; staff can see their own row.
drop policy if exists "club_staff_manage_owner" on public.club_staff;
create policy "club_staff_manage_owner" on public.club_staff
  for all to authenticated
  using (exists (select 1 from public.clubs c
                 where c.id = club_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.clubs c
                      where c.id = club_id and c.owner_id = (select auth.uid())));

drop policy if exists "club_staff_select_self" on public.club_staff;
create policy "club_staff_select_self" on public.club_staff
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The club and what the booking screens need to show.
drop policy if exists "clubs_select_staff" on public.clubs;
create policy "clubs_select_staff" on public.clubs
  for select to authenticated
  using (public.is_club_staff(id));

drop policy if exists "courts_select_staff" on public.courts;
create policy "courts_select_staff" on public.courts
  for select to authenticated
  using (public.is_club_staff(club_id));

drop policy if exists "coaches_select_staff" on public.coaches;
create policy "coaches_select_staff" on public.coaches
  for select to authenticated
  using (public.is_club_staff(club_id));

drop policy if exists "membership_plans_select_staff" on public.membership_plans;
create policy "membership_plans_select_staff" on public.membership_plans
  for select to authenticated
  using (public.is_club_staff(club_id));

-- Members: see, add and change (deleting stays with the owner).
drop policy if exists "members_select_staff" on public.members;
create policy "members_select_staff" on public.members
  for select to authenticated
  using (public.is_club_staff(club_id));

drop policy if exists "members_insert_staff" on public.members;
create policy "members_insert_staff" on public.members
  for insert to authenticated
  with check (public.is_club_staff(club_id));

drop policy if exists "members_update_staff" on public.members;
create policy "members_update_staff" on public.members
  for update to authenticated
  using (public.is_club_staff(club_id))
  with check (public.is_club_staff(club_id));

-- Bookings: see, add and change (deleting stays with the owner).
drop policy if exists "bookings_select_staff" on public.bookings;
create policy "bookings_select_staff" on public.bookings
  for select to authenticated
  using (public.staff_can_book(court_id, coach_id));

drop policy if exists "bookings_insert_staff" on public.bookings;
create policy "bookings_insert_staff" on public.bookings
  for insert to authenticated
  with check (public.staff_can_book(court_id, coach_id));

drop policy if exists "bookings_update_staff" on public.bookings;
create policy "bookings_update_staff" on public.bookings
  for update to authenticated
  using (public.staff_can_book(court_id, coach_id))
  with check (public.staff_can_book(court_id, coach_id));


-- ----------------------------------------------------------------------------
-- 4. NAMES ON THE BOOKING LIST
--
-- Replaces the version from 11 Oct: staff, like the owner, see the names of
-- players who booked at the club, and the owner sees their staff's names.
-- ----------------------------------------------------------------------------
create or replace function public.profile_visible_to_my_club(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.coaches co
      where co.profile_id = p_profile_id
        and public.manages_club(co.club_id)
    )
    or exists (
      select 1
      from public.bookings b
      join public.courts c on c.id = b.court_id
      where b.player_id = p_profile_id
        and public.manages_club(c.club_id)
    )
    or exists (
      select 1
      from public.club_staff s
      join public.clubs cl on cl.id = s.club_id
      where s.user_id = p_profile_id
        and cl.owner_id = (select auth.uid())
    );
$$;


-- ----------------------------------------------------------------------------
-- 5. BOOKING CHECKS: staff skip the player limits, like the owner
--
-- Same as in 20261015_lessons_hold_court.sql, except that "owner of the club"
-- is now "owner or staff of the club" (public.manages_club).
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
  v_specs     text[];   -- lesson: the coach's specialities
  v_free      uuid;     -- lesson: the court it gets
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

-- ----------------------------------------------------------------------------
-- 6. BOOKING RULES: staff skip them, like the owner
--
-- Same as in 20261014b_no_shows.sql, except for the line marked "staff".
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
  if v_club_id is null or (v_owner_id is not distinct from v_uid
                            or public.is_club_staff(v_club_id)) then  -- staff
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
