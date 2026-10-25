-- ============================================================================
-- Kortello: open matches and player levels (26 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261025_trial_lock.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A player books a court as usual and opens it to others ("we need two more
-- for padel tomorrow at 19:00"). Players at a similar level join; everyone
-- pays their share at the club. The court is the organiser's ordinary
-- booking, so the timetable, booking rules and no-shows all work as before.
--
--   player_levels         each player's level per sport, 1.0 to 7.0, which a
--                         club can confirm ("Checked by <club>")
--   open_matches          one per opened booking
--   open_match_players    who plays (or asked to: outside the level range)
--   open_match_messages   a short chat for the players of one match
--   clubs.open_matches    the club's settings: on/off, sports, when an
--                         unfilled court goes back, members only
--
-- If a match isn't full a few hours before it starts (the club picks 6, 12
-- or 24), the organiser is asked whether to keep the court. With no answer
-- the court is given back and goes on sale again. The hourly job does this
-- (run_open_match_jobs).
--
-- Everything goes through the functions below; the tables can't be written
-- directly from the app.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- The club's settings. Missing = the defaults in match_settings() below.
alter table public.clubs
  add column if not exists open_matches jsonb;

alter table public.clubs
  drop constraint if exists clubs_open_matches_shape;
alter table public.clubs
  add constraint clubs_open_matches_shape check (
    open_matches is null or jsonb_typeof(open_matches) = 'object'
  );

create table if not exists public.player_levels (
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  sport               text not null check (sport in ('tennis', 'padel', 'pickleball')),
  -- 1.0 to 7.0 in steps of 0.5
  level               numeric(2, 1) not null
                      check (level between 1 and 7 and level * 2 = round(level * 2)),
  -- A club confirmed it (a coach watched them play).
  confirmed_by_club   uuid references public.clubs(id) on delete set null,
  confirmed_at        timestamptz,
  -- The player asked this club to confirm it.
  check_club          uuid references public.clubs(id) on delete set null,
  check_requested_at  timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (profile_id, sport)
);

create index if not exists player_levels_check_idx
  on public.player_levels (check_club) where check_club is not null;

create table if not exists public.open_matches (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  -- The organiser's court booking. Cancelling it cancels the match.
  booking_id     uuid not null unique references public.bookings(id) on delete cascade,
  organiser_id   uuid not null references public.profiles(id) on delete cascade,
  court_id       uuid references public.courts(id) on delete set null,
  sport          text not null check (sport in ('tennis', 'padel', 'pickleball')),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  level_min      numeric(2, 1) not null check (level_min between 1 and 7),
  level_max      numeric(2, 1) not null check (level_max between 1 and 7),
  -- Only a label for now: results don't change anyone's level.
  competitive    boolean not null default false,
  max_players    smallint not null check (max_players in (2, 4)),
  -- The court price split between the players, paid at the club.
  price_each     numeric(10, 2) not null default 0 check (price_each >= 0),
  note           text check (note is null or char_length(note) <= 300),
  -- open: on the list · cancelled: the organiser cancelled the court
  -- released: not full in time, the court went back to the club
  status         text not null default 'open' check (status in ('open', 'cancelled', 'released')),
  -- The organiser answered "keep the court" when asked.
  keep_court     boolean not null default false,
  keep_asked_at  timestamptz,
  released_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint open_matches_levels check (level_min <= level_max),
  constraint open_matches_times check (ends_at > starts_at)
);

create index if not exists open_matches_list_idx on public.open_matches (status, starts_at);
create index if not exists open_matches_club_idx on public.open_matches (club_id, starts_at desc);

create table if not exists public.open_match_players (
  match_id    uuid not null references public.open_matches(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  team        smallint not null check (team in (1, 2)),
  -- in: playing · requested: outside the level range, waiting for the organiser
  status      text not null default 'in' check (status in ('in', 'requested')),
  joined_at   timestamptz not null default now(),
  primary key (match_id, profile_id)
);

create index if not exists open_match_players_profile_idx on public.open_match_players (profile_id);

create table if not exists public.open_match_messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.open_matches(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists open_match_messages_match_idx on public.open_match_messages (match_id, created_at);


-- ----------------------------------------------------------------------------
-- 2. ACCESS RULES
--
-- A player reads their own levels. Everything else goes through the
-- functions in steps 4 to 7, which check who may do what and only ever show
-- other players as "Elena G.".
-- ----------------------------------------------------------------------------
alter table public.player_levels enable row level security;
alter table public.open_matches enable row level security;
alter table public.open_match_players enable row level security;
alter table public.open_match_messages enable row level security;

drop policy if exists "player_levels_select_own" on public.player_levels;
create policy "player_levels_select_own" on public.player_levels
  for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on public.player_levels from anon, authenticated;
revoke all on public.open_matches from anon, authenticated;
revoke all on public.open_match_players from anon, authenticated;
revoke all on public.open_match_messages from anon, authenticated;
grant select on public.player_levels to authenticated;


-- ----------------------------------------------------------------------------
-- 3. HELPERS
-- ----------------------------------------------------------------------------

-- "Elena Georgieva" → "Elena G."
create or replace function public.short_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    when position(' ' in btrim(p_name)) = 0 then btrim(p_name)
    else split_part(btrim(p_name), ' ', 1) || ' '
         || upper(left(regexp_replace(btrim(p_name), '^.*\s', ''), 1)) || '.'
  end;
$$;

-- The club's open match settings, with the defaults filled in.
-- Keep in step with src/lib/openMatches.ts.
create or replace function public.match_settings(p_club uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', coalesce((c.open_matches ->> 'enabled')::boolean, true),
    'sports', case
                when jsonb_typeof(c.open_matches -> 'sports') = 'array'
                then c.open_matches -> 'sports'
                else '["tennis", "padel", "pickleball"]'::jsonb
              end,
    'release_hours', coalesce((c.open_matches ->> 'release_hours')::int, 6),
    'members_only', coalesce((c.open_matches ->> 'members_only')::boolean, false)
  )
  from public.clubs c
  where c.id = p_club;
$$;

-- The signed-in user has an active membership at this club.
create or replace function public.is_club_member(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.club_id = p_club
      and m.status = 'active'
      and m.email is not null
      and lower(m.email) = public.my_confirmed_email()
  );
$$;

-- Players in a match (not those who only asked to join).
create or replace function public.match_taken(p_match uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.open_match_players p
  where p.match_id = p_match and p.status = 'in';
$$;

-- Until when players can leave a match online: the club's cancel deadline
-- for bookings, or the start when it has none.
create or replace function public.match_leave_until(p_match uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select m.starts_at - make_interval(hours => coalesce((c.booking_rules ->> 'cancel_hours')::int, 0))
  from public.open_matches m
  join public.clubs c on c.id = m.club_id
  where m.id = p_match;
$$;

-- The players of a match as the app shows them. p_full adds each player's
-- id (for the organiser's Remove button and the club).
create or replace function public.match_players_json(p_match uuid, p_status text, p_full boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', coalesce(public.short_name(pr.full_name), 'Player'),
      'level', pl.level,
      'checked', pl.confirmed_at is not null,
      'team', p.team,
      'organiser', p.profile_id = m.organiser_id,
      'me', coalesce(p.profile_id = (select auth.uid()), false)
    ) || case when p_full then jsonb_build_object('id', p.profile_id) else '{}'::jsonb end
    order by p.team, (p.profile_id = m.organiser_id) desc, p.joined_at
  ), '[]'::jsonb)
  from public.open_match_players p
  join public.open_matches m on m.id = p.match_id
  left join public.profiles pr on pr.id = p.profile_id
  left join public.player_levels pl on pl.profile_id = p.profile_id and pl.sport = m.sport
  where p.match_id = p_match and p.status = p_status;
$$;

-- What every list shows about a match.
create or replace function public.match_card_json(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'sport', m.sport,
    'starts_at', m.starts_at,
    'ends_at', m.ends_at,
    'level_min', m.level_min,
    'level_max', m.level_max,
    'competitive', m.competitive,
    'max_players', m.max_players,
    'price_each', m.price_each,
    'status', m.status,
    'taken', public.match_taken(m.id),
    'court', k.name,
    'indoor', k.is_indoor,
    'club', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'city', c.city),
    'members_only', coalesce((public.match_settings(c.id) ->> 'members_only')::boolean, false),
    'players', public.match_players_json(m.id, 'in', false),
    'mine', (select p.status from public.open_match_players p
             where p.match_id = m.id and p.profile_id = (select auth.uid())),
    'organiser', coalesce(m.organiser_id = (select auth.uid()), false)
  )
  from public.open_matches m
  join public.clubs c on c.id = m.club_id
  left join public.courts k on k.id = m.court_id
  where m.id = p_match;
$$;


-- ----------------------------------------------------------------------------
-- 4. LEVELS
-- ----------------------------------------------------------------------------

-- A player sets their own level. A different level drops the club's check.
create or replace function public.set_my_level(p_sport text, p_level numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Please sign in' using errcode = '42501';
  end if;
  if p_sport not in ('tennis', 'padel', 'pickleball') then
    raise exception 'Unknown sport' using errcode = '22023';
  end if;
  if p_level is null or p_level < 1 or p_level > 7 or p_level * 2 <> round(p_level * 2) then
    raise exception 'Levels go from 1.0 to 7.0' using errcode = '22023';
  end if;

  insert into public.player_levels as pl (profile_id, sport, level, updated_at)
  values (v_uid, p_sport, p_level, now())
  on conflict (profile_id, sport) do update
    set level = excluded.level,
        updated_at = now(),
        confirmed_by_club = case when pl.level = excluded.level then pl.confirmed_by_club end,
        confirmed_at = case when pl.level = excluded.level then pl.confirmed_at end;
end;
$$;

-- A player asks a club to confirm their level. The club sees it on its
-- Open matches page.
create or replace function public.request_level_check(p_sport text, p_club uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_level numeric;
  v_name  text;
begin
  select level into v_level from public.player_levels
  where profile_id = v_uid and sport = p_sport;
  if v_level is null then
    raise exception 'Set your level first' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clubs c where c.id = p_club and c.is_active) then
    raise exception 'Club not found' using errcode = '22023';
  end if;

  update public.player_levels
     set check_club = p_club, check_requested_at = now()
   where profile_id = v_uid and sport = p_sport;

  select full_name into v_name from public.profiles where id = v_uid;
  perform public.notify_club(
    p_club, 'level_check',
    jsonb_build_object('who', coalesce(v_name, 'Player'), 'sport', p_sport, 'level', v_level),
    '/admin/matches', false,
    'level_check:' || v_uid::text || ':' || p_sport || ':' || now()::date::text
  );
end;
$$;

-- The club confirms (or corrects) a player's level.
create or replace function public.confirm_player_level(p_profile uuid, p_sport text, p_level numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
  v_club_name text;
begin
  select check_club into v_club from public.player_levels
  where profile_id = p_profile and sport = p_sport
  for update;
  if v_club is null or not coalesce(public.manages_club(v_club), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if public.club_locked(v_club) then
    raise exception 'club_locked';
  end if;
  if p_level is null or p_level < 1 or p_level > 7 or p_level * 2 <> round(p_level * 2) then
    raise exception 'Levels go from 1.0 to 7.0' using errcode = '22023';
  end if;

  update public.player_levels
     set level = p_level, confirmed_by_club = v_club, confirmed_at = now(),
         check_club = null, check_requested_at = null, updated_at = now()
   where profile_id = p_profile and sport = p_sport;

  select name into v_club_name from public.clubs where id = v_club;
  perform public.notify(
    p_profile, v_club, 'level_confirmed',
    jsonb_build_object('club', v_club_name, 'sport', p_sport, 'level', p_level),
    '/matches/level', null
  );
end;
$$;

-- The club turns a request down without changing anything.
create or replace function public.dismiss_level_check(p_profile uuid, p_sport text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
begin
  select check_club into v_club from public.player_levels
  where profile_id = p_profile and sport = p_sport;
  if v_club is null or not coalesce(public.manages_club(v_club), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.player_levels
     set check_club = null, check_requested_at = null
   where profile_id = p_profile and sport = p_sport;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. WHAT PLAYERS DO
-- ----------------------------------------------------------------------------

-- Opens a court booking the player just made as a match.
create or replace function public.create_open_match(
  p_booking uuid,
  p_level_min numeric,
  p_level_max numeric,
  p_competitive boolean,
  p_max_players integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  b          record;
  v_settings jsonb;
  v_id       uuid;
begin
  select bk.id, bk.player_id, bk.court_id, bk.coach_id, bk.group_id, bk.status,
         bk.starts_at, bk.ends_at, bk.duration_min,
         k.club_id, k.sport::text as sport, k.price_per_hour
    into b
  from public.bookings bk
  join public.courts k on k.id = bk.court_id
  where bk.id = p_booking;

  if b.id is null or b.player_id is distinct from v_uid
     or b.coach_id is not null or b.group_id is not null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if b.status not in ('confirmed', 'pending') or b.starts_at <= now() then
    raise exception 'This booking can''t be opened as a match' using errcode = '22023';
  end if;
  if public.club_locked(b.club_id) then
    raise exception 'club_locked';
  end if;

  v_settings := public.match_settings(b.club_id);
  if not (v_settings ->> 'enabled')::boolean
     or not (v_settings -> 'sports') @> to_jsonb(b.sport) then
    raise exception 'This club doesn''t take open matches for this sport' using errcode = '22023';
  end if;
  if (v_settings ->> 'members_only')::boolean
     and not public.is_club_member(b.club_id)
     and not coalesce(public.manages_club(b.club_id), false) then
    raise exception 'Open matches at this club are for members only' using errcode = '22023';
  end if;

  if p_level_min is null or p_level_max is null
     or p_level_min < 1 or p_level_max > 7 or p_level_min > p_level_max
     or p_level_min * 2 <> round(p_level_min * 2) or p_level_max * 2 <> round(p_level_max * 2) then
    raise exception 'Levels go from 1.0 to 7.0' using errcode = '22023';
  end if;
  -- Padel is always doubles; tennis and pickleball can be singles too.
  if p_max_players not in (2, 4) or (b.sport = 'padel' and p_max_players <> 4) then
    raise exception 'A match is for 2 or 4 players' using errcode = '22023';
  end if;

  if exists (select 1 from public.open_matches where booking_id = b.id) then
    raise exception 'Already open as a match' using errcode = '23505';
  end if;

  insert into public.open_matches (
    club_id, booking_id, organiser_id, court_id, sport, starts_at, ends_at,
    level_min, level_max, competitive, max_players, price_each, note
  ) values (
    b.club_id, b.id, v_uid, b.court_id, b.sport, b.starts_at, b.ends_at,
    p_level_min, p_level_max, coalesce(p_competitive, false), p_max_players,
    round(b.price_per_hour * b.duration_min / 60.0 / p_max_players, 2),
    nullif(btrim(left(coalesce(p_note, ''), 300)), '')
  )
  returning id into v_id;

  insert into public.open_match_players (match_id, profile_id, team, status)
  values (v_id, v_uid, 1, 'in');

  return v_id;
end;
$$;

-- Joins a match. Returns 'in', or 'requested' when the player's level is
-- outside the range (the organiser then decides).
create or replace function public.join_open_match(p_match uuid, p_team integer default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  m          record;
  v_level    numeric;
  v_taken    integer;
  v_team     integer;
  v_per_team integer;
  v_status   text;
  v_name     text;
  v_data     jsonb;
  r          record;
begin
  if v_uid is null then
    raise exception 'Please sign in' using errcode = '42501';
  end if;

  -- Lock the match so two players can't both take the last place.
  select om.*, c.name as club_name, k.name as court_name
    into m
  from public.open_matches om
  join public.clubs c on c.id = om.club_id
  left join public.courts k on k.id = om.court_id
  where om.id = p_match
  for update of om;

  if m.id is null or m.status <> 'open' or m.starts_at <= now() then
    raise exception 'This match is no longer open' using errcode = '22023';
  end if;
  if public.club_locked(m.club_id) then
    raise exception 'club_locked';
  end if;
  if exists (select 1 from public.open_match_players
             where match_id = p_match and profile_id = v_uid) then
    raise exception 'Already in this match' using errcode = '23505';
  end if;
  if (public.match_settings(m.club_id) ->> 'members_only')::boolean
     and not public.is_club_member(m.club_id)
     and not coalesce(public.manages_club(m.club_id), false) then
    raise exception 'Open matches at this club are for members only' using errcode = '22023';
  end if;

  select level into v_level from public.player_levels
  where profile_id = v_uid and sport = m.sport;
  if v_level is null then
    raise exception 'Set your level first' using errcode = '22023';
  end if;

  v_taken := public.match_taken(p_match);
  if v_taken >= m.max_players then
    raise exception 'This match is full' using errcode = '22023';
  end if;

  -- The team asked for, or the other one when it's full.
  v_per_team := m.max_players / 2;
  v_team := case when p_team in (1, 2) then p_team else 2 end;
  if (select count(*) from public.open_match_players
      where match_id = p_match and status = 'in' and team = v_team) >= v_per_team then
    v_team := 3 - v_team;
  end if;

  v_status := case when v_level between m.level_min and m.level_max then 'in' else 'requested' end;

  insert into public.open_match_players (match_id, profile_id, team, status)
  values (p_match, v_uid, v_team, v_status);

  select full_name into v_name from public.profiles where id = v_uid;
  v_data := jsonb_build_object(
    'who', coalesce(public.short_name(v_name), 'Player'),
    'level', v_level,
    'court', m.court_name, 'club', m.club_name,
    'starts_at', m.starts_at, 'ends_at', m.ends_at,
    'count', v_taken + case when v_status = 'in' then 1 else 0 end,
    'max', m.max_players
  );

  if v_status = 'requested' then
    perform public.notify(m.organiser_id, m.club_id, 'match_request', v_data,
                          '/matches/' || p_match::text, null);
  elsif v_taken + 1 >= m.max_players then
    -- Now full: everyone hears it.
    for r in
      select profile_id from public.open_match_players
      where match_id = p_match and status = 'in'
    loop
      perform public.notify(r.profile_id, m.club_id, 'match_full', v_data,
                            '/matches/' || p_match::text, 'match_full:' || p_match::text);
    end loop;
  else
    perform public.notify(m.organiser_id, m.club_id, 'match_joined', v_data,
                          '/matches/' || p_match::text, null);
  end if;

  return v_status;
end;
$$;

-- The organiser lets in (or turns down) a player who asked to join.
create or replace function public.answer_match_request(p_match uuid, p_profile uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m        record;
  v_team   smallint;
  v_taken  integer;
  v_data   jsonb;
  r        record;
begin
  select om.*, c.name as club_name, k.name as court_name
    into m
  from public.open_matches om
  join public.clubs c on c.id = om.club_id
  left join public.courts k on k.id = om.court_id
  where om.id = p_match
  for update of om;

  if m.id is null or m.organiser_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select team into v_team from public.open_match_players
  where match_id = p_match and profile_id = p_profile and status = 'requested';
  if v_team is null then
    raise exception 'No such request' using errcode = '22023';
  end if;

  v_data := jsonb_build_object('court', m.court_name, 'club', m.club_name,
                               'starts_at', m.starts_at, 'ends_at', m.ends_at,
                               'accepted', coalesce(p_accept, false));

  if not coalesce(p_accept, false) then
    delete from public.open_match_players where match_id = p_match and profile_id = p_profile;
    perform public.notify(p_profile, m.club_id, 'match_answer', v_data, '/matches', null);
    return;
  end if;

  if m.status <> 'open' or m.starts_at <= now() then
    raise exception 'This match is no longer open' using errcode = '22023';
  end if;
  v_taken := public.match_taken(p_match);
  if v_taken >= m.max_players then
    raise exception 'This match is full' using errcode = '22023';
  end if;
  if (select count(*) from public.open_match_players
      where match_id = p_match and status = 'in' and team = v_team) >= m.max_players / 2 then
    v_team := 3 - v_team;
  end if;

  update public.open_match_players
     set status = 'in', team = v_team, joined_at = now()
   where match_id = p_match and profile_id = p_profile;

  perform public.notify(p_profile, m.club_id, 'match_answer', v_data,
                        '/matches/' || p_match::text, null);

  if v_taken + 1 >= m.max_players then
    v_data := v_data || jsonb_build_object('count', v_taken + 1, 'max', m.max_players);
    for r in
      select profile_id from public.open_match_players
      where match_id = p_match and status = 'in' and profile_id <> p_profile
    loop
      perform public.notify(r.profile_id, m.club_id, 'match_full', v_data,
                            '/matches/' || p_match::text, 'match_full:' || p_match::text);
    end loop;
  end if;
end;
$$;

-- A player leaves (or withdraws a request). Not the organiser: they cancel
-- the court instead. After the club's cancel deadline only the organiser can
-- take them off.
create or replace function public.leave_open_match(p_match uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  m        record;
  v_status text;
  v_name   text;
begin
  select om.*, c.name as club_name, k.name as court_name
    into m
  from public.open_matches om
  join public.clubs c on c.id = om.club_id
  left join public.courts k on k.id = om.court_id
  where om.id = p_match
  for update of om;

  select status into v_status from public.open_match_players
  where match_id = p_match and profile_id = v_uid;
  if m.id is null or v_status is null then
    raise exception 'Not in this match' using errcode = '22023';
  end if;
  if m.organiser_id = v_uid then
    raise exception 'The organiser cancels the court instead' using errcode = '22023';
  end if;
  if v_status = 'in' and m.status = 'open'
     and public.match_leave_until(p_match) <= now() then
    raise exception 'Too late to leave online' using errcode = '22023';
  end if;

  delete from public.open_match_players where match_id = p_match and profile_id = v_uid;

  if v_status = 'in' and m.status = 'open' then
    select full_name into v_name from public.profiles where id = v_uid;
    perform public.notify(
      m.organiser_id, m.club_id, 'match_left',
      jsonb_build_object('who', coalesce(public.short_name(v_name), 'Player'),
                         'court', m.court_name, 'club', m.club_name,
                         'starts_at', m.starts_at, 'ends_at', m.ends_at,
                         'count', public.match_taken(p_match), 'max', m.max_players),
      '/matches/' || p_match::text, null
    );
  end if;
end;
$$;

-- The organiser takes a player off the match.
create or replace function public.remove_match_player(p_match uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select om.*, c.name as club_name, k.name as court_name
    into m
  from public.open_matches om
  join public.clubs c on c.id = om.club_id
  left join public.courts k on k.id = om.court_id
  where om.id = p_match;

  if m.id is null or m.organiser_id is distinct from (select auth.uid())
     or p_profile = m.organiser_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  delete from public.open_match_players where match_id = p_match and profile_id = p_profile;
  if found and m.status = 'open' and m.starts_at > now() then
    perform public.notify(
      p_profile, m.club_id, 'match_removed',
      jsonb_build_object('court', m.court_name, 'club', m.club_name,
                         'starts_at', m.starts_at, 'ends_at', m.ends_at),
      '/matches', null
    );
  end if;
end;
$$;

-- The organiser's answer to "keep the court?". Giving it back early is done
-- by cancelling the booking, like any other.
create or replace function public.keep_match_court(p_match uuid, p_keep boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.open_matches
     set keep_court = coalesce(p_keep, false)
   where id = p_match
     and organiser_id = (select auth.uid())
     and status = 'open';
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

-- A message to the other players of a match.
create or replace function public.post_match_message(p_match uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.open_match_players
                 where match_id = p_match and profile_id = v_uid and status = 'in') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.open_match_messages where match_id = p_match) >= 200 then
    raise exception 'Too many messages' using errcode = '22023';
  end if;
  insert into public.open_match_messages (match_id, profile_id, body)
  values (p_match, v_uid, btrim(left(p_body, 500)));
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. WHAT THE APP READS
-- ----------------------------------------------------------------------------

-- Upcoming open matches, the signed-in player's own first. Optionally for one
-- club and one sport. Visitors get the same list (club pages show it).
create or replace function public.open_match_feed(p_club uuid default null, p_sport text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.match_card_json(x.id) order by x.mine desc, x.starts_at), '[]'::jsonb)
  from (
    select m.id, m.starts_at,
           exists (select 1 from public.open_match_players p
                   where p.match_id = m.id and p.profile_id = (select auth.uid())) as mine
    from public.open_matches m
    join public.clubs c on c.id = m.club_id
    where m.status = 'open'
      and m.starts_at > now()
      and c.is_active
      and coalesce((public.match_settings(c.id) ->> 'enabled')::boolean, true)
      -- A club whose trial ended takes no new players; its players still see theirs.
      and (not public.club_locked(c.id)
           or exists (select 1 from public.open_match_players p
                      where p.match_id = m.id and p.profile_id = (select auth.uid())))
      and (p_club is null or m.club_id = p_club)
      and (p_sport is null or m.sport = p_sport)
    order by mine desc, m.starts_at
    limit 60
  ) x;
$$;

-- One match, with what the signed-in player may see and do.
create or replace function public.open_match_detail(p_match uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  m           record;
  v_mine      text;
  v_organiser boolean;
  v_manager   boolean;
  v_card      jsonb;
  v_release   timestamptz;
begin
  select om.*, c.phone as club_phone, c.address as club_address
    into m
  from public.open_matches om
  join public.clubs c on c.id = om.club_id
  where om.id = p_match;
  if m.id is null then
    return null;
  end if;

  select status into v_mine from public.open_match_players
  where match_id = p_match and profile_id = v_uid;
  v_organiser := coalesce(m.organiser_id = v_uid, false);
  v_manager := coalesce(public.manages_club(m.club_id), false);
  v_release := m.starts_at - make_interval(hours => (public.match_settings(m.club_id) ->> 'release_hours')::int);

  v_card := public.match_card_json(p_match);
  if v_organiser or v_manager then
    v_card := v_card || jsonb_build_object('players', public.match_players_json(p_match, 'in', true));
  end if;

  return v_card || jsonb_build_object(
    -- The organiser cancels the match by cancelling this booking.
    'booking_id', case when v_organiser then m.booking_id end,
    'note', m.note,
    'keep_court', m.keep_court,
    'release_at', v_release,
    'leave_until', public.match_leave_until(p_match),
    'club_phone', m.club_phone,
    'club_address', m.club_address,
    'requests', case when v_organiser
                     then public.match_players_json(p_match, 'requested', true)
                     else '[]'::jsonb end,
    'messages', case when v_mine = 'in' or v_manager then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', coalesce(public.short_name(pr.full_name), 'Player'),
                 'body', msg.body,
                 'at', msg.created_at,
                 'me', coalesce(msg.profile_id = v_uid, false))
               order by msg.created_at)
        from public.open_match_messages msg
        left join public.profiles pr on pr.id = msg.profile_id
        where msg.match_id = p_match
      ), '[]'::jsonb) else null end
  );
end;
$$;

-- Clubs where a player can start a match, with the sports each one takes.
create or replace function public.open_match_clubs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'slug', c.slug, 'city', c.city,
    'sports', public.match_settings(c.id) -> 'sports',
    'members_only', (public.match_settings(c.id) ->> 'members_only')::boolean,
    'member', public.is_club_member(c.id)
  ) order by c.name), '[]'::jsonb)
  from public.clubs c
  where c.is_active
    and (public.match_settings(c.id) ->> 'enabled')::boolean
    and not public.club_locked(c.id)
    and exists (select 1 from public.courts k where k.club_id = c.id and k.is_active);
$$;

-- The club's Open matches page.
create or replace function public.club_open_matches(p_club uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week_start timestamptz := now() - interval '7 days';
begin
  if not coalesce(public.manages_club(p_club), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'settings', public.match_settings(p_club),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'sport', m.sport, 'starts_at', m.starts_at, 'ends_at', m.ends_at,
        'court', k.name, 'level_min', m.level_min, 'level_max', m.level_max,
        'competitive', m.competitive, 'max_players', m.max_players,
        'taken', public.match_taken(m.id), 'status', m.status, 'keep_court', m.keep_court,
        'organiser', coalesce(public.short_name(pr.full_name), 'Player')
      ) order by m.starts_at)
      from public.open_matches m
      left join public.courts k on k.id = m.court_id
      left join public.profiles pr on pr.id = m.organiser_id
      where m.club_id = p_club
        and m.starts_at > now()
        and m.starts_at < now() + interval '14 days'
        and m.status in ('open', 'released')
    ), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'opened', count(*),
        'filled', count(*) filter (where public.match_taken(m.id) >= m.max_players),
        'released', count(*) filter (where m.status = 'released'),
        'players', (select count(distinct p.profile_id)
                    from public.open_match_players p
                    join public.open_matches m2 on m2.id = p.match_id
                    where m2.club_id = p_club and p.status = 'in'
                      and m2.created_at > v_week_start
                      and m2.status <> 'cancelled')
      )
      from public.open_matches m
      where m.club_id = p_club and m.created_at > v_week_start and m.status <> 'cancelled'
    ),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pl.profile_id, 'name', coalesce(pr.full_name, 'Player'),
        'sport', pl.sport, 'level', pl.level, 'requested_at', pl.check_requested_at
      ) order by pl.check_requested_at)
      from public.player_levels pl
      left join public.profiles pr on pr.id = pl.profile_id
      where pl.check_club = p_club
    ), '[]'::jsonb)
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 7. CANCELLING AND GIVING COURTS BACK
-- ----------------------------------------------------------------------------

