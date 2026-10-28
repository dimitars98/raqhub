-- ============================================================================
-- Kortello: box leagues (28 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261027c_visitor_policies.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A box league runs in rounds of a few weeks. Players (or pairs, for padel)
-- are put in small boxes by level; in each round everyone plays everyone in
-- their box, books the court themselves and enters the score. When the round
-- ends, the best of each box move up a box and the last move down.
--
--   leagues              one per league, belongs to a club
--   league_entries       a player or a pair ("Ana / Marko")
--   league_rounds        round 1, 2, 3 …
--   league_boxes         box 1 is the strongest
--   league_box_entries   who is in which box this round
--   league_matches       every pairing in a box, with its score
--
-- Points: 3 for a win, 1 for a loss (for turning up), 0 for a walkover lost.
-- Ties: points, then sets won minus lost, then games, then the box seeding.
--
-- Who can do what
--   Everyone             see leagues, players, boxes, results (league_view)
--   The club (owner and staff)
--                        create and change leagues, add or remove players,
--                        start the next round, enter or correct any score
--   A signed-in player   sign up while sign-ups are open, withdraw, and enter
--                        the score of their own matches
-- While a club is read-only (20261025_trial_lock.sql) nothing changes, except
-- that players can still withdraw and enter scores.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.leagues (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 120),
  sport        text not null default 'padel' check (sport in ('tennis', 'padel', 'pickleball')),
  -- 1: singles · 2: pairs (doubles)
  team_size    smallint not null default 2 check (team_size in (1, 2)),
  -- Entries per box; boxes come out this size or one smaller.
  box_size     smallint not null default 4 check (box_size between 3 and 6),
  round_weeks  smallint not null default 3 check (round_weeks between 1 and 8),
  -- How many move up and down a box after each round.
  move_count   smallint not null default 1 check (move_count between 0 and 2),
  starts_on    date not null,
  max_entries  integer not null default 24 check (max_entries between 4 and 96),
  entry_fee    numeric(10, 2) check (entry_fee is null or entry_fee >= 0),
  level_min    numeric(2, 1) check (level_min is null or level_min between 1 and 7),
  level_max    numeric(2, 1) check (level_max is null or level_max between 1 and 7),
  description  text check (description is null or char_length(description) <= 2000),
  -- open: taking sign-ups · running: rounds being played · finished
  status       text not null default 'open' check (status in ('open', 'running', 'finished')),
  created_at   timestamptz not null default now(),
  constraint leagues_levels check (level_min is null or level_max is null or level_min <= level_max)
);

create index if not exists leagues_club_idx on public.leagues (club_id, starts_on desc);
create index if not exists leagues_open_idx on public.leagues (status, starts_on) where status <> 'finished';

create table if not exists public.league_entries (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  partner_name  text check (partner_name is null or char_length(partner_name) between 1 and 120),
  -- Set when a player signed up themselves; null when the club added a name.
  player_id     uuid references public.profiles(id) on delete set null,
  -- The player's level when they signed up (or what the club typed).
  level         numeric(2, 1) check (level is null or level between 1 and 7),
  -- Order for the first round's boxes: lower goes higher. The club can change it.
  seed          integer not null default 0,
  -- withdrawn: left during the league; kept so past results still add up.
  status        text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at    timestamptz not null default now()
);

create index if not exists league_entries_league_idx on public.league_entries (league_id);
create unique index if not exists league_entries_one_per_player
  on public.league_entries (league_id, player_id)
  where player_id is not null;
create index if not exists league_entries_player_idx on public.league_entries (player_id) where player_id is not null;

create table if not exists public.league_rounds (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  number     integer not null check (number >= 1),
  starts_on  date not null,
  ends_on    date not null,
  -- playing: the current round · done: results are final
  status     text not null default 'playing' check (status in ('playing', 'done')),
  unique (league_id, number)
);

create table if not exists public.league_boxes (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  round_id   uuid not null references public.league_rounds(id) on delete cascade,
  number     integer not null check (number >= 1),
  unique (round_id, number)
);

create table if not exists public.league_box_entries (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  round_id   uuid not null references public.league_rounds(id) on delete cascade,
  box_id     uuid not null references public.league_boxes(id) on delete cascade,
  entry_id   uuid not null references public.league_entries(id) on delete cascade,
  -- Place in the box at the start of the round (1 = top), the last tiebreak.
  position   integer not null,
  primary key (box_id, entry_id),
  unique (round_id, entry_id)
);

