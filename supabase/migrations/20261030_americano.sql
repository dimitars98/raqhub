-- ============================================================================
-- Kortello: Americano and Mexicano evenings (30 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261029b_polar_subscriptions.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A social evening on a few courts. Everyone signs up alone; each round the
-- players are put in fours, play one game to a set number of points (e.g.
-- 24: a game ends 15-9, 12-12 …) and every player keeps the points their
-- side won. Partners change every round.
--
--   americano   partners and opponents rotate so everyone plays with as
--               many different people as possible
--   mexicano    after round 1, players are grouped by points so far:
--               1st and 3rd play 2nd and 4th on the top court, and so on
--
--   social_events    one per evening, belongs to a club; holds its courts
--                    with bookings (booking_ids) so nobody else books them
--   social_players   who plays (a player who signed up, or a name the club typed)
--   social_matches   each round's games: a1+a2 against b1+b2, and the score
--   social_byes      who sits a round out (more players than places)
--
-- Who can do what
--   Everyone             see the evening, players, rounds and scores
--   The club (owner and staff)
--                        create and change evenings, add or remove players,
--                        make the rounds (in the app), enter any score
--   A signed-in player   sign up while sign-ups are open, withdraw, and
--                        enter the score of a game they are playing in
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.social_events (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 120),
  sport             text not null default 'padel' check (sport in ('tennis', 'padel', 'pickleball')),
  format            text not null default 'americano' check (format in ('americano', 'mexicano')),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  -- The courts it is played on, in order: the first is court 1 (the top
  -- court in a Mexicano).
  court_ids         uuid[] not null default '{}',
  -- A game is over when both sides' points add up to this.
  points_per_match  smallint not null default 24 check (points_per_match between 8 and 64),
  max_players       integer not null default 16 check (max_players between 4 and 64),
  entry_fee         numeric(10, 2) check (entry_fee is null or entry_fee >= 0),
  level_min         numeric(2, 1) check (level_min is null or level_min between 1 and 7),
  level_max         numeric(2, 1) check (level_max is null or level_max between 1 and 7),
  description       text check (description is null or char_length(description) <= 2000),
  -- open: taking sign-ups · running: rounds being played · finished
  status            text not null default 'open' check (status in ('open', 'running', 'finished')),
  -- The bookings that hold its courts.
  booking_ids       uuid[] not null default '{}',
  created_at        timestamptz not null default now(),
  constraint social_events_times check (ends_at > starts_at),
  constraint social_events_levels check (level_min is null or level_max is null or level_min <= level_max)
);

create index if not exists social_events_club_idx on public.social_events (club_id, starts_at desc);