-- The organiser (or the club) cancels the court: the match is off, and the
-- other players hear about it.
create or replace function public.sync_open_match_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  r record;
begin
  for m in
    update public.open_matches om
       set status = 'cancelled'
     where om.booking_id = new.id and om.status = 'open'
    returning om.id, om.club_id, om.organiser_id, om.starts_at, om.ends_at, om.court_id
  loop
    for r in
      select p.profile_id from public.open_match_players p
      where p.match_id = m.id and p.profile_id <> m.organiser_id
    loop
      perform public.notify(
        r.profile_id, m.club_id, 'match_cancelled',
        jsonb_build_object('court', (select k.name from public.courts k where k.id = m.court_id),
                           'club', (select c.name from public.clubs c where c.id = m.club_id),
                           'starts_at', m.starts_at, 'ends_at', m.ends_at),
        '/matches', 'match_cancelled:' || m.id::text
      );
    end loop;
  end loop;
  return null;
end;
$$;

drop trigger if exists bookings_sync_open_match on public.bookings;
create trigger bookings_sync_open_match
  after update of status on public.bookings
  for each row
  when (new.status in ('cancelled', 'no_show') and old.status not in ('cancelled', 'no_show'))
  execute function public.sync_open_match_booking();

-- The hourly job: ask organisers of matches that aren't full whether to keep
-- the court, and give back the courts nobody kept.
create or replace function public.run_open_match_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          record;
  p          record;
  v_asked    integer := 0;
  v_released integer := 0;
  v_data     jsonb;