create table if not exists public.league_matches (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.leagues(id) on delete cascade,
  round_id     uuid not null references public.league_rounds(id) on delete cascade,
  box_id       uuid not null references public.league_boxes(id) on delete cascade,
  entry1_id    uuid not null references public.league_entries(id) on delete cascade,
  entry2_id    uuid not null references public.league_entries(id) on delete cascade,
  -- [[6,4],[3,6],[10,8]] from entry 1's side; null until played.
  sets         jsonb check (sets is null or jsonb_typeof(sets) = 'array'),
  sets1        smallint,
  sets2        smallint,
  games1       smallint,
  games2       smallint,
  winner_id    uuid references public.league_entries(id) on delete set null,
  -- The loser didn't play: they get no point.
  walkover     boolean not null default false,
  reported_by  uuid references public.profiles(id) on delete set null,
  reported_at  timestamptz,
  constraint league_matches_two_sides check (entry1_id <> entry2_id)
);

create index if not exists league_matches_box_idx on public.league_matches (box_id);
create index if not exists league_matches_round_idx on public.league_matches (round_id);


-- ----------------------------------------------------------------------------
-- 2. WHO RUNS A LEAGUE
-- ----------------------------------------------------------------------------
create or replace function public.league_club(p_league uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select club_id from public.leagues where id = p_league;
$$;

create or replace function public.manages_league(p_league uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.manages_club(public.league_club(p_league)), false);
$$;

revoke execute on function public.league_club(uuid) from public, anon;
revoke execute on function public.manages_league(uuid) from public, anon;
grant execute on function public.league_club(uuid) to authenticated;
grant execute on function public.manages_league(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. ACCESS RULES
--
-- Everything can be read (names and results, like a tournament draw). The
-- club writes leagues and entries directly; rounds, boxes and matches only
-- change through the functions below.
-- ----------------------------------------------------------------------------
alter table public.leagues enable row level security;
alter table public.league_entries enable row level security;
alter table public.league_rounds enable row level security;
alter table public.league_boxes enable row level security;
alter table public.league_box_entries enable row level security;
alter table public.league_matches enable row level security;

drop policy if exists "leagues_select_all" on public.leagues;
create policy "leagues_select_all" on public.leagues for select using (true);

drop policy if exists "leagues_manage_club" on public.leagues;
create policy "leagues_manage_club" on public.leagues
  for all to authenticated
  using (public.manages_club(club_id))
  with check (public.manages_club(club_id));

drop policy if exists "league_entries_select_all" on public.league_entries;
create policy "league_entries_select_all" on public.league_entries for select using (true);

drop policy if exists "league_entries_manage_club" on public.league_entries;
create policy "league_entries_manage_club" on public.league_entries
  for all to authenticated
  using (public.manages_league(league_id))
  with check (public.manages_league(league_id));

drop policy if exists "league_rounds_select_all" on public.league_rounds;
create policy "league_rounds_select_all" on public.league_rounds for select using (true);
drop policy if exists "league_boxes_select_all" on public.league_boxes;
create policy "league_boxes_select_all" on public.league_boxes for select using (true);
drop policy if exists "league_box_entries_select_all" on public.league_box_entries;
create policy "league_box_entries_select_all" on public.league_box_entries for select using (true);
drop policy if exists "league_matches_select_all" on public.league_matches;
create policy "league_matches_select_all" on public.league_matches for select using (true);



-- ----------------------------------------------------------------------------
-- 4. READ-ONLY CLUBS
--
-- Like guard_locked_club(): the club can't change anything while it is
-- read-only, and players can't sign up. Withdrawing and entering a score
-- still work, so a running league can finish.
-- ----------------------------------------------------------------------------
create or replace function public.guard_locked_league()
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

  if tg_table_name = 'leagues' then
    v_club := r.club_id;
  else
    v_club := public.league_club(r.league_id);
  end if;

  if v_club is null or not public.club_locked(v_club) then
    return coalesce(new, old);
  end if;

  if coalesce(public.manages_club(v_club), false) then
    raise exception 'club_locked'
      using hint = 'The club''s free trial has ended; the account is read-only until it is renewed.';
  end if;

  -- Players: a new sign-up is a new commitment.
  if tg_table_name = 'league_entries' and tg_op = 'INSERT' then
    raise exception 'club_locked' using hint = 'Sign-ups are paused at this club.';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['leagues', 'league_entries'] loop
    execute format('drop trigger if exists a_league_locked_guard on public.%I', t);
    execute format(
      'create trigger a_league_locked_guard before insert or update or delete on public.%I
         for each row execute function public.guard_locked_league()', t);
  end loop;
end;
$$;

-- The club can't change a league's format once it has started.
create or replace function public.guard_league_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.club_id <> old.club_id then
    raise exception 'A league can''t move to another club' using errcode = '22023';
  end if;
  if old.status <> 'open' and (new.team_size <> old.team_size or new.sport <> old.sport) then
    raise exception 'league_started' using errcode = '22023';
  end if;
  -- Status only moves forward through the functions below.
  if new.status <> old.status and coalesce((select auth.role()), '') in ('authenticated', 'anon')
     and coalesce(current_setting('kortello.league_rpc', true), '') <> 'on' then
    raise exception 'league_status' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists leagues_guard_update on public.leagues;
create trigger leagues_guard_update
  before update on public.leagues
  for each row execute function public.guard_league_update();

-- Entries: names trimmed; a pair needs a partner; nobody moves to another league.
create or replace function public.guard_league_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_team smallint;
begin
  if tg_op = 'UPDATE' and new.league_id <> old.league_id then
    raise exception 'An entry can''t move to another league' using errcode = '22023';
  end if;
  new.name := btrim(new.name);
  new.partner_name := nullif(btrim(coalesce(new.partner_name, '')), '');
  select team_size into v_team from public.leagues where id = new.league_id;
  if v_team = 1 then
    new.partner_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists league_entries_guard on public.league_entries;
create trigger league_entries_guard
  before insert or update on public.league_entries
  for each row execute function public.guard_league_entry();


-- ----------------------------------------------------------------------------
-- 5. STANDINGS
--
-- One row per entry per box, ranked within the box.
-- ----------------------------------------------------------------------------
create or replace function public.league_box_standings(p_league uuid)
returns table (
  round_id uuid, box_id uuid, entry_id uuid, played integer, won integer, lost integer,
  sets_won integer, sets_lost integer, games_won integer, games_lost integer,
  points integer, rank integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sides as (
    select m.box_id, m.entry1_id as entry_id, m.sets1 as sf, m.sets2 as sa,
           m.games1 as gf, m.games2 as ga, m.winner_id, m.walkover
    from public.league_matches m
    where m.league_id = p_league and m.winner_id is not null
    union all
    select m.box_id, m.entry2_id, m.sets2, m.sets1, m.games2, m.games1, m.winner_id, m.walkover
    from public.league_matches m
    where m.league_id = p_league and m.winner_id is not null
  ),
  totals as (
    select be.round_id, be.box_id, be.entry_id, be.position,
           count(s.entry_id)::int as played,
           count(*) filter (where s.winner_id = be.entry_id)::int as won,
           count(*) filter (where s.entry_id is not null and s.winner_id <> be.entry_id)::int as lost,
           coalesce(sum(s.sf), 0)::int as sets_won,
           coalesce(sum(s.sa), 0)::int as sets_lost,
           coalesce(sum(s.gf), 0)::int as games_won,
           coalesce(sum(s.ga), 0)::int as games_lost,
           (3 * count(*) filter (where s.winner_id = be.entry_id)
            + count(*) filter (where s.entry_id is not null and s.winner_id <> be.entry_id
                               and not s.walkover))::int as points
    from public.league_box_entries be
    left join sides s on s.box_id = be.box_id and s.entry_id = be.entry_id
    where be.league_id = p_league
    group by be.round_id, be.box_id, be.entry_id, be.position
  )
  select t.round_id, t.box_id, t.entry_id, t.played, t.won, t.lost,
         t.sets_won, t.sets_lost, t.games_won, t.games_lost, t.points,
         (row_number() over (
            partition by t.box_id
            order by t.points desc, (t.sets_won - t.sets_lost) desc,
                     (t.games_won - t.games_lost) desc, t.position
          ))::int as rank
  from totals t;
$$;

revoke execute on function public.league_box_standings(uuid) from public;
grant execute on function public.league_box_standings(uuid) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. THE LEAGUE PAGE
--
-- Everything a league page shows, in one call. player_id is never sent: an
-- entry only says whether it is the signed-in player's.
-- ----------------------------------------------------------------------------
create or replace function public.league_view(p_league uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lg as (
    select l.*, c.name as club_name, c.slug as club_slug, c.city as club_city
    from public.leagues l
    join public.clubs c on c.id = l.club_id
    where l.id = p_league
  ),
  st as (select * from public.league_box_standings(p_league))
  select case when not exists (select 1 from lg) then null else jsonb_build_object(
    'league', (select to_jsonb(lg) - 'club_name' - 'club_slug' - 'club_city' from lg),
    'club', (select jsonb_build_object('name', club_name, 'slug', club_slug, 'city', club_city) from lg),
    'manages', coalesce(public.manages_club((select club_id from lg)), false),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'partner_name', e.partner_name, 'level', e.level,
        'seed', e.seed, 'status', e.status, 'created_at', e.created_at,
        'mine', coalesce(e.player_id = (select auth.uid()), false)
      ) order by e.seed, e.created_at)
      from public.league_entries e where e.league_id = p_league), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'number', r.number, 'starts_on', r.starts_on, 'ends_on', r.ends_on,
        'status', r.status,
        'boxes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id, 'number', b.number,
            'standings', coalesce((
              select jsonb_agg(jsonb_build_object(
                'entry_id', s.entry_id, 'played', s.played, 'won', s.won, 'lost', s.lost,
                'sets_won', s.sets_won, 'sets_lost', s.sets_lost,
                'games_won', s.games_won, 'games_lost', s.games_lost,
                'points', s.points, 'rank', s.rank
              ) order by s.rank)
              from st s where s.box_id = b.id), '[]'::jsonb),
            'matches', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', m.id, 'entry1_id', m.entry1_id, 'entry2_id', m.entry2_id,
                'sets', m.sets, 'winner_id', m.winner_id, 'walkover', m.walkover,
                'reported_at', m.reported_at,
                'reported_by_me', coalesce(m.reported_by = (select auth.uid()), false)
              ) order by p1.position, p2.position)
              from public.league_matches m
              join public.league_box_entries p1 on p1.box_id = m.box_id and p1.entry_id = m.entry1_id
              join public.league_box_entries p2 on p2.box_id = m.box_id and p2.entry_id = m.entry2_id
              where m.box_id = b.id), '[]'::jsonb)
          ) order by b.number)
          from public.league_boxes b where b.round_id = r.id), '[]'::jsonb)
      ) order by r.number desc)
      from public.league_rounds r where r.league_id = p_league), '[]'::jsonb)
  ) end;
