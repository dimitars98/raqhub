-- ============================================================================
-- Americano / Mexicano evenings: sign-up, scores, and the level changes
-- Americano games make (20261030c_levels_from_results.sql).
-- ============================================================================

select test.login('owner');
with e as (
  insert into public.social_events (club_id, name, sport, starts_at, ends_at, court_ids, max_players, points_per_match)
  values (test.id('riverside'), 'Friday Americano', 'padel', test.at('19:00'), test.at('21:00'),
          array[test.id('padel1'), test.id('padel2')], 8, 24)
  returning id)
select test.keep('event', id) from e;

-- Levels: four at 3.0, four at 4.0 (Petar has none; Sara joins by name only).
select test.logout();
insert into public.player_levels (profile_id, sport, level)
select id, 'padel', case when name in ('bojan', 'eli', 'mila', 'marko') then 3 else 4 end
from test.users where name in ('bojan', 'eli', 'mila', 'marko', 'ivana', 'nikola', 'petar');
delete from public.player_levels where profile_id = test.uid('petar');

do $$
declare n text;
begin
  foreach n in array array['bojan', 'eli', 'mila', 'marko', 'ivana', 'nikola', 'petar'] loop
    perform test.login(n);
    perform public.social_sign_up(test.id('event'), initcap(n));
  end loop;
end $$;
select test.login('bojan');
select test.fails($$select public.social_sign_up(test.id('event'), 'Bojan again')$$, 'a player can''t sign up twice');

-- The club adds Sara (no account) at level 4.0: the evening is now full.
select test.login('owner');
insert into public.social_players (event_id, name, level) values (test.id('event'), 'Sara', 4.0);
select test.login('stranger');
select test.fails($$select public.social_sign_up(test.id('event'), 'Late')$$, 'a full evening can''t be joined');

-- Players can't make rounds; the club can.
select test.login('bojan');
select test.fails($$insert into public.social_matches (event_id, round, court_index, a1, a2, b1, b2)
  select test.id('event'), 1, 0, (array_agg(id))[1], (array_agg(id))[2], (array_agg(id))[3], (array_agg(id))[4]
  from public.social_players where event_id = test.id('event')$$, 'players can''t make rounds');

select test.login('owner');
update public.social_events set status = 'running' where id = test.id('event');
-- Court 1: Bojan & Eli (3.0) v Ivana & Nikola (4.0). Court 2: Mila & Marko (3.0) v Petar & Sara.
create temp table p as select name, id from public.social_players where event_id = test.id('event');
grant select on p to authenticated;
insert into public.social_matches (event_id, round, court_index, a1, a2, b1, b2) values
  (test.id('event'), 1, 0, (select id from p where name = 'Bojan'), (select id from p where name = 'Eli'),
                           (select id from p where name = 'Ivana'), (select id from p where name = 'Nikola')),
  (test.id('event'), 1, 1, (select id from p where name = 'Mila'), (select id from p where name = 'Marko'),
                           (select id from p where name = 'Petar'), (select id from p where name = 'Sara'));
select test.logout();
select test.keep('game1', (select id from public.social_matches where event_id = test.id('event') and court_index = 0));
select test.keep('game2', (select id from public.social_matches where event_id = test.id('event') and court_index = 1));

-- Scores
select test.login('bojan');
select test.fails($$select public.social_save_score(test.id('game2'), 10)$$, 'a player can''t score a game they''re not in');
select test.fails($$select public.social_save_score(test.id('game1'), 30)$$, 'a score can''t be more than the game''s points');
select public.social_save_score(test.id('game1'), 18);
select test.logout();
select test.ok((select score_a = 18 and score_b = 6 from public.social_matches where id = test.id('game1')),
  'entering one side''s points gives the other side the rest (18–6)');

-- Levels: the weaker pair won 18–6, so their ratings rise and the others' fall.
select test.ok((select rating > 3 from public.player_levels where profile_id = test.uid('bojan') and sport = 'padel'),
  'beating a stronger pair raises the rating');
select test.ok((select rating < 4 from public.player_levels where profile_id = test.uid('ivana') and sport = 'padel'),
  'losing to a weaker pair lowers the rating');
select test.is((select rated_matches from public.player_levels where profile_id = test.uid('bojan') and sport = 'padel'), 1,
  'the game is counted');
select test.is((select count(*) from public.level_changes where source_id = test.id('game1')), 4::bigint,
  'one change for each of the four players');
select test.ok((select parent_id = test.id('event') from public.level_changes where source_id = test.id('game1') limit 1),
  'each change remembers the evening it came from');

-- Petar has no level: nobody is rated in his game except those who have one.
select test.login('owner');
select public.social_save_score(test.id('game2'), 12);
select test.logout();
select test.ok(not exists (select 1 from public.level_changes where source_id = test.id('game2') and profile_id = test.uid('petar')),
  'a player without a level isn''t rated');
select test.ok(exists (select 1 from public.level_changes where source_id = test.id('game2') and profile_id = test.uid('mila')),
  'the others in that game still are (Sara counts at the level the club gave her)');

-- Correcting and clearing a score undoes its change exactly.
select test.login('owner');
select public.social_save_score(test.id('game1'), 3);
select test.logout();
select test.ok((select rating < 3 from public.player_levels where profile_id = test.uid('bojan') and sport = 'padel'),
  'a corrected score (now 3–21) redoes the change');
-- (6–18 would change nothing: a 3.0 pair is expected to win a quarter of the points against 4.0)
select test.login('owner');
select public.social_save_score(test.id('game1'), null);
select test.logout();
select test.ok((select rating = 3 and rated_matches = 0 from public.player_levels
  where profile_id = test.uid('bojan') and sport = 'padel'), 'clearing the score puts the rating back exactly');

-- A level the player picks resets the rating.
select test.login('mila');
select public.set_my_level('padel', 5);
select test.logout();
select test.ok((select level = 5 and rating = 5 from public.player_levels where profile_id = test.uid('mila') and sport = 'padel'),
  'picking a new level starts the rating from there');

-- Players can read their own changes, not other people's.
select test.login('marko');
select test.ok(test.count($$select * from public.level_changes$$) > 0
  and test.count($$select * from public.level_changes where profile_id <> test.uid('marko')$$) = 0,
  'a player sees only their own level changes');

-- Visitors see the evening.
select test.login_anon();
select test.is(jsonb_array_length(public.social_view(test.id('event')) -> 'matches'), 2, 'visitors see the rounds');
