-- ============================================================================
-- Kortello: levels that move with results (30 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261030b_tournament_pairs.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A player's level (1.0 to 7.0, in half steps, as before) now has a precise
-- rating behind it (e.g. 3.624). Every league match and Americano game with a
-- score moves the rating of the players with an account, Elo-style:
--
--   expected = 1 / (1 + 10^((their side − our side) / 2.1))
--     (a side 1.0 better is expected to win 3 of 4)
--   change   = K × (result − expected)
--     result: Americano — our share of the points (15–9 → 0.625)
--             league    — half the win (1 or 0), half our share of games
--     K: 0.15 for a player's first 10 rated games, then 0.07
--
-- The level shown is the rating rounded to the nearest half. Every change is
-- kept in level_changes, so correcting or clearing a score undoes it exactly.
-- Setting your own level (or a club confirming it) sets the rating to it.
-- Only players who have a level for that sport are rated.
-- ============================================================================

begin;

alter table public.player_levels add column if not exists rating numeric(5, 3);
alter table public.player_levels add column if not exists rated_matches integer not null default 0;
update public.player_levels set rating = level where rating is null;

create table if not exists public.level_changes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  sport       text not null,
  -- What it came from: a league match or an Americano game.
  source      text not null check (source in ('league', 'americano')),
  source_id   uuid not null,
  -- The league or the evening it was part of.
  parent_id   uuid,
  delta       numeric(5, 3) not null,
  created_at  timestamptz not null default now(),
  unique (profile_id, source, source_id)
);

create index if not exists level_changes_source_idx on public.level_changes (source, source_id);

alter table public.level_changes enable row level security;
-- A player sees their own changes; nobody writes them except the functions below.
drop policy if exists "level_changes_select_own" on public.level_changes;
create policy "level_changes_select_own" on public.level_changes
  for select to authenticated using (profile_id = (select auth.uid()));