begin
  for r in
    select m.*, c.name as club_name, k.name as court_name,
           m.starts_at - make_interval(hours => (public.match_settings(m.club_id) ->> 'release_hours')::int) as release_at,
           public.match_taken(m.id) as taken
    from public.open_matches m
    join public.clubs c on c.id = m.club_id
    left join public.courts k on k.id = m.court_id
    where m.status = 'open'
      and not m.keep_court
      and m.starts_at > now()
    for update of m
  loop
    if r.taken >= r.max_players then
      continue;
    end if;
    v_data := jsonb_build_object('court', r.court_name, 'club', r.club_name,
                                 'starts_at', r.starts_at, 'ends_at', r.ends_at,
                                 'release_at', r.release_at,
                                 'count', r.taken, 'max', r.max_players);

    if r.release_at <= now() then
      -- Mark it first, so the booking trigger doesn't call it "cancelled".
      update public.open_matches
         set status = 'released', released_at = now()
       where id = r.id;
      update public.bookings
         set status = 'cancelled'
       where id = r.booking_id and status in ('confirmed', 'pending');
      for p in
        select profile_id from public.open_match_players where match_id = r.id
      loop
        perform public.notify(p.profile_id, r.club_id, 'match_released', v_data,
                              '/matches', 'match_released:' || r.id::text);
      end loop;
      v_released := v_released + 1;
    elsif r.keep_asked_at is null and r.release_at - interval '3 hours' <= now() then
      update public.open_matches set keep_asked_at = now() where id = r.id;
      perform public.notify(r.organiser_id, r.club_id, 'match_keep_ask', v_data,
                            '/matches/' || r.id::text, 'match_keep_ask:' || r.id::text);
      v_asked := v_asked + 1;
    end if;
  end loop;

  return jsonb_build_object('asked', v_asked, 'released', v_released);
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. NOTIFICATION TYPES
--
-- Same as in 20261024_groups.sql, plus the open match kinds.
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


