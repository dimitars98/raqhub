-- ============================================================================
-- Bookings: no double bookings, lessons find a free court, and closing
-- courts (bad weather, holidays) cancels and blocks what it should.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Double bookings
-- ----------------------------------------------------------------------------
select test.login('bojan');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
values (test.uid('bojan'), test.id('court1'), test.at('10:00'), test.at('11:00'), 60, 16);

select test.login('eli');
select test.fails($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('eli'), test.id('court1'), test.at('10:30'), test.at('11:30'), 60, 16)$$,
  'a court cannot be booked twice at the same time');
select test.allowed($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('eli'), test.id('court1'), test.at('11:00'), test.at('12:00'), 60, 16)$$,
  'a booking may start when the previous one ends');
select test.allowed($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('eli'), test.id('court2'), test.at('10:00'), test.at('11:00'), 60, 16)$$,
  'another court at the same time is fine');

-- A cancelled booking frees the slot.
select test.login('bojan');
update public.bookings set status = 'cancelled' where player_id = test.uid('bojan');
select test.login('marko');
select test.allowed($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('marko'), test.id('court1'), test.at('10:00'), test.at('11:00'), 60, 16)$$,
  'a cancelled booking frees its slot');


-- ----------------------------------------------------------------------------
-- Closing courts
-- ----------------------------------------------------------------------------
-- Tomorrow on court 1: Ivana at 14:00, a member's booking at 16:00.
select test.login('ivana');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
values (test.uid('ivana'), test.id('court1'), test.at('14:00'), test.at('15:00'), 60, 16);
select test.login('owner');
with b as (
  insert into public.bookings (member_id, court_id, starts_at, ends_at, duration_min, total_price, status)
  values (test.id('member'), test.id('court1'), test.at('16:00'), test.at('17:00'), 60, 16, 'confirmed')
  returning id)
select test.keep('member_booking', id) from b;

select test.login('stranger');
select test.fails($$select public.close_courts(test.id('riverside'), null, now(), now() + interval '1 day', 'weather')$$,
  'only the club can close its courts');

select test.login('owner');
select test.fails($$select public.close_courts(test.id('riverside'), null, test.at('10:00'), test.at('09:00'), 'weather')$$,
  'a closure must end after it starts');
select test.fails($$select public.close_courts(test.id('riverside'), array[test.id('courtA')], test.at('09:00'), test.at('10:00'), 'weather')$$,
  'a club cannot close another club''s court');
select test.fails($$select public.close_courts(test.id('riverside'), null, test.at('09:00'), test.at('10:00'), 'aliens')$$,
  'a closure needs a known reason');

-- Close court 1 tomorrow from 13:00 to 21:00.
with c as (select public.close_courts(test.id('riverside'), array[test.id('court1')],
  test.at('13:00'), test.at('21:00'), 'weather', 'Wet courts', 'Rain') as r)
select test.is((select (r ->> 'cancelled')::int from c), 2, 'closing cancels the 2 bookings in that time');
select test.logout();
select test.keep('closure', (select id from public.court_closures limit 1));
select test.is((select status from public.bookings where player_id = test.uid('ivana')), 'cancelled',
  'the player''s booking is cancelled');
select test.ok(exists (select 1 from public.notifications where user_id = test.uid('ivana')),
  'the player is told about it');
select test.is((select status from public.bookings where player_id = test.uid('marko')), 'confirmed',
  'bookings before the closure stay');

select test.login('bojan');
select test.fails($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('bojan'), test.id('court1'), test.at('15:00'), test.at('16:00'), 60, 16)$$,
  'a closed court cannot be booked');
select test.allowed($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('bojan'), test.id('court2'), test.at('15:00'), test.at('16:00'), 60, 16)$$,
  'the other court is still open');

select test.login('owner');
select test.fails($$update public.bookings set status = 'confirmed' where id = test.id('member_booking')$$,
  'not even the club can restore a booking into a closed time');

-- A lesson needs a free court: court 1 is closed, court 2 is free at 17:00.
select test.login('eli');
insert into public.bookings (player_id, coach_id, starts_at, ends_at, duration_min, total_price)
values (test.uid('eli'), test.id('coach'), test.at('17:00'), test.at('18:00'), 60, 30);
select test.is((select court_id from public.bookings where coach_id = test.id('coach') and player_id = test.uid('eli')),
  test.id('court2'), 'a lesson gets the court that is open');
-- At 15:00 both tennis courts are out (court 1 closed, court 2 Bojan's):
-- the lesson falls back to a padel court. Once those are taken too, no court.
select test.login('owner');
insert into public.bookings (walk_in_name, court_id, starts_at, ends_at, duration_min, total_price, status)
values ('Walk-in', test.id('padel1'), test.at('15:00'), test.at('16:00'), 60, 20, 'confirmed'),
       ('Walk-in', test.id('padel2'), test.at('15:00'), test.at('16:00'), 60, 20, 'confirmed');
select test.login('eli');
select test.fails($$insert into public.bookings (player_id, coach_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('eli'), test.id('coach'), test.at('15:00'), test.at('16:00'), 60, 30)$$,
  'a lesson with no free court is refused', 'No court is free');

-- Reopening
select test.login('stranger');
select test.fails($$select public.reopen_courts(test.id('closure'))$$, 'only the club can reopen');
select test.login('owner');
select public.reopen_courts(test.id('closure'));
select test.login('bojan');
select test.allowed($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('bojan'), test.id('court1'), test.at('19:00'), test.at('20:00'), 60, 16)$$,
  'after reopening, the court can be booked again');
select test.logout();
select test.is((select status from public.bookings where id = test.id('member_booking')), 'cancelled',
  'reopening doesn''t bring cancelled bookings back');
