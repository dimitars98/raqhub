-- ============================================================================
-- Tournaments: who manages them, sign-ups, and pairs (padel doubles).
-- ============================================================================

select test.login('owner');
with t as (
  insert into public.tournaments (club_id, name, sport, starts_on, max_entries, team_size)
  values (test.id('riverside'), 'Padel Open', 'padel', current_date + 7, 4, 2)
  returning id)
select test.keep('pairs', id) from t;
with t as (
  insert into public.tournaments (club_id, name, sport, starts_on, max_entries)
  values (test.id('riverside'), 'Tennis Cup', 'tennis', current_date + 7, 8)
  returning id)
select test.keep('singles', id) from t;

select test.login('owner2');
select test.blocked($$update public.tournaments set name = 'Hacked' where id = test.id('pairs')$$,
  'another club can''t change the tournament');

-- Pairs: a player must name a partner.
select test.login('bojan');
select test.fails($$insert into public.tournament_entries (tournament_id, name, player_id)
  values (test.id('pairs'), 'Bojan', test.uid('bojan'))$$, 'signing up for pairs needs a partner', 'tournament_partner');
select test.allowed($$insert into public.tournament_entries (tournament_id, name, player_id, partner_name)
  values (test.id('pairs'), 'Bojan', test.uid('bojan'), '  Marko  ')$$, 'with a partner, a player can sign up');
select test.logout();
select test.is((select partner_name from public.tournament_entries where player_id = test.uid('bojan')), 'Marko',
  'the partner''s name is tidied up');

-- Players can't sign up others, or change entries.
select test.login('eli');
select test.try($$insert into public.tournament_entries (tournament_id, name, player_id, partner_name)
  values (test.id('pairs'), 'Fake', test.uid('bojan'), 'x')$$);
select test.logout();
select test.is((select count(*) from public.tournament_entries where player_id = test.uid('bojan')), 1::bigint,
  'a player can''t sign up in someone else''s name (the entry becomes their own)');
select test.login('eli');
select test.blocked($$update public.tournament_entries set name = 'Hacked'$$, 'a player can''t change entries');

-- The club may add a pair without a partner's name yet.
select test.login('owner');
select test.allowed($$insert into public.tournament_entries (tournament_id, name) values (test.id('pairs'), 'Walk-in pair')$$,
  'the club can add a pair and fill in the partner later');

-- Singles: a partner's name is dropped.
select test.login('eli');
insert into public.tournament_entries (tournament_id, name, player_id, partner_name)
values (test.id('singles'), 'Eli', test.uid('eli'), 'Someone');
select test.logout();
select test.ok((select partner_name is null from public.tournament_entries
  where tournament_id = test.id('singles') and player_id = test.uid('eli')), 'singles entries have no partner');