-- ----------------------------------------------------------------------------
-- 9. WHO MAY CALL WHAT
-- ----------------------------------------------------------------------------
revoke execute on function public.match_settings(uuid) from public, anon;
revoke execute on function public.is_club_member(uuid) from public, anon;
revoke execute on function public.match_taken(uuid) from public, anon, authenticated;
revoke execute on function public.match_leave_until(uuid) from public, anon, authenticated;
revoke execute on function public.match_players_json(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.match_card_json(uuid) from public, anon, authenticated;
grant execute on function public.match_settings(uuid) to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;

revoke execute on function public.set_my_level(text, numeric) from public, anon;
revoke execute on function public.request_level_check(text, uuid) from public, anon;
revoke execute on function public.confirm_player_level(uuid, text, numeric) from public, anon;
revoke execute on function public.dismiss_level_check(uuid, text) from public, anon;
revoke execute on function public.create_open_match(uuid, numeric, numeric, boolean, integer, text) from public, anon;
revoke execute on function public.join_open_match(uuid, integer) from public, anon;
revoke execute on function public.answer_match_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.leave_open_match(uuid) from public, anon;
revoke execute on function public.remove_match_player(uuid, uuid) from public, anon;
revoke execute on function public.keep_match_court(uuid, boolean) from public, anon;
revoke execute on function public.post_match_message(uuid, text) from public, anon;
revoke execute on function public.open_match_detail(uuid) from public, anon;
revoke execute on function public.open_match_clubs() from public, anon;
revoke execute on function public.club_open_matches(uuid) from public, anon;
grant execute on function public.set_my_level(text, numeric) to authenticated;
grant execute on function public.request_level_check(text, uuid) to authenticated;
grant execute on function public.confirm_player_level(uuid, text, numeric) to authenticated;
grant execute on function public.dismiss_level_check(uuid, text) to authenticated;
grant execute on function public.create_open_match(uuid, numeric, numeric, boolean, integer, text) to authenticated;
grant execute on function public.join_open_match(uuid, integer) to authenticated;
grant execute on function public.answer_match_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_open_match(uuid) to authenticated;
grant execute on function public.remove_match_player(uuid, uuid) to authenticated;
grant execute on function public.keep_match_court(uuid, boolean) to authenticated;
grant execute on function public.post_match_message(uuid, text) to authenticated;
grant execute on function public.open_match_detail(uuid) to authenticated;
grant execute on function public.open_match_clubs() to authenticated;
grant execute on function public.club_open_matches(uuid) to authenticated;

-- The list is public: club pages show it to visitors too.
revoke execute on function public.open_match_feed(uuid, text) from public;
grant execute on function public.open_match_feed(uuid, text) to anon, authenticated;

-- Only the hourly job.
revoke execute on function public.run_open_match_jobs() from public, anon, authenticated;
grant execute on function public.run_open_match_jobs() to service_role;

-- Used by the trigger only.
revoke execute on function public.sync_open_match_booking() from public, anon, authenticated;

commit;