-- ----------------------------------------------------------------------------
-- 1. A LEVEL SET BY HAND RESETS THE RATING
-- ----------------------------------------------------------------------------
create or replace function public.sync_level_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('kortello.rating_rpc', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.rating := coalesce(new.rating, new.level);
  elsif new.level is distinct from old.level then
    -- The player (or a club) chose a level: results continue from there.
    new.rating := new.level;
  end if;
  return new;
end;
$$;

drop trigger if exists player_levels_sync_rating on public.player_levels;
create trigger player_levels_sync_rating
  before insert or update on public.player_levels
  for each row execute function public.sync_level_rating();


-- ----------------------------------------------------------------------------
-- 2. RATING ONE GAME
--
-- p_a, p_b: the accounts on each side (nulls for players without one).
-- p_a_known, p_b_known: levels to use for players without a level of
-- their own (e.g. a partner typed by name), or null.
-- p_result: side A's result from 0 to 1, or null to only undo.
-- ----------------------------------------------------------------------------
drop function if exists public.rate_game(text, text, uuid, uuid[], uuid[], numeric[], numeric[], numeric);
create or replace function public.rate_game(
  p_sport text, p_source text, p_source_id uuid, p_parent uuid,
  p_a uuid[], p_b uuid[], p_a_known numeric[], p_b_known numeric[],
  p_result numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_ra numeric;
  v_rb numeric;
  v_expected numeric;
  v_k numeric;
  v_delta numeric;
  v_rating numeric;
  v_played integer;
  p uuid;
  v_side integer;
begin
  perform set_config('kortello.rating_rpc', 'on', true);

  -- Undo what this game changed before.
  for c in select * from public.level_changes where source = p_source and source_id = p_source_id loop
    update public.player_levels
    set rating = rating - c.delta,
        level = round((rating - c.delta) * 2) / 2,
        rated_matches = greatest(0, rated_matches - 1)
    where profile_id = c.profile_id and sport = c.sport;
  end loop;
  delete from public.level_changes where source = p_source and source_id = p_source_id;

  if p_result is null then
    perform set_config('kortello.rating_rpc', '', true);
    return;
  end if;

  -- Each side's strength: its players' ratings, else the levels we know.
  select avg(x) into v_ra from (
    select coalesce(pl.rating, pl.level) as x
    from unnest(p_a) as a(id) join public.player_levels pl on pl.profile_id = a.id and pl.sport = p_sport
    union all select k from unnest(coalesce(p_a_known, '{}')) as k where k is not null
  ) s;
  select avg(x) into v_rb from (
    select coalesce(pl.rating, pl.level) as x
    from unnest(p_b) as b(id) join public.player_levels pl on pl.profile_id = b.id and pl.sport = p_sport
    union all select k from unnest(coalesce(p_b_known, '{}')) as k where k is not null
  ) s;
  -- Nothing known about a side: no rating for this game.
  if v_ra is null or v_rb is null then
    perform set_config('kortello.rating_rpc', '', true);
    return;
  end if;

  v_expected := 1 / (1 + power(10, (v_rb - v_ra) / 2.1));

  for v_side in 1..2 loop
    foreach p in array (case when v_side = 1 then p_a else p_b end) loop
      continue when p is null;
      v_rating := null;
      select coalesce(rating, level), rated_matches into v_rating, v_played
      from public.player_levels where profile_id = p and sport = p_sport;
      continue when v_rating is null;
      v_k := case when v_played < 10 then 0.15 else 0.07 end;
      v_delta := case when v_side = 1 then v_k * (p_result - v_expected)
                      else v_k * ((1 - p_result) - (1 - v_expected)) end;
      -- Kept to 3 decimals, so undoing it later is exact.
      v_delta := round(least(7, greatest(1, v_rating + v_delta)), 3) - v_rating;
      update public.player_levels
      set rating = v_rating + v_delta,
          level = round((v_rating + v_delta) * 2) / 2,
          rated_matches = rated_matches + 1,
          updated_at = now()
      where profile_id = p and sport = p_sport;
      insert into public.level_changes (profile_id, sport, source, source_id, parent_id, delta)
      values (p, p_sport, p_source, p_source_id, p_parent, v_delta)
      on conflict (profile_id, source, source_id) do update set delta = excluded.delta;
    end loop;
  end loop;

  perform set_config('kortello.rating_rpc', '', true);
end;
$$;

revoke execute on function public.rate_game(text, text, uuid, uuid, uuid[], uuid[], numeric[], numeric[], numeric) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. WHEN A SCORE IS SAVED, CORRECTED OR CLEARED
-- ----------------------------------------------------------------------------
create or replace function public.rate_social_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sport text;
  v_points integer;
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select sport, points_per_match into v_sport, v_points from public.social_events where id = r.event_id;
  perform public.rate_game(
    v_sport, 'americano', r.id, r.event_id,
    array[(select player_id from public.social_players where id = r.a1),
          (select player_id from public.social_players where id = r.a2)],
    array[(select player_id from public.social_players where id = r.b1),
          (select player_id from public.social_players where id = r.b2)],
    -- A player without an account: the level the club typed, if any.
    array[(select case when player_id is null then level end from public.social_players where id = r.a1),
          (select case when player_id is null then level end from public.social_players where id = r.a2)],
    array[(select case when player_id is null then level end from public.social_players where id = r.b1),
          (select case when player_id is null then level end from public.social_players where id = r.b2)],
    case when tg_op = 'DELETE' or r.score_a is null or v_points <= 0 then null
         else r.score_a::numeric / v_points end
  );
  return null;
exception when others then
  -- A rating must never stop a score from being saved.
  raise warning 'rate_social_match: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists social_matches_rate on public.social_matches;
create trigger social_matches_rate
  after update of score_a, score_b or delete on public.social_matches
  for each row execute function public.rate_social_match();

create or replace function public.rate_league_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sport text;
  r record;
  e1 public.league_entries;
  e2 public.league_entries;
  v_result numeric;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select sport into v_sport from public.leagues where id = r.league_id;
  select * into e1 from public.league_entries where id = r.entry1_id;
  select * into e2 from public.league_entries where id = r.entry2_id;
  -- Half the win, half the share of games. A walkover tells nothing.
  if tg_op = 'DELETE' or r.winner_id is null or r.walkover or coalesce(r.games1 + r.games2, 0) = 0 then
    v_result := null;
  else
    v_result := 0.5 * (case when r.winner_id = r.entry1_id then 1 else 0 end)
              + 0.5 * (r.games1::numeric / (r.games1 + r.games2));
  end if;
  perform public.rate_game(
    v_sport, 'league', r.id, r.league_id,
    array[e1.player_id], array[e2.player_id],
    -- The partner (a name only) counts at the level the entry has.
    array[case when e1.partner_name is not null or e1.player_id is null then e1.level end],
    array[case when e2.partner_name is not null or e2.player_id is null then e2.level end],
    v_result
  );
  return null;
exception when others then
  raise warning 'rate_league_match: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists league_matches_rate on public.league_matches;
create trigger league_matches_rate
  after update of winner_id, walkover, sets1, sets2, games1, games2 or delete on public.league_matches
  for each row execute function public.rate_league_match();

commit;