$$;

revoke execute on function public.league_view(uuid) from public;
grant execute on function public.league_view(uuid) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 7. SIGNING UP AND WITHDRAWING
-- ----------------------------------------------------------------------------
create or replace function public.league_sign_up(p_league uuid, p_name text, p_partner text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  l public.leagues;
  v_level numeric;
  v_count integer;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  -- Lock the league so two last-minute sign-ups can't both take the last place.
  select * into l from public.leagues where id = p_league for update;
  if l.id is null or l.status <> 'open' then
    raise exception 'league_closed' using errcode = '22023';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'league_name' using errcode = '22023';
  end if;
  if l.team_size = 2 and btrim(coalesce(p_partner, '')) = '' then
    raise exception 'league_partner' using errcode = '22023';
  end if;
  if exists (select 1 from public.league_entries where league_id = p_league and player_id = v_me) then
    raise exception 'league_already' using errcode = '23505';
  end if;

  select count(*) into v_count from public.league_entries
  where league_id = p_league and status = 'active';
  if v_count >= l.max_entries then
    raise exception 'league_full' using errcode = '22023';
  end if;

  -- Within the league's levels, when it has them and the player has a level.
  select level into v_level from public.player_levels where profile_id = v_me and sport = l.sport;
  if v_level is not null and (
       (l.level_min is not null and v_level < l.level_min)
    or (l.level_max is not null and v_level > l.level_max)) then
    raise exception 'league_level' using errcode = '22023';
  end if;

  insert into public.league_entries (league_id, name, partner_name, player_id, level, seed)
  values (p_league, left(btrim(p_name), 120), left(btrim(coalesce(p_partner, '')), 120), v_me, v_level,
          (select coalesce(max(seed), 0) + 1 from public.league_entries where league_id = p_league))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.league_withdraw(p_league uuid)
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
  select status into v_status from public.leagues where id = p_league;
  if v_status = 'open' then
    delete from public.league_entries where league_id = p_league and player_id = v_me;
  elsif v_status = 'running' then
    -- Results so far stay; they won't be put in the next round.
    update public.league_entries set status = 'withdrawn'
    where league_id = p_league and player_id = v_me;
  else
    raise exception 'league_closed' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.league_sign_up(uuid, text, text) from public, anon;
revoke execute on function public.league_withdraw(uuid) from public, anon;
grant execute on function public.league_sign_up(uuid, text, text) to authenticated;
grant execute on function public.league_withdraw(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. ROUNDS
--
-- league_next_round: the first round puts the entries in boxes by seed; each
-- later round moves the best of every box up and the last down, then fills
-- the boxes again from the top. Boxes come out box_size or one smaller (at
-- least 2), and everyone in a box gets a match against everyone else.
-- ----------------------------------------------------------------------------
create or replace function public.league_next_round(p_league uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.leagues;
  v_prev public.league_rounds;
  v_round uuid;
  v_order uuid[];
  v_n integer;
  v_boxes integer;
  v_box uuid;
  v_start date;
  i integer;
  b integer;
  v_from integer;
  v_size integer;
  v_last integer;
begin
  if not public.manages_league(p_league) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into l from public.leagues where id = p_league for update;
  if l.status = 'finished' then
    raise exception 'league_finished' using errcode = '22023';
  end if;

  select * into v_prev from public.league_rounds
  where league_id = p_league order by number desc limit 1;

  if v_prev.id is null then
    -- First round: by seed, then level (highest first), then who signed up first.
    select array_agg(e.id order by e.seed, e.level desc nulls last, e.created_at)
      into v_order
    from public.league_entries e
    where e.league_id = p_league and e.status = 'active';
  else
    select max(number) into v_last from public.league_boxes where round_id = v_prev.id;
    -- Each entry gets a place in the new order: its new box, then where in
    -- that box (the ones coming down go first, the ones coming up last).
    with st as (
      select s.*, bx.number as box_no,
             (select count(*) from public.league_box_entries x where x.box_id = s.box_id) as box_n
      from public.league_box_standings(p_league) s
      join public.league_boxes bx on bx.id = s.box_id
      where s.round_id = v_prev.id
    ),
    placed as (
      select st.entry_id,
             case
               when st.box_no > 1 and st.rank <= l.move_count then st.box_no - 1
               when st.box_no < v_last and st.rank > st.box_n - l.move_count then st.box_no + 1
               else st.box_no
             end as new_box,
             case
               when st.box_no > 1 and st.rank <= l.move_count then 1000 + st.rank
               when st.box_no < v_last and st.rank > st.box_n - l.move_count then st.rank - 1000
               else st.rank
             end as place
      from st
      join public.league_entries e on e.id = st.entry_id and e.status = 'active'
    )
    select array_agg(entry_id order by new_box, place) into v_order from placed;

    -- Players the club added during the league start at the bottom.
    v_order := coalesce(v_order, '{}') || coalesce((
      select array_agg(e.id order by e.level desc nulls last, e.seed, e.created_at)
      from public.league_entries e
      where e.league_id = p_league and e.status = 'active'
        and not exists (select 1 from public.league_box_entries x
                        where x.round_id = v_prev.id and x.entry_id = e.id)), '{}');
  end if;

  v_n := coalesce(array_length(v_order, 1), 0);
  if v_n < 2 then
    raise exception 'league_too_few' using errcode = '22023';
  end if;

  -- As many boxes as needed so none is bigger than box_size; sizes differ by
  -- at most one, bigger boxes on top.
  v_boxes := ceil(v_n::numeric / l.box_size)::int;
  v_boxes := least(v_boxes, v_n / 2);

  if v_prev.id is not null then
    update public.league_rounds set status = 'done' where id = v_prev.id;
  end if;

  -- The first round starts on the league's date (or today, if that has
  -- passed); a later one starts when the club starts it.
  v_start := case when v_prev.id is null then greatest(current_date, l.starts_on) else current_date end;

  insert into public.league_rounds (league_id, number, starts_on, ends_on)
  values (p_league, coalesce(v_prev.number, 0) + 1, v_start, v_start + l.round_weeks * 7 - 1)
  returning id into v_round;

  v_from := 1;
  for b in 1..v_boxes loop
    v_size := v_n / v_boxes + case when b <= v_n % v_boxes then 1 else 0 end;
    insert into public.league_boxes (league_id, round_id, number)
    values (p_league, v_round, b) returning id into v_box;
    for i in 0..v_size - 1 loop
      insert into public.league_box_entries (league_id, round_id, box_id, entry_id, position)
      values (p_league, v_round, v_box, v_order[v_from + i], i + 1);
    end loop;
    -- Everyone against everyone in the box.
    insert into public.league_matches (league_id, round_id, box_id, entry1_id, entry2_id)
    select p_league, v_round, v_box, a.entry_id, c.entry_id
    from public.league_box_entries a
    join public.league_box_entries c on c.box_id = a.box_id and c.position > a.position
    where a.box_id = v_box
    order by a.position, c.position;
    v_from := v_from + v_size;
  end loop;

  perform set_config('kortello.league_rpc', 'on', true);
  update public.leagues set status = 'running' where id = p_league;
  perform set_config('kortello.league_rpc', '', true);
  return v_round;
end;
$$;

-- Takes back the last round, if no score has been entered in it yet.
create or replace function public.league_undo_round(p_league uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.league_rounds;
begin
  if not public.manages_league(p_league) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform 1 from public.leagues where id = p_league for update;
  select * into v_round from public.league_rounds
  where league_id = p_league order by number desc limit 1;
  if v_round.id is null then
    raise exception 'league_no_round' using errcode = '22023';
  end if;
  if exists (select 1 from public.league_matches where round_id = v_round.id and winner_id is not null) then
    raise exception 'league_has_scores' using errcode = '22023';
  end if;
  delete from public.league_rounds where id = v_round.id;
  update public.league_rounds set status = 'playing'
  where league_id = p_league and number = v_round.number - 1;

  perform set_config('kortello.league_rpc', 'on', true);
  update public.leagues
  set status = case when v_round.number = 1 then 'open' else 'running' end
  where id = p_league;
  perform set_config('kortello.league_rpc', '', true);
end;
$$;

create or replace function public.league_finish(p_league uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.manages_league(p_league) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.league_rounds set status = 'done' where league_id = p_league;
  perform set_config('kortello.league_rpc', 'on', true);
  update public.leagues set status = 'finished' where id = p_league and status = 'running';
  perform set_config('kortello.league_rpc', '', true);
end;
$$;

revoke execute on function public.league_next_round(uuid) from public, anon;
revoke execute on function public.league_undo_round(uuid) from public, anon;
revoke execute on function public.league_finish(uuid) from public, anon;
grant execute on function public.league_next_round(uuid) to authenticated;
grant execute on function public.league_undo_round(uuid) to authenticated;
grant execute on function public.league_finish(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. SCORES
--
-- p_sets: [[6,4],[3,6],[10,8]] from entry 1's side, 1 to 3 sets, someone must
-- win more sets. p_walkover: the entry that didn't turn up (no sets then).
-- Null for both clears the score (club only).
--
-- The club can enter or correct any score. A player can enter the score of
-- their own match while its round is being played, unless the other side
-- has already entered it.
-- ----------------------------------------------------------------------------
create or replace function public.league_save_score(p_match uuid, p_sets jsonb, p_walkover uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  m public.league_matches;
  v_round_status text;
  v_manager boolean;
  v_side integer;
  v_set jsonb;
  a integer;
  c integer;
  s1 integer := 0;
  s2 integer := 0;
  g1 integer := 0;
  g2 integer := 0;
  v_winner uuid;
begin
  if v_me is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into m from public.league_matches where id = p_match for update;
  if m.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_manager := public.manages_league(m.league_id);
  if v_manager and public.club_locked(public.league_club(m.league_id)) then
    raise exception 'club_locked';
  end if;

  if not v_manager then
    select case
             when exists (select 1 from public.league_entries where id = m.entry1_id and player_id = v_me) then 1
             when exists (select 1 from public.league_entries where id = m.entry2_id and player_id = v_me) then 2
           end into v_side;
    if v_side is null then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    select status into v_round_status from public.league_rounds where id = m.round_id;
    if v_round_status <> 'playing' then
      raise exception 'league_round_done' using errcode = '22023';
    end if;
    if m.winner_id is not null and m.reported_by is distinct from v_me then
      raise exception 'league_already_reported' using errcode = '22023';
    end if;
    if p_sets is null and p_walkover is null then
      raise exception 'league_score' using errcode = '22023';
    end if;
  end if;

  if p_walkover is not null then
    if p_walkover not in (m.entry1_id, m.entry2_id) then
      raise exception 'league_score' using errcode = '22023';
    end if;
    v_winner := case when p_walkover = m.entry1_id then m.entry2_id else m.entry1_id end;
    update public.league_matches
    set sets = null, sets1 = null, sets2 = null, games1 = null, games2 = null,
        winner_id = v_winner, walkover = true, reported_by = v_me, reported_at = now()
    where id = m.id;
    return;
  end if;

  if p_sets is null then
    update public.league_matches
    set sets = null, sets1 = null, sets2 = null, games1 = null, games2 = null,
        winner_id = null, walkover = false, reported_by = null, reported_at = null
    where id = m.id;
    return;
  end if;

  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) not between 1 and 3 then
    raise exception 'league_score' using errcode = '22023';
  end if;
  for v_set in select value from jsonb_array_elements(p_sets) loop
    if jsonb_typeof(v_set) <> 'array' or jsonb_array_length(v_set) <> 2
       or jsonb_typeof(v_set -> 0) <> 'number' or jsonb_typeof(v_set -> 1) <> 'number' then
      raise exception 'league_score' using errcode = '22023';
    end if;
    a := (v_set ->> 0)::numeric::int;
    c := (v_set ->> 1)::numeric::int;
    if a < 0 or c < 0 or a > 99 or c > 99 or a = c then
      raise exception 'league_score' using errcode = '22023';
    end if;
    g1 := g1 + a;
    g2 := g2 + c;
    if a > c then s1 := s1 + 1; else s2 := s2 + 1; end if;
  end loop;
  if s1 = s2 then
    raise exception 'league_score' using errcode = '22023';
  end if;

  update public.league_matches
  set sets = p_sets, sets1 = s1, sets2 = s2, games1 = g1, games2 = g2,
      winner_id = case when s1 > s2 then m.entry1_id else m.entry2_id end,
      walkover = false, reported_by = v_me, reported_at = now()
  where id = m.id;
end;
$$;

revoke execute on function public.league_save_score(uuid, jsonb, uuid) from public, anon;
grant execute on function public.league_save_score(uuid, jsonb, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 10. A PLAYER'S LEAGUES
--
-- The leagues the signed-in player is in, and open leagues at clubs they
-- know (where they have booked, are a member, or are in a group).
-- ----------------------------------------------------------------------------
create or replace function public.my_leagues()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mine as (
    select l.id from public.leagues l
    join public.league_entries e on e.league_id = l.id
    where e.player_id = (select id from me)
  ),
  known_clubs as (
    select c.club_id from public.bookings b join public.courts c on c.id = b.court_id
    where b.player_id = (select id from me)
    union
    select m.club_id from public.members m
    where lower(m.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  )
  select jsonb_build_object(
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'sport', l.sport, 'status', l.status,
        'starts_on', l.starts_on, 'club', c.name,
        'entry', (select e.name || coalesce(' / ' || e.partner_name, '')
                  from public.league_entries e
                  where e.league_id = l.id and e.player_id = (select id from me))
      ) order by l.status = 'finished', l.starts_on desc)
      from public.leagues l join public.clubs c on c.id = l.club_id
      where l.id in (select id from mine)), '[]'::jsonb),
    'open', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'sport', l.sport, 'status', l.status,
        'starts_on', l.starts_on, 'club', c.name
      ) order by l.starts_on)
      from public.leagues l join public.clubs c on c.id = l.club_id
      where l.status = 'open' and c.is_active
        and l.club_id in (select club_id from known_clubs)
        and l.id not in (select id from mine)), '[]'::jsonb)
  );
$$;

revoke execute on function public.my_leagues() from public, anon;
grant execute on function public.my_leagues() to authenticated;

commit;