create table if not exists public.social_players (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.social_events(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  -- Set when a player signed up themselves; null when the club added a name.
  player_id   uuid references public.profiles(id) on delete set null,
  level       numeric(2, 1) check (level is null or level between 1 and 7),
  -- withdrawn: left during the evening; their games so far still count.
  status      text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at  timestamptz not null default now()
);

create index if not exists social_players_event_idx on public.social_players (event_id);
create unique index if not exists social_players_one_per_player
  on public.social_players (event_id, player_id) where player_id is not null;

create table if not exists public.social_matches (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.social_events(id) on delete cascade,
  round        integer not null check (round >= 1),
  -- 0 is the first of the event's courts.
  court_index  integer not null check (court_index >= 0),
  a1           uuid not null references public.social_players(id) on delete cascade,
  a2           uuid not null references public.social_players(id) on delete cascade,
  b1           uuid not null references public.social_players(id) on delete cascade,
  b2           uuid not null references public.social_players(id) on delete cascade,
  score_a      smallint,
  score_b      smallint,
  reported_by  uuid references public.profiles(id) on delete set null,
  reported_at  timestamptz,
  unique (event_id, round, court_index),
  constraint social_matches_four check (
    a1 <> a2 and a1 <> b1 and a1 <> b2 and a2 <> b1 and a2 <> b2 and b1 <> b2)
);

create index if not exists social_matches_event_idx on public.social_matches (event_id, round);

create table if not exists public.social_byes (
  event_id   uuid not null references public.social_events(id) on delete cascade,
  round      integer not null check (round >= 1),
  player     uuid not null references public.social_players(id) on delete cascade,
  primary key (event_id, round, player)
);


-- ----------------------------------------------------------------------------
-- 2. WHO RUNS AN EVENING
-- ----------------------------------------------------------------------------
create or replace function public.social_club(p_event uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select club_id from public.social_events where id = p_event;
$$;

create or replace function public.manages_social(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.manages_club(public.social_club(p_event)), false);
$$;

revoke execute on function public.social_club(uuid) from public, anon;
revoke execute on function public.manages_social(uuid) from public, anon;
grant execute on function public.social_club(uuid) to authenticated;
grant execute on function public.manages_social(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. ACCESS RULES
-- ----------------------------------------------------------------------------
alter table public.social_events enable row level security;
alter table public.social_players enable row level security;
alter table public.social_matches enable row level security;
alter table public.social_byes enable row level security;

drop policy if exists "social_events_select_all" on public.social_events;
create policy "social_events_select_all" on public.social_events for select using (true);
drop policy if exists "social_events_manage_club" on public.social_events;
create policy "social_events_manage_club" on public.social_events
  for all to authenticated
  using (public.manages_club(club_id))
  with check (public.manages_club(club_id));

drop policy if exists "social_players_select_all" on public.social_players;
create policy "social_players_select_all" on public.social_players for select using (true);
drop policy if exists "social_players_manage_club" on public.social_players;
create policy "social_players_manage_club" on public.social_players
  for all to authenticated
  using (public.manages_social(event_id))
  with check (public.manages_social(event_id));

drop policy if exists "social_matches_select_all" on public.social_matches;
create policy "social_matches_select_all" on public.social_matches for select using (true);
drop policy if exists "social_matches_manage_club" on public.social_matches;
create policy "social_matches_manage_club" on public.social_matches
  for all to authenticated
  using (public.manages_social(event_id))
  with check (public.manages_social(event_id));

drop policy if exists "social_byes_select_all" on public.social_byes;
create policy "social_byes_select_all" on public.social_byes for select using (true);
drop policy if exists "social_byes_manage_club" on public.social_byes;
create policy "social_byes_manage_club" on public.social_byes
  for all to authenticated
  using (public.manages_social(event_id))
  with check (public.manages_social(event_id));


-- ----------------------------------------------------------------------------
-- 4. READ-ONLY CLUBS (20261025_trial_lock.sql)
--
-- The club changes nothing while read-only and players can't sign up; a
-- running evening can still be finished (players enter scores).
-- ----------------------------------------------------------------------------
create or replace function public.guard_locked_social()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_club uuid;
begin
  if coalesce((select auth.role()), '') not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  -- (Separate branches: a row's fields may only be read on its own table.)
  if tg_table_name = 'social_events' then
    v_club := r.club_id;
  else
    v_club := public.social_club(r.event_id);
  end if;

  if v_club is null or not public.club_locked(v_club) then
    return coalesce(new, old);
  end if;
  if coalesce(public.manages_club(v_club), false) then
    raise exception 'club_locked'
      using hint = 'The club''s free trial has ended; the account is read-only until it is renewed.';
  end if;
  if tg_table_name = 'social_players' and tg_op = 'INSERT' then
    raise exception 'club_locked' using hint = 'Sign-ups are paused at this club.';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['social_events', 'social_players', 'social_matches', 'social_byes'] loop
    execute format('drop trigger if exists a_social_locked_guard on public.%I', t);
    execute format(
      'create trigger a_social_locked_guard before insert or update or delete on public.%I
         for each row execute function public.guard_locked_social()', t);
  end loop;
end;
$$;

-- Names trimmed; nobody moves to another evening.
create or replace function public.guard_social_player()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.event_id <> old.event_id then
    raise exception 'A player can''t move to another evening' using errcode = '22023';
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;

drop trigger if exists social_players_guard on public.social_players;
create trigger social_players_guard
  before insert or update on public.social_players
  for each row execute function public.guard_social_player();


-- ----------------------------------------------------------------------------
-- 5. THE EVENING'S PAGE
--
-- Everything in one call. player_id is never sent: a player only says
-- whether it is the signed-in user.
-- ----------------------------------------------------------------------------
create or replace function public.social_view(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ev as (
    select e.*, c.name as club_name, c.slug as club_slug, c.city as club_city
    from public.social_events e
    join public.clubs c on c.id = e.club_id
    where e.id = p_event
  )
  select case when not exists (select 1 from ev) then null else jsonb_build_object(
    'event', (select to_jsonb(ev) - 'club_name' - 'club_slug' - 'club_city' - 'booking_ids' from ev),
    'club', (select jsonb_build_object('name', club_name, 'slug', club_slug, 'city', club_city) from ev),
    'manages', coalesce(public.manages_club((select club_id from ev)), false),
    'courts', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name) order by x.i)
      from ev, unnest(ev.court_ids) with ordinality as x(id, i)
      join public.courts k on k.id = x.id), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'level', p.level, 'status', p.status, 'created_at', p.created_at,
        'mine', coalesce(p.player_id = (select auth.uid()), false)
      ) order by p.created_at)
      from public.social_players p where p.event_id = p_event), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'round', m.round, 'court_index', m.court_index,
        'a1', m.a1, 'a2', m.a2, 'b1', m.b1, 'b2', m.b2,
        'score_a', m.score_a, 'score_b', m.score_b,
        'reported_by_me', coalesce(m.reported_by = (select auth.uid()), false)
      ) order by m.round, m.court_index)
      from public.social_matches m where m.event_id = p_event), '[]'::jsonb),
    'byes', coalesce((
      select jsonb_agg(jsonb_build_object('round', b.round, 'player', b.player) order by b.round)
      from public.social_byes b where b.event_id = p_event), '[]'::jsonb)
  ) end;
