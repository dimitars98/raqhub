-- ============================================================================
-- ServeTime: tournaments (18 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261017_owner_page.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A simple knockout tournament:
--   tournaments          one per event, belongs to a club
--   tournament_entries   who plays (a player, or a name the club typed in,
--                        e.g. "Ana / Marko" for doubles)
--   tournament_matches   the bracket; round 1 is the first round
--
-- Who can do what
--   Everyone             see tournaments, entries and the bracket
--   The club owner       everything for their club's tournaments
--   A signed-in player   sign up once, and withdraw, while sign-ups are open
--                        and there are places left
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 120),
  sport        text not null default 'tennis',
  starts_on    date not null,
  description  text check (description is null or char_length(description) <= 2000),
  max_entries  integer not null default 16 check (max_entries between 2 and 64),
  entry_fee    numeric(10, 2) check (entry_fee is null or entry_fee >= 0),
  -- open: taking sign-ups · closed: no more sign-ups · started: draw made
  -- finished: final played
  status       text not null default 'open'
               check (status in ('open', 'closed', 'started', 'finished')),
  created_at   timestamptz not null default now()
);

create index if not exists tournaments_club_idx on public.tournaments (club_id, starts_on desc);

create table if not exists public.tournament_entries (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  -- Set when a player signed up themselves; null when the club added a name.
  player_id      uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create unique index if not exists tournament_entries_one_per_player
  on public.tournament_entries (tournament_id, player_id)
  where player_id is not null;

create table if not exists public.tournament_matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  round          integer not null check (round >= 1),
  position       integer not null check (position >= 0),
  entry1_id      uuid references public.tournament_entries(id) on delete set null,
  entry2_id      uuid references public.tournament_entries(id) on delete set null,
  winner_id      uuid references public.tournament_entries(id) on delete set null,
  score          text check (score is null or char_length(score) <= 60),
  unique (tournament_id, round, position)
);


-- ----------------------------------------------------------------------------
-- 2. WHO OWNS A TOURNAMENT
-- ----------------------------------------------------------------------------
create or replace function public.owns_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournaments t
    join public.clubs c on c.id = t.club_id
    where t.id = p_tournament_id
      and c.owner_id = (select auth.uid())
  );
$$;


-- ----------------------------------------------------------------------------
-- 3. ACCESS RULES
-- ----------------------------------------------------------------------------
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;

-- Tournaments: public to read, the club owner manages them.
drop policy if exists "tournaments_select_all" on public.tournaments;
create policy "tournaments_select_all" on public.tournaments
  for select using (true);

drop policy if exists "tournaments_manage_owner" on public.tournaments;
create policy "tournaments_manage_owner" on public.tournaments
  for all to authenticated
  using (exists (select 1 from public.clubs c
                 where c.id = club_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.clubs c
                      where c.id = club_id and c.owner_id = (select auth.uid())));

-- Entries: public to read (the names on the draw).
drop policy if exists "tournament_entries_select_all" on public.tournament_entries;
create policy "tournament_entries_select_all" on public.tournament_entries
  for select using (true);

drop policy if exists "tournament_entries_manage_owner" on public.tournament_entries;
create policy "tournament_entries_manage_owner" on public.tournament_entries
  for all to authenticated
  using (public.owns_tournament(tournament_id))
  with check (public.owns_tournament(tournament_id));

-- A player adds and removes only their own entry (more checks in step 4).
drop policy if exists "tournament_entries_insert_self" on public.tournament_entries;
create policy "tournament_entries_insert_self" on public.tournament_entries
  for insert to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "tournament_entries_delete_self" on public.tournament_entries;
create policy "tournament_entries_delete_self" on public.tournament_entries
  for delete to authenticated
  using (
    player_id = (select auth.uid())
    and exists (select 1 from public.tournaments t
                where t.id = tournament_id and t.status = 'open')
  );

-- Matches: public to read, only the club owner writes.
drop policy if exists "tournament_matches_select_all" on public.tournament_matches;
create policy "tournament_matches_select_all" on public.tournament_matches
  for select using (true);

drop policy if exists "tournament_matches_manage_owner" on public.tournament_matches;
create policy "tournament_matches_manage_owner" on public.tournament_matches
  for all to authenticated
  using (public.owns_tournament(tournament_id))
  with check (public.owns_tournament(tournament_id));


-- ----------------------------------------------------------------------------
-- 4. SIGNING UP
--
-- A player's own sign-up only while sign-ups are open and there is a place
-- left. The club owner (and the SQL Editor) can always add names.
-- ----------------------------------------------------------------------------
create or replace function public.guard_tournament_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := coalesce(auth.jwt() ->> 'role', '');
  v_status text;
  v_max    integer;
  v_count  integer;
begin
  if v_role not in ('authenticated', 'anon') or public.owns_tournament(new.tournament_id) then
    return new;
  end if;

  -- Lock the tournament row so two last-minute sign-ups can't both take the
  -- last place.
  select status, max_entries into v_status, v_max
  from public.tournaments
  where id = new.tournament_id
  for update;

  if v_status is distinct from 'open' then
    raise exception 'Sign-ups for this tournament are closed'
      using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.tournament_entries
  where tournament_id = new.tournament_id;

  if v_count >= v_max then
    raise exception 'This tournament is full'
      using errcode = '22023';
  end if;

  new.player_id := (select auth.uid());
  new.name := btrim(new.name);
  return new;
end;
$$;

drop trigger if exists tournament_entries_guard on public.tournament_entries;
create trigger tournament_entries_guard
  before insert on public.tournament_entries
  for each row execute function public.guard_tournament_entry();

commit;
