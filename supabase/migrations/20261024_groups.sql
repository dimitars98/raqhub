-- ============================================================================
-- Kortello: coaching groups (24 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261023_clubs_public_columns.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A group is a coach's class that meets every week ("Kids 9–12, Tue and Thu
-- 17:00–18:30 on Court 2, September to June"), or a drop-in clinic that
-- players book one session at a time.
--
--   groups             the group and its weekly schedule
--   group_sessions     one row per meeting; each holds the court through an
--                      ordinary booking (bookings.group_id), so nobody can
--                      book over it and the timetable shows it
--   group_players      the coach's list: a name, an age and a contact. Kids
--                      have no accounts; a parent who signs in with the
--                      contact email sees the group.
--   group_attendance   the register: here, away, or "can't come" from the
--                      parent; drop-in bookings live here too
--   group_fees         one row per player per paid month
--
-- Who can do what
--   Everyone              see groups (name, schedule, price)
--   Club owner and staff  everything for their club's groups
--   The group's coach     see the list, take the register, cancel a session,
--                         mark fees paid
--   A parent or player    see their own group, say they can't come, sign up
--                         online, answer a place offered from the waiting list
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.groups (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 2 and 80),
  -- season: the same players every week, paid monthly
  -- dropin: players book each session, paid per session
  kind            text not null default 'season' check (kind in ('season', 'dropin')),
  sport           text not null default 'tennis' check (sport in ('tennis', 'padel', 'pickleball')),
  level           text not null default 'all'
                  check (level in ('beginner', 'intermediate', 'advanced', 'all')),
  age_min         integer check (age_min between 3 and 99),
  age_max         integer check (age_max between 3 and 99),
  adults          boolean not null default false,
  coach_id        uuid references public.coaches(id) on delete set null,
  court_id        uuid references public.courts(id) on delete set null,
  -- ISO weekdays: 1 = Monday … 7 = Sunday
  days            smallint[] not null
                  check (cardinality(days) between 1 and 7
                         and days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_time      time not null,
  end_time        time not null,
  starts_on       date not null,
  ends_on         date not null,
  -- Days without sessions: [{"from": "2026-12-24", "to": "2027-01-07", "label": "Winter break"}]
  breaks          jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(breaks) = 'array' and jsonb_array_length(breaks) <= 20),
  max_players     integer not null default 8 check (max_players between 1 and 60),
  -- season: per month · dropin: per session
  price           numeric(10, 2) not null default 0 check (price >= 0),
  member_price    numeric(10, 2) check (member_price is null or member_price >= 0),
  member_plan_id  uuid references public.membership_plans(id) on delete set null,
  online_signup   boolean not null default true,
  coach_approves  boolean not null default false,
  trial           boolean not null default true,
  description     text check (description is null or char_length(description) <= 1000),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint groups_ages check (age_min is null or age_max is null or age_min <= age_max),
  constraint groups_times check (
    end_time > start_time
    and end_time - start_time between interval '30 minutes' and interval '4 hours'
  ),
  constraint groups_dates check (ends_on >= starts_on and ends_on <= starts_on + 400)
);

create index if not exists groups_club_idx on public.groups (club_id, archived_at);
create index if not exists groups_coach_idx on public.groups (coach_id);

create table if not exists public.group_sessions (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references public.groups(id) on delete cascade,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  court_id           uuid references public.courts(id) on delete set null,
  booking_id         uuid references public.bookings(id) on delete set null,
  status             text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  -- true: on another court or time than the group's usual one
  moved              boolean not null default false,
  -- true: cancelled because the group's schedule changed (not by a person)
  schedule_cancelled boolean not null default false,
  cancel_reason      text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  note               text check (note is null or char_length(note) <= 1000),
  register_taken_at  timestamptz,
  created_at         timestamptz not null default now(),
  constraint group_sessions_times check (ends_at > starts_at)
);

create unique index if not exists group_sessions_one_per_time
  on public.group_sessions (group_id, starts_at) where status = 'scheduled';
create index if not exists group_sessions_group_idx on public.group_sessions (group_id, starts_at);
create index if not exists group_sessions_booking_idx on public.group_sessions (booking_id);

create table if not exists public.group_players (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references public.groups(id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 80),
  age                integer check (age between 3 and 99),
  -- The parent, or the player themselves
  contact_name       text check (contact_name is null or char_length(contact_name) <= 80),
  email              text check (email is null or (char_length(email) <= 200 and position('@' in email) > 1)),
  phone              text check (phone is null or char_length(phone) <= 40),
  -- The account that signed up online
  profile_id         uuid references public.profiles(id) on delete set null,
  -- active · trial (one free session) · requested (waits for the coach)
  -- waiting (waiting list) · offered (place offered, 48 hours to answer) · left
  status             text not null default 'active'
                     check (status in ('active', 'trial', 'requested', 'waiting', 'offered', 'left')),
  source             text not null default 'club' check (source in ('club', 'online')),
  -- Null: the group's price
  monthly_price      numeric(10, 2) check (monthly_price is null or monthly_price >= 0),
  trial_session_id   uuid references public.group_sessions(id) on delete set null,
  waiting_since      timestamptz,
  offer_token        uuid unique,
  offer_expires_at   timestamptz,
  joined_on          date not null default ((now() at time zone 'Europe/Skopje')::date),
  left_on            date,
  fee_reminded_month date,
  notes              text check (notes is null or char_length(notes) <= 500),
  created_at         timestamptz not null default now()
);

create index if not exists group_players_group_idx on public.group_players (group_id, status);
create index if not exists group_players_email_idx on public.group_players (lower(email));
create index if not exists group_players_profile_idx on public.group_players (profile_id);

create table if not exists public.group_attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.group_sessions(id) on delete cascade,
  -- A player on the list, or a guest / drop-in name
  player_id   uuid references public.group_players(id) on delete cascade,
  guest_name  text check (guest_name is null or char_length(btrim(guest_name)) between 1 and 80),
  -- Drop-in: the account that booked the place
  profile_id  uuid references public.profiles(id) on delete set null,
  -- booked (drop-in or trial, not yet marked) · present · absent
  -- excused (the parent said they can't come)
  status      text not null default 'booked'
              check (status in ('booked', 'present', 'absent', 'excused')),
  -- Drop-in: paid for this session
  paid        boolean not null default false,
  reason      text check (reason is null or char_length(reason) <= 200),
  updated_at  timestamptz not null default now(),
  constraint group_attendance_who check (player_id is not null or guest_name is not null)
);

create unique index if not exists group_attendance_one_per_player
  on public.group_attendance (session_id, player_id) where player_id is not null;