$$;

revoke execute on function public.social_view(uuid) from public;
grant execute on function public.social_view(uuid) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. SIGNING UP, WITHDRAWING, SCORES
-- ----------------------------------------------------------------------------
create or replace function public.social_sign_up(p_event uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  e public.social_events;
  v_level numeric;
  v_count integer;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  -- Lock the evening so two last-minute sign-ups can't both take the last place.
  select * into e from public.social_events where id = p_event for update;
  if e.id is null or e.status <> 'open' then
    raise exception 'social_closed' using errcode = '22023';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'social_name' using errcode = '22023';
  end if;
  if exists (select 1 from public.social_players where event_id = p_event and player_id = v_me) then
    raise exception 'social_already' using errcode = '23505';
  end if;
  select count(*) into v_count from public.social_players where event_id = p_event and status = 'active';
  if v_count >= e.max_players then
    raise exception 'social_full' using errcode = '22023';
  end if;
  select level into v_level from public.player_levels where profile_id = v_me and sport = e.sport;
  if v_level is not null and (
       (e.level_min is not null and v_level < e.level_min)
    or (e.level_max is not null and v_level > e.level_max)) then
    raise exception 'social_level' using errcode = '22023';
  end if;

  insert into public.social_players (event_id, name, player_id, level)
  values (p_event, left(btrim(p_name), 120), v_me, v_level)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.social_withdraw(p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_status text;
begin
  if v_me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select status into v_status from public.social_events where id = p_event;
  if v_status = 'open' then
    delete from public.social_players where event_id = p_event and player_id = v_me;
  elsif v_status = 'running' then
    update public.social_players set status = 'withdrawn' where event_id = p_event and player_id = v_me;
  else
    raise exception 'social_closed' using errcode = '22023';
  end if;
end;
$$;

-- A game's score: side A's points (side B gets the rest). Null clears it
-- (club only). Players in the game can enter it while it's the latest round,
-- unless someone else already did.
create or replace function public.social_save_score(p_match uuid, p_score_a integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  m public.social_matches;
  e public.social_events;
  v_manager boolean;
  v_last integer;
begin
  if v_me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into m from public.social_matches where id = p_match for update;
  if m.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into e from public.social_events where id = m.event_id;
  v_manager := public.manages_club(e.club_id);

  if not v_manager then
    if not exists (
      select 1 from public.social_players p
      where p.id in (m.a1, m.a2, m.b1, m.b2) and p.player_id = v_me
    ) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    select max(round) into v_last from public.social_matches where event_id = m.event_id;
    if e.status <> 'running' or m.round <> v_last then
      raise exception 'social_round_done' using errcode = '22023';
    end if;
    if m.score_a is not null and m.reported_by is distinct from v_me then
      raise exception 'social_already_reported' using errcode = '22023';
    end if;
    if p_score_a is null then
      raise exception 'social_score' using errcode = '22023';
    end if;
  end if;

  if p_score_a is not null and (p_score_a < 0 or p_score_a > e.points_per_match) then
    raise exception 'social_score' using errcode = '22023';
  end if;

  update public.social_matches
  set score_a = p_score_a,
      score_b = case when p_score_a is null then null else e.points_per_match - p_score_a end,
      reported_by = case when p_score_a is null then null else v_me end,
      reported_at = case when p_score_a is null then null else now() end
  where id = m.id;
end;
$$;

revoke execute on function public.social_sign_up(uuid, text) from public, anon;
revoke execute on function public.social_withdraw(uuid) from public, anon;
revoke execute on function public.social_save_score(uuid, integer) from public, anon;
grant execute on function public.social_sign_up(uuid, text) to authenticated;
grant execute on function public.social_withdraw(uuid) to authenticated;
grant execute on function public.social_save_score(uuid, integer) to authenticated;

commit;
