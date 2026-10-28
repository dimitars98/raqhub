-- ============================================================================
-- Open matches: a player books a court and opens the other places to
-- players at a similar level.
-- ============================================================================

-- Bojan books Padel 1 tomorrow 19:00–20:30 and opens a match for levels 3.0–4.0.
select test.login('bojan');
with b as (
  insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('bojan'), test.id('padel1'), test.at('19:00'), test.at('20:30'), 90, 30)
  returning id)
select test.keep('booking', id) from b;
select public.set_my_level('padel', 3.5);
select test.keep('match', public.create_open_match(test.id('booking'), 3.0, 4.0, false, 4, 'New balls'));
select test.fails($$select public.create_open_match(test.id('booking'), 3.0, 4.0, false, 4, null)$$,
  'one booking can only have one open match');

select test.fails($$select public.set_my_level('padel', 3.3)$$, 'levels go in half steps');
select test.fails($$select public.set_my_level('padel', 8)$$, 'levels go up to 7');

-- Eli has no level yet: must set one first.
select test.login('eli');
select test.fails($$select public.join_open_match(test.id('match'), 2)$$, 'joining needs a level');
select public.set_my_level('padel', 3.0);
select public.join_open_match(test.id('match'), 2);
select test.is((public.open_match_detail(test.id('match')) ->> 'taken')::int, 2, 'a player at the right level joins');

-- Nikola (6.0) is outside the range: he asks, and Bojan decides.
select test.login('nikola');
select public.set_my_level('padel', 6.0);
select public.join_open_match(test.id('match'), 2);
select test.is((public.open_match_detail(test.id('match')) ->> 'taken')::int, 2,
  'a player outside the level range only asks to join');
select test.login('eli');
select test.fails($$select public.answer_match_request(test.id('match'), test.uid('nikola'), true)$$,
  'only the organiser answers requests');
select test.login('bojan');
select public.answer_match_request(test.id('match'), test.uid('nikola'), true);
select test.is((public.open_match_detail(test.id('match')) ->> 'taken')::int, 3, 'the organiser accepts the request');

-- Ivana fills the last place; then it's full.
select test.login('ivana');
select public.set_my_level('padel', 4.0);
select public.join_open_match(test.id('match'), 2);
select test.login('marko');
select public.set_my_level('padel', 3.5);
select test.fails($$select public.join_open_match(test.id('match'), null)$$, 'a full match cannot be joined');

-- Messages are for the players in the match.
select test.login('eli');
select public.post_match_message(test.id('match'), '  I''ll bring balls ');
select test.login('marko');
select test.fails($$select public.post_match_message(test.id('match'), 'hi')$$,
  'someone not in the match cannot post');
select test.ok(coalesce(jsonb_typeof(public.open_match_detail(test.id('match')) -> 'messages'), 'null') = 'null',
  'someone not in the match cannot read the messages');
select test.blocked($$select * from public.open_matches$$, 'the tables can''t be read directly, only through the functions');

-- Leaving
select test.login('eli');
select public.leave_open_match(test.id('match'));
select test.is((public.open_match_detail(test.id('match')) ->> 'taken')::int, 3, 'a player can leave');
select test.login('bojan');
select test.fails($$select public.leave_open_match(test.id('match'))$$, 'the organiser can''t leave their own match');

-- Visitors see the feed, but not the details or who's in it by account.
select test.login_anon();
select test.ok(jsonb_array_length(public.open_match_feed()) >= 1, 'visitors see open matches');
select test.fails($$select public.open_match_detail(test.id('match'))$$, 'visitors can''t open a match''s details');

-- The players were told.
select test.logout();
select test.ok(exists (select 1 from public.notifications where user_id = test.uid('bojan')),
  'the organiser is told when players join');
