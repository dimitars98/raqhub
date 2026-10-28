-- ============================================================================
-- Box leagues: sign-up, rounds of boxes, scores, standings, and the level
-- changes league results make.
-- ============================================================================

select test.login('owner');
with l as (
  insert into public.leagues (club_id, name, sport, starts_on, box_size, level_max)
  values (test.id('riverside'), 'Autumn padel', 'padel', current_date, 4, 5)
  returning id)
select test.keep('league', id) from l;
select test.try($$update public.leagues set status = 'running' where id = test.id('league')$$);
select test.is((select status from public.leagues where id = test.id('league')), 'open',
  'a league''s status only changes through its functions');

-- Players have padel levels; eight sign up, with partners.
select test.logout();
insert into public.player_levels (profile_id, sport, level)
select id, 'padel', 3.5 from test.users where name in ('bojan', 'eli', 'mila', 'marko', 'ivana', 'nikola', 'sara', 'petar');
insert into public.player_levels (profile_id, sport, level) values (test.uid('stranger'), 'padel', 6.5);

do $$
declare n text;
begin
  foreach n in array array['bojan', 'eli', 'mila', 'marko', 'ivana', 'nikola', 'sara', 'petar'] loop
    perform test.login(n);
    perform public.league_sign_up(test.id('league'), initcap(n), initcap(n) || '''s partner');
  end loop;
end $$;
select test.logout();
select test.is((select count(*) from public.league_entries where league_id = test.id('league')), 8::bigint,
  'eight pairs signed up');

select test.login('bojan');
select test.fails($$select public.league_sign_up(test.id('league'), 'Again', 'x')$$, 'a player can''t sign up twice');
select test.blocked($$update public.league_entries set name = 'hack'$$, 'players can''t edit entries directly');
select test.fails($$select public.league_next_round(test.id('league'))$$, 'only the club starts rounds');
select test.login('stranger');
select test.fails($$select public.league_sign_up(test.id('league'), 'Strong', 'x')$$,
  'a player above the league''s top level can''t sign up');
select test.login_anon();
select test.fails($$select public.league_sign_up(test.id('league'), 'x', 'y')$$, 'visitors must sign in to sign up');

-- Round 1: two boxes of four, six matches each.
select test.login('owner');
select public.league_next_round(test.id('league'));
select test.logout();
select test.is((select count(*) from public.league_boxes where league_id = test.id('league')), 2::bigint,
  'round 1 makes two boxes of four');
select test.is((select count(*) from public.league_matches where league_id = test.id('league')), 12::bigint,
  'everyone in a box plays everyone: 2 × 6 matches');

-- Bojan enters the score of one of his matches.
select test.keep('bojan_match', (
  select m.id from public.league_matches m join public.league_entries e on e.id = m.entry1_id
  where e.player_id = test.uid('bojan') limit 1));
select test.login('bojan');
select test.fails($$select public.league_save_score(test.id('bojan_match'), '[[6,6]]', null)$$,
  'a score must have a winner');
select public.league_save_score(test.id('bojan_match'), '[[6,4],[3,6],[10,8]]', null);
select test.fails($$select public.league_save_score((select m.id from public.league_matches m
  where m.id <> test.id('bojan_match') and not exists (select 1 from public.league_entries e
  where e.id in (m.entry1_id, m.entry2_id) and e.player_id = test.uid('bojan')) limit 1), '[[6,0],[6,0]]', null)$$,
  'a player can''t enter scores for other people''s matches');
select test.logout();
select test.ok((select winner_id = entry1_id and sets1 = 2 and games1 = 19 and games2 = 18
  from public.league_matches where id = test.id('bojan_match')), 'the score is saved with sets and games');

-- Levels moved: Bojan won against an equal pair, so his rating went up.
select test.ok((select rating > 3.5 and level = 3.5 from public.player_levels
  where profile_id = test.uid('bojan') and sport = 'padel'), 'winning raises the rating (the shown level stays 3.5)');
select test.ok((select rating < 3.5 from public.player_levels pl join public.league_entries e on e.player_id = pl.profile_id
  join public.league_matches m on m.entry2_id = e.id where m.id = test.id('bojan_match') and pl.sport = 'padel'),
  'losing lowers the rating');

-- The opponent can't overwrite it; the club can correct it.
select test.login_id((select e.player_id from public.league_matches m join public.league_entries e on e.id = m.entry2_id
  where m.id = test.id('bojan_match')));
select test.fails($$select public.league_save_score(test.id('bojan_match'), '[[0,6],[0,6]]', null)$$,
  'the opponent can''t overwrite a score that''s been entered');
select test.login('owner');
select public.league_save_score(test.id('bojan_match'), '[[2,6],[3,6]]', null);
select test.logout();
select test.ok((select rating < 3.5 from public.player_levels where profile_id = test.uid('bojan') and sport = 'padel'),
  'when the club corrects a score, the rating change is redone');
select test.is((select count(*) from public.level_changes where source_id = test.id('bojan_match')), 2::bigint,
  'one change per player with an account, never doubled');

-- The club fills in the rest; standings rank the boxes.
select test.login('owner');
select count(public.league_save_score(id, '[[6,2],[6,3]]', null))
from public.league_matches where league_id = test.id('league') and winner_id is null;
select test.is((select count(*) from public.league_box_standings(test.id('league')) where rank = 1), 2::bigint,
  'each box has a winner');
select test.fails($$select public.league_undo_round(test.id('league'))$$, 'a round with scores can''t be undone');

-- Mila withdraws; round 2 goes ahead without her.
select test.login('mila');
select public.league_withdraw(test.id('league'));
select test.login('owner');
select public.league_next_round(test.id('league'));
select test.logout();
select test.ok(not exists (select 1 from public.league_box_entries be join public.league_rounds r on r.id = be.round_id
  join public.league_entries e on e.id = be.entry_id where r.number = 2 and e.player_id = test.uid('mila')),
  'a player who withdrew isn''t put in the next round');

select test.login('owner');
select public.league_undo_round(test.id('league'));
select test.logout();
select test.is((select count(*) from public.league_rounds where league_id = test.id('league')), 1::bigint,
  'an empty round can be undone');

-- Anyone can see the league.
select test.login_anon();
select test.is(jsonb_array_length(public.league_view(test.id('league')) -> 'rounds'), 1, 'visitors see the league''s rounds');