create unique index if not exists group_attendance_one_per_account
  on public.group_attendance (session_id, profile_id) where player_id is null and profile_id is not null;

create table if not exists public.group_fees (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.group_players(id) on delete cascade,
  -- The first day of the month paid for
  month      date not null check (extract(day from month) = 1),
  amount     numeric(10, 2) not null check (amount >= 0),
  method     text not null default 'cash' check (method in ('cash', 'bank', 'other')),
  paid_at    timestamptz not null default now(),
  marked_by  uuid references public.profiles(id) on delete set null,
  unique (player_id, month)
);

-- The booking that holds the court for a session.
alter table public.bookings
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

create index if not exists bookings_group_idx on public.bookings (group_id) where group_id is not null;


-- ----------------------------------------------------------------------------
-- 2. HELPERS
-- ----------------------------------------------------------------------------

-- The signed-in user's email, only once confirmed.
create or replace function public.my_confirmed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;

create or replace function public.group_club(p_group uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.club_id from public.groups g where g.id = p_group;
$$;

-- Owner or staff of the group's club.
create or replace function public.manages_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.manages_club(public.group_club(p_group)), false);
$$;

-- The signed-in user is the group's coach.
create or replace function public.coaches_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    join public.coaches co on co.id = g.coach_id
    where g.id = p_group and co.profile_id = (select auth.uid())
  );
$$;

create or replace function public.runs_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.manages_group(p_group) or public.coaches_group(p_group);
$$;

-- The players on any list that belong to the signed-in user: they signed them
-- up, or the club typed in their (confirmed) email.
create or replace function public.my_group_players()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gp.id from public.group_players gp
  where gp.status <> 'left'
    and (gp.profile_id = (select auth.uid())
         or (gp.email is not null and lower(gp.email) = public.my_confirmed_email()));
$$;

create or replace function public.in_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_players gp
    where gp.group_id = p_group and gp.id in (select public.my_group_players())
  );
$$;

-- The signed-in user booked a place in this drop-in session.
create or replace function public.booked_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_attendance a
    where a.session_id = p_session and a.player_id is null
      and a.profile_id = (select auth.uid())
  );
$$;

create or replace function public.session_group(p_session uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.group_id from public.group_sessions s where s.id = p_session;
$$;

create or replace function public.player_group(p_player uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gp.group_id from public.group_players gp where gp.id = p_player;
$$;

-- Places taken in a season group: active, trial, and offered (held for 48 hours).
create or replace function public.group_places_taken(p_group uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.group_players gp
  where gp.group_id = p_group and gp.status in ('active', 'trial', 'offered');
$$;

-- Days a group meets between two dates, without its breaks.
create or replace function public.group_dates(
  p_days smallint[], p_from date, p_to date, p_breaks jsonb
)
returns setof date
language sql
immutable
set search_path = ''
as $$
  select d::date
  from generate_series(p_from, p_to, interval '1 day') d
  where extract(isodow from d)::smallint = any (p_days)
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_breaks, '[]'::jsonb)) b
      where d::date between (b ->> 'from')::date and coalesce((b ->> 'to')::date, (b ->> 'from')::date)
    )
  order by 1;
$$;

-- Who holds a booking, for "Court 2 is taken by …".
create or replace function public.booking_label(p_booking uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select g.name from public.groups g where g.id = b.group_id),
    (select p.full_name from public.profiles p where p.id = b.player_id),
    (select m.full_name from public.members m where m.id = b.member_id),
    b.walk_in_name,
    b.reference
  )
  from public.bookings b where b.id = p_booking;
$$;


-- ----------------------------------------------------------------------------
-- 3. ACCESS RULES
--
-- Sessions, the register and offers change only through the functions in
-- step 5, so those tables have no write rules here.
-- ----------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_sessions enable row level security;
alter table public.group_players enable row level security;
alter table public.group_attendance enable row level security;
alter table public.group_fees enable row level security;

drop policy if exists "groups_select_all" on public.groups;
create policy "groups_select_all" on public.groups
  for select using (true);

drop policy if exists "groups_manage_club" on public.groups;
create policy "groups_manage_club" on public.groups
  for all to authenticated
  using (public.manages_club(club_id))
  with check (public.manages_club(club_id));

drop policy if exists "group_sessions_select" on public.group_sessions;
create policy "group_sessions_select" on public.group_sessions
  for select to authenticated
  using (public.runs_group(group_id) or public.in_group(group_id) or public.booked_session(id));

drop policy if exists "group_players_select" on public.group_players;
create policy "group_players_select" on public.group_players
  for select to authenticated
  using (public.runs_group(group_id) or id in (select public.my_group_players()));

drop policy if exists "group_players_manage_club" on public.group_players;
create policy "group_players_manage_club" on public.group_players
  for all to authenticated
  using (public.manages_group(group_id))
  with check (public.manages_group(group_id));

drop policy if exists "group_attendance_select" on public.group_attendance;
create policy "group_attendance_select" on public.group_attendance
  for select to authenticated
  using (
    public.runs_group(public.session_group(session_id))
    or player_id in (select public.my_group_players())
    or (player_id is null and profile_id = (select auth.uid()))
  );

drop policy if exists "group_fees_select" on public.group_fees;
create policy "group_fees_select" on public.group_fees
  for select to authenticated
  using (
    public.runs_group(public.player_group(player_id))
    or player_id in (select public.my_group_players())
  );

-- The coach collects cash at the court too, so they can mark fees paid.
drop policy if exists "group_fees_insert" on public.group_fees;
create policy "group_fees_insert" on public.group_fees
  for insert to authenticated
  with check (public.runs_group(public.player_group(player_id)));

drop policy if exists "group_fees_update" on public.group_fees;
create policy "group_fees_update" on public.group_fees
  for update to authenticated
  using (public.runs_group(public.player_group(player_id)))
  with check (public.runs_group(public.player_group(player_id)));

drop policy if exists "group_fees_delete" on public.group_fees;
create policy "group_fees_delete" on public.group_fees
  for delete to authenticated
  using (public.runs_group(public.player_group(player_id)));

grant select, insert, update, delete on public.groups, public.group_players, public.group_fees to authenticated;
grant select on public.group_sessions, public.group_attendance to authenticated;
grant select on public.groups to anon;

