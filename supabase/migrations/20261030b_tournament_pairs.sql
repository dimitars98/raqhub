-- ============================================================================
-- Kortello: pairs in tournaments (30 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261030_americano.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- Padel is played in pairs, so a tournament can now take pairs: an entry is
-- the player who signed up plus their partner's name.
--
--   tournaments.team_size          1: singles (as before) · 2: pairs
--   tournament_entries.partner_name the partner, for pairs
--
-- Tournaments made before this stay singles (names like "Ana / Marko" that
-- clubs typed still show as they are).
-- ============================================================================

begin;

alter table public.tournaments add column if not exists team_size smallint not null default 1;
alter table public.tournaments drop constraint if exists tournaments_team_size_check;
alter table public.tournaments add constraint tournaments_team_size_check check (team_size in (1, 2));

alter table public.tournament_entries add column if not exists partner_name text;
alter table public.tournament_entries drop constraint if exists tournament_entries_partner_check;
alter table public.tournament_entries add constraint tournament_entries_partner_check
  check (partner_name is null or char_length(partner_name) between 1 and 120);

-- A pair needs a partner when a player signs up; singles have none.
create or replace function public.guard_tournament_pair()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_team smallint;
begin
  new.partner_name := nullif(btrim(coalesce(new.partner_name, '')), '');
  select team_size into v_team from public.tournaments where id = new.tournament_id;
  if coalesce(v_team, 1) = 1 then
    new.partner_name := null;
  elsif new.partner_name is null
        and coalesce((select auth.role()), '') in ('authenticated', 'anon')
        and not public.owns_tournament(new.tournament_id)
        and not coalesce(public.manages_club((select club_id from public.tournaments where id = new.tournament_id)), false) then
    raise exception 'tournament_partner' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_entries_pair on public.tournament_entries;
create trigger tournament_entries_pair
  before insert or update on public.tournament_entries
  for each row execute function public.guard_tournament_pair();

commit;