-- Tidy what is typed in: trimmed names, lower-case emails.
create or replace function public.tidy_group_player()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.contact_name := nullif(btrim(coalesce(new.contact_name, '')), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  if new.status = 'waiting' and new.waiting_since is null then
    new.waiting_since := now();
  end if;
  if new.status = 'left' and (tg_op = 'INSERT' or old.status <> 'left') then
    new.left_on := (now() at time zone 'Europe/Skopje')::date;
    new.offer_token := null;
    new.offer_expires_at := null;
  end if;
  if new.status <> 'offered' then
    new.offer_token := null;
    new.offer_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists group_players_tidy on public.group_players;
create trigger group_players_tidy
  before insert or update on public.group_players
  for each row execute function public.tidy_group_player();


-- ----------------------------------------------------------------------------
-- 4. BOOKINGS THAT BELONG TO A GROUP
--
-- The three booking functions below are the versions from
-- 20261020_staff.sql and 20261022_notifications.sql, with the lines marked
-- "groups" added:
--   - the group functions in step 5 set kortello.group_rpc for their own
--     changes, which skip the player checks (they check rights themselves)
--   - a player can't make a booking that claims to be a group's
--   - a group's own bookings don't send "new booking" notifications
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

  -- groups: a group's court time follows the group, not the booking rules.
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

-- A group booking cancelled or restored from the timetable or the bookings
-- list: the session follows.
create or replace function public.sync_group_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('kortello.group_rpc', true), '') = 'on' then
    return null;
  end if;
  if new.status in ('cancelled', 'no_show') and old.status not in ('cancelled', 'no_show') then
    update public.group_sessions
       set status = 'cancelled', schedule_cancelled = false
     where booking_id = new.id and status = 'scheduled';
  elsif new.status in ('confirmed', 'pending') and old.status in ('cancelled', 'no_show') then
    update public.group_sessions s
       set status = 'scheduled', cancel_reason = null
     where s.booking_id = new.id and s.status = 'cancelled'
       and not exists (select 1 from public.group_sessions o
                       where o.group_id = s.group_id and o.starts_at = s.starts_at
                         and o.status = 'scheduled');
  end if;
  if new.starts_at is distinct from old.starts_at or new.court_id is distinct from old.court_id then
    update public.group_sessions
       set starts_at = new.starts_at, ends_at = new.ends_at, court_id = new.court_id, moved = true
     where booking_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists bookings_sync_group on public.bookings;
create trigger bookings_sync_group
  after update on public.bookings
  for each row when (new.group_id is not null)
  execute function public.sync_group_booking();


-- ----------------------------------------------------------------------------
-- 5. WHAT PEOPLE DO WITH GROUPS
-- ----------------------------------------------------------------------------

-- Every meeting from today to the end of the season, and what is in the way.
--   clash: null (fine) · 'court' (court taken) · 'coach' (coach busy)
--          · 'closed' (club closed then)
--   existing: the session is already there
--   free_court_*: another court of the same sport that is free then
create or replace function public.preview_group_sessions(
  p_club uuid, p_court uuid, p_coach uuid, p_days smallint[],
  p_start_time time, p_end_time time, p_starts_on date, p_ends_on date,
  p_breaks jsonb, p_group uuid default null
)
returns table (
  day date, starts_at timestamptz, ends_at timestamptz, existing boolean,
  clash text, clash_who text, clash_starts timestamptz, clash_ends timestamptz,
  free_court_id uuid, free_court_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today  date := (now() at time zone 'Europe/Skopje')::date;
  v_hours  jsonb;
  v_sport  text;
  v_d      date;
  v_start  timestamptz;
  v_end    timestamptz;
  v_hday   jsonb;
  v_b      record;
begin
  if not public.manages_club(p_club) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_court is not null and not exists (select 1 from public.courts c where c.id = p_court and c.club_id = p_club) then
    raise exception 'That court is not at this club' using errcode = '22023';
  end if;
  if p_coach is not null and not exists (select 1 from public.coaches co where co.id = p_coach and co.club_id = p_club) then
    raise exception 'That coach is not at this club' using errcode = '22023';
  end if;
  if p_end_time <= p_start_time then
    raise exception 'The session must end after it starts' using errcode = '22023';
  end if;
  if p_ends_on > p_starts_on + 400 then
    raise exception 'A season can be up to 400 days' using errcode = '22023';
  end if;

  select cl.opening_hours into v_hours from public.clubs cl where cl.id = p_club;
  select c.sport::text into v_sport from public.courts c where c.id = p_court;

  for v_d in
    select * from public.group_dates(p_days, greatest(p_starts_on, v_today), p_ends_on, p_breaks)
  loop
    v_start := (v_d + p_start_time) at time zone 'Europe/Skopje';
    v_end   := (v_d + p_end_time) at time zone 'Europe/Skopje';
    if v_start <= now() then
      continue;
    end if;

    day := v_d; starts_at := v_start; ends_at := v_end;
    existing := p_group is not null and exists (
      select 1 from public.group_sessions s
      where s.group_id = p_group and s.starts_at = v_start and s.status = 'scheduled'
    );
    clash := null; clash_who := null; clash_starts := null; clash_ends := null;
    free_court_id := null; free_court_name := null;

    -- Opening hours
    if v_hours is not null then
      v_hday := v_hours -> (extract(isodow from v_d)::int - 1);
      if coalesce((v_hday ->> 'open')::boolean, false) is false
         or p_start_time < (v_hday ->> 'from')::time
         or p_end_time > (v_hday ->> 'to')::time then
        clash := 'closed';
      end if;
    end if;

    -- The coach, on any court: another court wouldn't help, so this comes first.
    if clash is null and p_coach is not null then
      select b.id, b.starts_at, b.ends_at into v_b
      from public.bookings b
      where b.coach_id = p_coach
        and b.status not in ('cancelled', 'no_show')
        and b.starts_at < v_end and b.ends_at > v_start
        and (p_group is null or b.group_id is distinct from p_group)
      order by b.starts_at
      limit 1;
      if v_b.id is not null then
        clash := 'coach';
        clash_who := public.booking_label(v_b.id);
        clash_starts := v_b.starts_at; clash_ends := v_b.ends_at;
      end if;
    end if;

    -- The court
    if clash is null and p_court is not null and not existing then
      select b.id, b.starts_at, b.ends_at into v_b
      from public.bookings b
      where b.court_id = p_court
        and b.status not in ('cancelled', 'no_show')
        and b.starts_at < v_end and b.ends_at > v_start
        and (p_group is null or b.group_id is distinct from p_group)
      order by b.starts_at
      limit 1;
      if v_b.id is not null then
        clash := 'court';
        clash_who := public.booking_label(v_b.id);
        clash_starts := v_b.starts_at; clash_ends := v_b.ends_at;
        select c.id, c.name into free_court_id, free_court_name
        from public.courts c
        where c.club_id = p_club and c.id <> p_court and c.is_active is true
          and (v_sport is null or c.sport::text = v_sport)
          and not exists (
            select 1 from public.bookings b2
            where b2.court_id = c.id
              and b2.status not in ('cancelled', 'no_show')
              and b2.starts_at < v_end and b2.ends_at > v_start
          )
        order by c.name, c.id
        limit 1;
      end if;
    end if;

    return next;
  end loop;
end;
$$;

-- Bring the group's sessions in line with its schedule, from now on.
-- p_choices: {"2026-11-19": "<court id>"} to use another court on a day the
-- usual court is taken. Days with any other clash are skipped.
-- Returns {"created": n, "cancelled": n, "skipped": ["2026-11-03", …]}.
create or replace function public.sync_group_sessions(p_group uuid, p_choices jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g          public.groups%rowtype;
  v_coach    uuid;
  v_created  integer := 0;
  v_cancel   integer := 0;
  v_skipped  text[] := '{}';
  v_p        record;
  v_s        record;
  v_court    uuid;
  v_moved    boolean;
  v_booking  uuid;
  v_dates    date[];
begin
  if not public.manages_group(p_group) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into g from public.groups where id = p_group for update;
  perform set_config('kortello.group_rpc', 'on', true);

  -- Archived: cancel everything still to come.
  if g.archived_at is not null then
    for v_s in
      select s.id, s.booking_id from public.group_sessions s
      where s.group_id = p_group and s.status = 'scheduled' and s.starts_at > now()
    loop
      update public.group_sessions set status = 'cancelled', schedule_cancelled = true where id = v_s.id;
      update public.bookings set status = 'cancelled' where id = v_s.booking_id;
      v_cancel := v_cancel + 1;
    end loop;
    perform set_config('kortello.group_rpc', '', true);
    return jsonb_build_object('created', 0, 'cancelled', v_cancel, 'skipped', '[]'::jsonb);
  end if;

  select array_agg(d) into v_dates
  from public.group_dates(g.days, (now() at time zone 'Europe/Skopje')::date, g.ends_on, g.breaks) d
  where d >= g.starts_on;

  -- 1. Sessions that no longer fit the schedule. One moved to another court
  --    or time stays, unless the group no longer meets on that day at all.
  for v_s in
    select s.id, s.booking_id
    from public.group_sessions s
    where s.group_id = p_group and s.status = 'scheduled' and s.starts_at > now()
      and (
        not ((s.starts_at at time zone 'Europe/Skopje')::date = any (coalesce(v_dates, '{}')))
        or (not s.moved and (
          (s.starts_at at time zone 'Europe/Skopje')::time <> g.start_time
          or (s.ends_at at time zone 'Europe/Skopje')::time <> g.end_time
          or s.court_id is distinct from g.court_id))
      )
  loop
    update public.group_sessions set status = 'cancelled', schedule_cancelled = true where id = v_s.id;
    update public.bookings set status = 'cancelled' where id = v_s.booking_id;
    v_cancel := v_cancel + 1;
  end loop;

  -- 2. A new coach takes over the sessions still to come.
  for v_s in
    select s.id, s.booking_id, s.starts_at
    from public.group_sessions s
    join public.bookings b on b.id = s.booking_id
    where s.group_id = p_group and s.status = 'scheduled' and s.starts_at > now()
      and b.coach_id is distinct from g.coach_id
  loop
    begin
      update public.bookings set coach_id = g.coach_id where id = v_s.booking_id;
    exception when exclusion_violation then
      update public.group_sessions set status = 'cancelled', schedule_cancelled = true where id = v_s.id;
      update public.bookings set status = 'cancelled' where id = v_s.booking_id;
      v_cancel := v_cancel + 1;
      v_skipped := v_skipped || ((v_s.starts_at at time zone 'Europe/Skopje')::date)::text;
    end;
  end loop;

  -- 3. Sessions to add.
  for v_p in
    select * from public.preview_group_sessions(
      g.club_id, g.court_id, g.coach_id, g.days, g.start_time, g.end_time,
      g.starts_on, g.ends_on, g.breaks, g.id)
  loop
    continue when v_p.existing;
    -- Cancelled by a person (rain, a holiday): leave it cancelled.
    continue when exists (
      select 1 from public.group_sessions s
      where s.group_id = p_group and s.starts_at = v_p.starts_at
        and s.status = 'cancelled' and not s.schedule_cancelled
    );

    v_court := g.court_id;
    v_moved := false;
    if v_p.clash = 'court' then
      v_court := nullif(p_choices ->> v_p.day::text, '')::uuid;
      if v_court is null or not exists (
        select 1 from public.courts c where c.id = v_court and c.club_id = g.club_id and c.is_active is true
      ) then
        v_skipped := v_skipped || v_p.day::text;
        continue;
      end if;
      v_moved := true;
    elsif v_p.clash is not null then
      v_skipped := v_skipped || v_p.day::text;
      continue;
    end if;

    if v_court is null then
      v_skipped := v_skipped || v_p.day::text;
      continue;
    end if;

    begin
      insert into public.bookings (
        court_id, coach_id, player_id, starts_at, ends_at, duration_min,
        total_price, status, walk_in_name, group_id
      ) values (
        v_court, g.coach_id, null, v_p.starts_at, v_p.ends_at,
        (extract(epoch from (v_p.ends_at - v_p.starts_at)) / 60)::integer,
        0, 'confirmed', g.name, g.id
      )
      returning id into v_booking;

      insert into public.group_sessions (group_id, starts_at, ends_at, court_id, booking_id, moved)
      values (g.id, v_p.starts_at, v_p.ends_at, v_court, v_booking, v_moved);
      v_created := v_created + 1;
    exception when exclusion_violation or unique_violation then
      -- Someone booked it a moment ago.
      v_skipped := v_skipped || v_p.day::text;
    end;
  end loop;

  -- Keep the bookings' label in step with the group's name.
  update public.bookings b set walk_in_name = g.name
  where b.group_id = g.id and b.starts_at > now() and b.walk_in_name is distinct from g.name;

  perform set_config('kortello.group_rpc', '', true);
  return jsonb_build_object('created', v_created, 'cancelled', v_cancel, 'skipped', to_jsonb(v_skipped));
end;
$$;

-- Cancel one session (rain, a holiday). Frees the court and tells the
-- parents and players who have an account. Returns who to email.
create or replace function public.cancel_group_session(p_session uuid, p_reason text default null)
returns table (name text, contact_name text, email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s     record;
  v_g     record;
  r       record;
begin
  select s.* into v_s from public.group_sessions s where s.id = p_session for update;
  if v_s.id is null or not public.runs_group(v_s.group_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_s.status <> 'scheduled' then
    return;
  end if;
  select g.id, g.name, g.club_id, g.kind into v_g from public.groups g where g.id = v_s.group_id;

  perform set_config('kortello.group_rpc', 'on', true);
  update public.group_sessions
     set status = 'cancelled', schedule_cancelled = false,
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_session;
  update public.bookings set status = 'cancelled' where id = v_s.booking_id;
  perform set_config('kortello.group_rpc', '', true);

  if v_s.starts_at < now() then
    return;  -- a past session: nobody needs telling
  end if;

  for r in
    -- Season group: everyone on the list. Drop-in: everyone who booked.
    select gp.name, gp.contact_name, gp.email, gp.profile_id
    from public.group_players gp
    where gp.group_id = v_g.id and gp.status in ('active', 'trial') and v_g.kind = 'season'
    union all
    select coalesce(a.guest_name, p.full_name), null, lower(u.email), a.profile_id
    from public.group_attendance a
    left join public.profiles p on p.id = a.profile_id
    left join auth.users u on u.id = a.profile_id
    where a.session_id = p_session and a.player_id is null and a.status <> 'excused'
  loop
    name := r.name; contact_name := r.contact_name; email := r.email;
    return next;
    perform public.notify(
      coalesce(r.profile_id, (select u.id from auth.users u
                              where r.email is not null and lower(u.email) = r.email
                                and u.email_confirmed_at is not null limit 1)),
      v_g.club_id, 'group_cancelled',
      jsonb_build_object('group', v_g.name, 'group_id', v_g.id, 'starts_at', v_s.starts_at,
                         'reason', nullif(btrim(coalesce(p_reason, '')), '')),
      '/groups', 'group_cancelled:' || p_session::text
    );
  end loop;
end;
$$;

-- Undo a cancelled session, if the court is still free.
create or replace function public.restore_group_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s record;
begin
  select s.* into v_s from public.group_sessions s where s.id = p_session for update;
  if v_s.id is null or not public.runs_group(v_s.group_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_s.status <> 'cancelled' then
    return;
  end if;
  if exists (select 1 from public.group_sessions o
             where o.group_id = v_s.group_id and o.starts_at = v_s.starts_at and o.status = 'scheduled') then
    raise exception 'There is already a session at that time' using errcode = '22023';
  end if;
  perform set_config('kortello.group_rpc', 'on', true);
  begin
    update public.bookings set status = 'confirmed' where id = v_s.booking_id;
  exception when exclusion_violation then
    raise exception 'The court has been booked since' using errcode = '22023';
  end;
  update public.group_sessions
     set status = 'scheduled', schedule_cancelled = false, cancel_reason = null
   where id = p_session;
  perform set_config('kortello.group_rpc', '', true);
end;
$$;

-- Move one session to another time or court.
create or replace function public.move_group_session(
  p_session uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_court uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s     record;
  v_club  uuid;
begin
  select s.* into v_s from public.group_sessions s where s.id = p_session for update;
  if v_s.id is null or not public.manages_group(v_s.group_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_club := public.group_club(v_s.group_id);
  if not exists (select 1 from public.courts c where c.id = p_court and c.club_id = v_club) then
    raise exception 'That court is not at this club' using errcode = '22023';
  end if;
  if p_ends_at <= p_starts_at or p_ends_at - p_starts_at > interval '4 hours' then
    raise exception 'Check the times' using errcode = '22023';
  end if;
  if p_starts_at < now() then
    raise exception 'That time has already passed' using errcode = '22023';
  end if;

  perform set_config('kortello.group_rpc', 'on', true);
  begin
    update public.bookings
       set starts_at = p_starts_at, ends_at = p_ends_at, court_id = p_court,
           duration_min = (extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer
     where id = v_s.booking_id;
  exception when exclusion_violation then
    raise exception 'The court or the coach is busy then' using errcode = '22023';
  end;
  update public.group_sessions
     set starts_at = p_starts_at, ends_at = p_ends_at, court_id = p_court, moved = true
   where id = p_session;
  perform set_config('kortello.group_rpc', '', true);
end;
$$;

-- The register. p_rows: [{"player_id": …, "status": "present"}, {"attendance_id": …, "status": …, "paid": true},
-- {"guest_name": "Ana", "status": "present"}]
create or replace function public.save_group_register(p_session uuid, p_rows jsonb, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s   record;
  r     jsonb;
  v_st  text;
begin
  select s.* into v_s from public.group_sessions s where s.id = p_session;
  if v_s.id is null or not public.runs_group(v_s.group_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_st := r ->> 'status';
    if v_st is not null and v_st not in ('booked', 'present', 'absent', 'excused') then
      raise exception 'Unknown status %', v_st using errcode = '22023';
    end if;

    if r ? 'player_id' then
      if not exists (select 1 from public.group_players gp
                     where gp.id = (r ->> 'player_id')::uuid and gp.group_id = v_s.group_id) then
        raise exception 'That player is not in this group' using errcode = '22023';
      end if;
      if v_st is null then
        delete from public.group_attendance
         where session_id = p_session and player_id = (r ->> 'player_id')::uuid;
      else
        insert into public.group_attendance (session_id, player_id, status, updated_at)
        values (p_session, (r ->> 'player_id')::uuid, v_st, now())
        on conflict (session_id, player_id) where player_id is not null
        do update set status = excluded.status, updated_at = now();
      end if;
    elsif r ? 'attendance_id' then
      if r ->> 'remove' = 'true' then
        delete from public.group_attendance
         where id = (r ->> 'attendance_id')::uuid and session_id = p_session and player_id is null;
      else
        update public.group_attendance
           set status = coalesce(v_st, status),
               paid = coalesce((r ->> 'paid')::boolean, paid),
               updated_at = now()
         where id = (r ->> 'attendance_id')::uuid and session_id = p_session;
      end if;
    elsif coalesce(btrim(r ->> 'guest_name'), '') <> '' then
      insert into public.group_attendance (session_id, guest_name, status, paid)
      values (p_session, btrim(r ->> 'guest_name'), coalesce(v_st, 'present'),
              coalesce((r ->> 'paid')::boolean, false));
    end if;
  end loop;

  update public.group_sessions
     set note = nullif(btrim(coalesce(p_note, '')), ''),
         register_taken_at = coalesce(register_taken_at, now())
   where id = p_session;
end;
$$;

-- A parent says their child can't come (or can, after all).
create or replace function public.set_group_absence(p_session uuid, p_player uuid, p_absent boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s      record;
  v_g      record;
  v_name   text;
  v_coach  uuid;
begin
  if p_player is null or not exists (select 1 from public.my_group_players() m where m = p_player) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select s.* into v_s from public.group_sessions s where s.id = p_session;
  if v_s.id is null or v_s.group_id <> public.player_group(p_player) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_s.status <> 'scheduled' or v_s.starts_at < now() then
    raise exception 'That session has already started' using errcode = '22023';
  end if;

  if p_absent then
    insert into public.group_attendance (session_id, player_id, status, reason, updated_at)
    values (p_session, p_player, 'excused', nullif(btrim(coalesce(p_reason, '')), ''), now())
    on conflict (session_id, player_id) where player_id is not null
    do update set status = 'excused', reason = excluded.reason, updated_at = now();
  else
    delete from public.group_attendance
     where session_id = p_session and player_id = p_player and status = 'excused';
  end if;

  select g.id, g.name, g.club_id, co.profile_id as coach_user into v_g
  from public.groups g left join public.coaches co on co.id = g.coach_id
  where g.id = v_s.group_id;
  select gp.name into v_name from public.group_players gp where gp.id = p_player;

  if p_absent then
    perform public.notify(
      v_g.coach_user, v_g.club_id, 'group_absence',
      jsonb_build_object('name', v_name, 'group', v_g.name, 'group_id', v_g.id,
                         'starts_at', v_s.starts_at, 'reason', nullif(btrim(coalesce(p_reason, '')), '')),
      '/groups', 'group_absence:' || p_session::text || ':' || p_player::text
    );
  end if;
end;
$$;

-- Sign up online for a season group: straight in, a free trial session,
-- a request for the coach, or the waiting list.
-- Returns {"status": "active" | "trial" | "requested" | "waiting", "player_id": …}.
create or replace function public.join_group(
  p_group uuid, p_name text, p_age integer default null, p_phone text default null,
  p_for_self boolean default false, p_trial boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_email   text := public.my_confirmed_email();
  g         public.groups%rowtype;
  v_me      text;
  v_status  text;
  v_trial   uuid;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in first' using errcode = '42501';
  end if;
  if v_email is null then
    raise exception 'Please confirm your email address first' using errcode = '22023';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Please enter a name' using errcode = '22023';
  end if;

  select * into g from public.groups where id = p_group for update;
  if g.id is null or g.archived_at is not null or not g.online_signup or g.kind <> 'season'
     or g.ends_on < (now() at time zone 'Europe/Skopje')::date then
    raise exception 'This group does not take sign-ups online' using errcode = '22023';
  end if;
  if p_age is not null and not g.adults
     and ((g.age_min is not null and p_age < g.age_min) or (g.age_max is not null and p_age > g.age_max)) then
    raise exception 'This group is for ages % to %', coalesce(g.age_min, 3), coalesce(g.age_max, 99)
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.group_players gp
    where gp.group_id = p_group and gp.status <> 'left'
      and lower(gp.name) = lower(btrim(p_name))
      and (gp.profile_id = v_uid or lower(gp.email) = v_email)
  ) then
    raise exception 'Already signed up' using errcode = '23505';
  end if;

  select p.full_name into v_me from public.profiles p where p.id = v_uid;

  if public.group_places_taken(p_group) >= g.max_players then
    v_status := 'waiting';
  elsif g.coach_approves then
    v_status := 'requested';
  elsif p_trial and g.trial then
    select s.id into v_trial from public.group_sessions s
    where s.group_id = p_group and s.status = 'scheduled' and s.starts_at > now()
    order by s.starts_at limit 1;
    v_status := case when v_trial is null then 'active' else 'trial' end;
  else
    v_status := 'active';
  end if;

  insert into public.group_players (
    group_id, name, age, contact_name, email, phone, profile_id, status, source, trial_session_id
  ) values (
    p_group, btrim(p_name), p_age,
    case when p_for_self then null else v_me end,
    v_email, p_phone, v_uid, v_status, 'online', v_trial
  )
  returning id into v_id;

  if v_trial is not null then
    insert into public.group_attendance (session_id, player_id, status)
    values (v_trial, v_id, 'booked')
    on conflict do nothing;
  end if;

  perform public.notify_club(
    g.club_id, 'group_signup',
    jsonb_build_object('name', btrim(p_name), 'group', g.name, 'group_id', g.id, 'status', v_status),
    '/admin/groups/' || g.id::text
  );
  perform public.notify(
    (select co.profile_id from public.coaches co where co.id = g.coach_id),
    g.club_id, 'group_signup',
    jsonb_build_object('name', btrim(p_name), 'group', g.name, 'group_id', g.id, 'status', v_status),
    '/groups'
  );

  return jsonb_build_object('status', v_status, 'player_id', v_id, 'trial_session', v_trial);
end;
$$;

-- A parent or player takes someone off the list (or off the waiting list).
create or replace function public.leave_group(p_player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if p_player is null or not exists (select 1 from public.my_group_players() m where m = p_player) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.group_players set status = 'left' where id = p_player
  returning name, group_id into v_row;
  perform public.notify_club(
    public.group_club(v_row.group_id), 'group_left',
    jsonb_build_object('name', v_row.name, 'group', (select g.name from public.groups g where g.id = v_row.group_id),
                       'group_id', v_row.group_id),
    '/admin/groups/' || v_row.group_id::text
  );
end;
$$;

-- Offer free places to the waiting list, first come first served. Each
-- offer holds the place for 48 hours. Returns the offers made, for emails.
-- p_player: offer to this one person, even if the group is full.
create or replace function public.offer_group_places(p_group uuid, p_player uuid default null)
returns table (player_id uuid, name text, contact_name text, email text, token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  g        public.groups%rowtype;
  v_free   integer;
  r        record;
  v_role   text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_role in ('authenticated', 'anon') and not public.manages_group(p_group) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into g from public.groups where id = p_group for update;
  if g.id is null or g.archived_at is not null then
    return;
  end if;

  if p_player is not null then
    v_free := 1;
  else
    v_free := g.max_players - public.group_places_taken(p_group);
  end if;

  for r in
    select gp.id from public.group_players gp
    where gp.group_id = p_group and gp.status = 'waiting'
      and (p_player is null or gp.id = p_player)
    order by gp.waiting_since nulls last, gp.created_at
    limit greatest(v_free, 0)
  loop
    update public.group_players gp
       set status = 'offered', offer_token = gen_random_uuid(),
           offer_expires_at = now() + interval '48 hours'
     where gp.id = r.id
    returning gp.id, gp.name, gp.contact_name, gp.email, gp.offer_token, gp.offer_expires_at
      into player_id, name, contact_name, email, token, expires_at;

    perform public.notify(
      coalesce((select gp.profile_id from public.group_players gp where gp.id = r.id),
               (select u.id from auth.users u
                where offer_group_places.email is not null
                  and lower(u.email) = offer_group_places.email
                  and u.email_confirmed_at is not null limit 1)),
      g.club_id, 'group_offer',
      jsonb_build_object('name', name, 'group', g.name, 'group_id', g.id, 'expires_at', expires_at),
      '/groups/offer/' || token::text, 'group_offer:' || r.id::text || ':' || token::text
    );
    return next;
  end loop;
end;
$$;

-- What an offer link shows. Works without signing in: the link is the key.
create or replace function public.group_offer_info(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', gp.name, 'status', gp.status, 'expires_at', gp.offer_expires_at,
    'group', g.name, 'days', g.days, 'start_time', g.start_time, 'end_time', g.end_time,
    'price', coalesce(gp.monthly_price, g.price), 'kind', g.kind,
    'club', c.name, 'club_slug', c.slug, 'club_phone', c.phone,
    'expired', gp.offer_expires_at < now()
  )
  from public.group_players gp
  join public.groups g on g.id = gp.group_id
  join public.clubs c on c.id = g.club_id
  where gp.offer_token = p_token;
$$;

create or replace function public.respond_group_offer(p_token uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p record;
begin
  select gp.id, gp.name, gp.status, gp.offer_expires_at, gp.group_id into v_p
  from public.group_players gp where gp.offer_token = p_token for update;
  if v_p.id is null or v_p.status <> 'offered' then
    raise exception 'This offer is no longer open' using errcode = '22023';
  end if;
  if v_p.offer_expires_at < now() then
    raise exception 'This offer has run out' using errcode = '22023';
  end if;

  update public.group_players
     set status = case when p_accept then 'active' else 'left' end,
         joined_on = case when p_accept then (now() at time zone 'Europe/Skopje')::date else joined_on end
   where id = v_p.id;

  perform public.notify_club(
    public.group_club(v_p.group_id), 'group_offer_answer',
    jsonb_build_object('name', v_p.name, 'group', (select g.name from public.groups g where g.id = v_p.group_id),
                       'group_id', v_p.group_id, 'accepted', p_accept),
    '/admin/groups/' || v_p.group_id::text
  );
  return case when p_accept then 'active' else 'left' end;
end;
$$;

-- Offers nobody answered within 48 hours: off the waiting list. The daily
-- job then offers the places again. Returns the groups that changed.
create or replace function public.expire_group_offers()
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  update public.group_players
     set status = 'left'
   where status = 'offered' and offer_expires_at < now()
  returning group_id;
$$;

-- Drop-in clinic: book a place in one session, or give it back.
create or replace function public.book_group_session(p_session uuid, p_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_s     record;
  g       public.groups%rowtype;
  v_n     integer;
  v_name  text;
begin
  if v_uid is null then
    raise exception 'Please sign in first' using errcode = '42501';
  end if;
  select s.* into v_s from public.group_sessions s where s.id = p_session for update;
  if v_s.id is null or v_s.status <> 'scheduled' or v_s.starts_at < now() then
    raise exception 'This session is not open for booking' using errcode = '22023';
  end if;
  select * into g from public.groups where id = v_s.group_id;
  if g.kind <> 'dropin' or not g.online_signup or g.archived_at is not null then
    raise exception 'This session is not open for booking' using errcode = '22023';
  end if;
  select count(*) into v_n from public.group_attendance a
  where a.session_id = p_session and a.status <> 'excused';
  if v_n >= g.max_players then
    raise exception 'This session is full' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(coalesce(p_name, '')), ''), p.full_name, 'Player') into v_name
  from public.profiles p where p.id = v_uid;

  insert into public.group_attendance (session_id, guest_name, profile_id, status)
  values (p_session, coalesce(v_name, 'Player'), v_uid, 'booked');

  perform public.notify_club(
    g.club_id, 'group_signup',
    jsonb_build_object('name', v_name, 'group', g.name, 'group_id', g.id, 'status', 'booked',
                       'starts_at', v_s.starts_at),
    '/admin/groups/' || g.id::text
  );
exception when unique_violation then
  raise exception 'You already have a place in this session' using errcode = '23505';
end;
$$;

create or replace function public.unbook_group_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_attendance a
  using public.group_sessions s
  where a.session_id = p_session and s.id = a.session_id
    and a.player_id is null and a.profile_id = (select auth.uid())
    and s.starts_at > now();
end;
$$;

-- What the club page shows: groups open to sign up, with places left and,
-- for drop-ins, the next sessions.
create or replace function public.public_groups(p_club uuid)
returns table (
  id uuid, name text, kind text, sport text, level text, age_min integer, age_max integer,
  adults boolean, days smallint[], start_time time, end_time time, starts_on date, ends_on date,
  price numeric, max_players integer, trial boolean, coach_approves boolean, description text,
  coach_name text, court_name text, taken integer, waiting integer, sessions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.kind, g.sport, g.level, g.age_min, g.age_max, g.adults, g.days,
         g.start_time, g.end_time, g.starts_on, g.ends_on, g.price, g.max_players, g.trial,
         g.coach_approves, g.description,
         p.full_name, c.name,
         public.group_places_taken(g.id),
         (select count(*)::integer from public.group_players w
          where w.group_id = g.id and w.status = 'waiting'),
         coalesce((
           select jsonb_agg(x order by x ->> 'starts_at')
           from (
             select jsonb_build_object(
               'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
               'taken', (select count(*) from public.group_attendance a
                         where a.session_id = s.id and a.status <> 'excused'),
               'mine', exists (select 1 from public.group_attendance a
                               where a.session_id = s.id and a.player_id is null
                                 and a.profile_id = (select auth.uid()))
             ) as x
             from public.group_sessions s
             where s.group_id = g.id and s.status = 'scheduled' and s.starts_at > now()
             order by s.starts_at
             limit case when g.kind = 'dropin' then 6 else 3 end
           ) t
         ), '[]'::jsonb)
  from public.groups g
  left join public.coaches co on co.id = g.coach_id
  left join public.profiles p on p.id = co.profile_id
  left join public.courts c on c.id = g.court_id
  join public.clubs cl on cl.id = g.club_id and cl.is_active is true
  where g.club_id = p_club
    and g.online_signup
    and g.archived_at is null
    and g.ends_on >= (now() at time zone 'Europe/Skopje')::date
  order by g.kind, g.name;
$$;

-- Fee reminders, from the 10th of the month: active players in a season
-- group with no payment for this month, reminded once a month.
-- Marks them as reminded and returns who to email.
create or replace function public.due_group_fee_reminders()
returns table (
  player_id uuid, name text, contact_name text, email text, group_name text,
  club_id uuid, club_name text, amount numeric, month date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Skopje')::date;
  v_month date := date_trunc('month', v_today)::date;
  r       record;
begin
  if extract(day from v_today) < 10 then
    return;
  end if;
  for r in
    select gp.id, gp.name, gp.contact_name, gp.email, gp.profile_id,
           g.name as group_name, g.id as group_id, g.club_id, c.name as club_name,
           coalesce(gp.monthly_price, g.price) as amount
    from public.group_players gp
    join public.groups g on g.id = gp.group_id
    join public.clubs c on c.id = g.club_id
    where gp.status = 'active'
      and g.kind = 'season'
      and g.archived_at is null
      and coalesce(gp.monthly_price, g.price) > 0
      and g.starts_on <= (v_month + interval '1 month - 1 day')::date
      and g.ends_on >= v_month
      and gp.joined_on < v_month + 10
      and gp.fee_reminded_month is distinct from v_month
      and not exists (select 1 from public.group_fees f where f.player_id = gp.id and f.month = v_month)
      -- Only months the group actually meets in
      and exists (select 1 from public.group_sessions s
                  where s.group_id = g.id and s.status = 'scheduled'
                    and s.starts_at >= v_month and s.starts_at < v_month + interval '1 month')
    for update of gp
  loop
    update public.group_players set fee_reminded_month = v_month where id = r.id;
    perform public.notify(
      coalesce(r.profile_id, (select u.id from auth.users u where r.email is not null
                                and lower(u.email) = r.email and u.email_confirmed_at is not null limit 1)),
      r.club_id, 'group_fee_due',
      jsonb_build_object('name', r.name, 'group', r.group_name, 'group_id', r.group_id,
                         'amount', r.amount, 'month', v_month),
      '/groups', 'group_fee_due:' || r.id::text || ':' || v_month::text
    );
    player_id := r.id; name := r.name; contact_name := r.contact_name; email := r.email;
    group_name := r.group_name; club_id := r.club_id; club_name := r.club_name;
    amount := r.amount; month := v_month;
    return next;
  end loop;
end;
$$;

-- The club adds someone with an email that has an account: tell them.
create or replace function public.notify_group_player_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_g    record;
  v_user uuid;
begin
  if (select auth.uid()) is null or new.status not in ('active', 'trial') then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status in ('active', 'trial') then
    return null;
  end if;
  if new.source = 'online' and tg_op = 'INSERT' then
    return null;  -- they signed up themselves
  end if;
  select g.id, g.name, g.club_id into v_g from public.groups g where g.id = new.group_id;
  v_user := coalesce(new.profile_id, (select u.id from auth.users u
                                      where new.email is not null and lower(u.email) = new.email
                                        and u.email_confirmed_at is not null limit 1));
  perform public.notify(
    v_user, v_g.club_id, 'group_added',
    jsonb_build_object('name', new.name, 'group', v_g.name, 'group_id', v_g.id),
    '/groups', 'group_added:' || new.id::text
  );
  return null;
exception when others then
  raise warning 'notify_group_player_added: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists group_players_notify on public.group_players;
create trigger group_players_notify
  after insert or update of status on public.group_players
  for each row execute function public.notify_group_player_added();


-- ----------------------------------------------------------------------------
-- 6. NOTIFICATION TYPES
--
-- Same as in 20261022_notifications.sql, plus the group kinds.
-- ----------------------------------------------------------------------------
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
    else 'always'
  end;
$$;


-- ----------------------------------------------------------------------------
-- 7. WHO MAY CALL WHAT
-- ----------------------------------------------------------------------------
revoke execute on function public.group_dates(smallint[], date, date, jsonb) from public;
grant execute on function public.group_dates(smallint[], date, date, jsonb) to authenticated, anon;

revoke execute on function public.preview_group_sessions(uuid, uuid, uuid, smallint[], time, time, date, date, jsonb, uuid) from public, anon;
revoke execute on function public.sync_group_sessions(uuid, jsonb) from public, anon;
revoke execute on function public.cancel_group_session(uuid, text) from public, anon;
revoke execute on function public.restore_group_session(uuid) from public, anon;
revoke execute on function public.move_group_session(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke execute on function public.save_group_register(uuid, jsonb, text) from public, anon;
revoke execute on function public.set_group_absence(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.join_group(uuid, text, integer, text, boolean, boolean) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.offer_group_places(uuid, uuid) from public, anon;
revoke execute on function public.book_group_session(uuid, text) from public, anon;
revoke execute on function public.unbook_group_session(uuid) from public, anon;
grant execute on function public.preview_group_sessions(uuid, uuid, uuid, smallint[], time, time, date, date, jsonb, uuid) to authenticated;
grant execute on function public.sync_group_sessions(uuid, jsonb) to authenticated;
grant execute on function public.cancel_group_session(uuid, text) to authenticated;
grant execute on function public.restore_group_session(uuid) to authenticated;
grant execute on function public.move_group_session(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.save_group_register(uuid, jsonb, text) to authenticated;
grant execute on function public.set_group_absence(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.join_group(uuid, text, integer, text, boolean, boolean) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.offer_group_places(uuid, uuid) to authenticated, service_role;
grant execute on function public.book_group_session(uuid, text) to authenticated;
grant execute on function public.unbook_group_session(uuid) to authenticated;

-- Offer links work without an account.
revoke execute on function public.group_offer_info(uuid) from public;
revoke execute on function public.respond_group_offer(uuid, boolean) from public;
grant execute on function public.group_offer_info(uuid) to anon, authenticated;
grant execute on function public.respond_group_offer(uuid, boolean) to anon, authenticated;

revoke execute on function public.public_groups(uuid) from public;
grant execute on function public.public_groups(uuid) to anon, authenticated;

-- Only the daily job.
revoke execute on function public.expire_group_offers() from public, anon, authenticated;
revoke execute on function public.due_group_fee_reminders() from public, anon, authenticated;
grant execute on function public.expire_group_offers() to service_role;
grant execute on function public.due_group_fee_reminders() to service_role;

-- Helpers the access rules use; not for calling directly.
revoke execute on function public.notify_group_player_added() from public, anon, authenticated;
revoke execute on function public.sync_group_booking() from public, anon, authenticated;

commit;
