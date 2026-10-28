-- ============================================================================
-- Security: what an ordinary player, a stranger or another club's owner must
-- NOT be able to do, even by calling the database directly with their own
-- login (which anyone can do with the public Supabase key from the website).
-- ============================================================================

-- Bojan has a booking at Riverside tomorrow at 10:00.
select test.login('bojan');
with b as (
  insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('bojan'), test.id('court1'), test.at('10:00'), test.at('11:00'), 60, 16)
  returning id)
select test.keep('bojan_booking', id) from b;

-- Eli is just a player.
select test.login('eli');

select test.blocked($$update public.bookings set status = 'cancelled' where id = test.id('bojan_booking')$$,
  'a player cannot cancel someone else''s booking');
select test.is(test.count($$select * from public.bookings where player_id = test.uid('bojan')$$), 0::bigint,
  'a player cannot see someone else''s bookings');
select test.blocked($$insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price)
  values (test.uid('bojan'), test.id('court2'), test.at('12:00'), test.at('13:00'), 60, 0)$$,
  'a player cannot book in someone else''s name');
select test.blocked($$delete from public.bookings$$, 'a player cannot delete bookings');

select test.try($$update public.profiles set role = 'club_admin' where id = test.uid('eli')$$);
select test.is((select role from public.profiles where id = test.uid('eli')), 'player',
  'a player cannot make themselves a club admin');
select test.try($$update public.profiles set role = 'super_admin' where id = test.uid('eli')$$);
select test.is((select role from public.profiles where id = test.uid('eli')), 'player',
  'a player cannot make themselves a super admin');
select test.blocked($$select phone from public.profiles where id <> test.uid('eli') and phone is not null$$,
  'a player cannot read other players'' phone numbers');

select test.blocked($$update public.clubs set paid_until = '2030-01-01'$$, 'a player cannot extend a club''s plan');
select test.blocked($$update public.clubs set owner_id = test.uid('eli')$$, 'a player cannot take over a club');
select test.blocked($$update public.courts set price_per_hour = 0$$, 'a player cannot change court prices');
select test.blocked($$insert into public.courts (club_id, name, surface, price_per_hour)
  values (test.id('riverside'), 'Fake', 'clay', 1)$$, 'a player cannot add a court');

select test.blocked($$insert into public.members (club_id, full_name, email)
  values (test.id('riverside'), 'Eli', 'eli@test.mk')$$, 'a player cannot make themselves a member (for discounts)');
select test.blocked($$select * from public.members$$, 'a player cannot read a club''s member list');
select test.blocked($$insert into public.membership_plans (club_id, name, price, discount_pct)
  values (test.id('riverside'), 'Free', 0, 100)$$, 'a player cannot add a membership plan');

select test.blocked($$insert into public.notifications (user_id, club_id, kind, data)
  values (test.uid('owner'), test.id('riverside'), 'booking_new', '{}')$$, 'a player cannot send notifications');
select test.blocked($$select * from public.notifications where user_id <> test.uid('eli')$$,
  'a player cannot read someone else''s notifications');

select test.blocked($$select public.close_courts(test.id('riverside'), null, now(), now() + interval '1 day', 'other')$$,
  'a player cannot close courts');
select test.blocked($$update public.group_fees set paid_at = now()$$, 'a player cannot mark group fees paid');
select test.blocked($$select * from public.group_players$$, 'a player cannot read group players (children''s details)');
select test.blocked($$insert into public.club_staff (club_id, email) values (test.id('riverside'), 'eli@test.mk')$$,
  'a player cannot add themselves as staff');
select test.blocked($$update public.tournaments set name = 'Hacked'$$, 'a player cannot change tournaments');

-- A player's own level: they can set it, but not "confirm" it.
select public.set_my_level('padel', 4.0);
select test.blocked($$update public.player_levels set confirmed_by_club = test.id('riverside')
  where profile_id = test.uid('eli')$$, 'a player cannot confirm their own level');
select test.blocked($$update public.player_levels set rating = 7, level = 7 where profile_id = test.uid('eli')$$,
  'a player cannot raise their own rating directly');
select test.blocked($$insert into public.level_changes (profile_id, sport, source, source_id, delta)
  values (test.uid('eli'), 'padel', 'league', gen_random_uuid(), 3)$$, 'a player cannot add level changes');

-- What a player may do
select test.login('bojan');
select test.is(test.count($$select * from public.bookings where player_id = test.uid('bojan')$$), 1::bigint,
  'a player sees their own booking');
select test.allowed($$update public.bookings set status = 'cancelled' where id = test.id('bojan_booking')$$,
  'a player can cancel their own booking');


-- ----------------------------------------------------------------------------
-- Another club's owner
-- ----------------------------------------------------------------------------
select test.login('owner');
insert into public.bookings (walk_in_name, court_id, starts_at, ends_at, duration_min, total_price, status)
values ('Walk-in', test.id('court2'), test.at('14:00'), test.at('15:00'), 60, 16, 'confirmed');

select test.login('owner2');
select test.is(test.count($$select * from public.bookings b join public.courts c on c.id = b.court_id
  where c.club_id = test.id('riverside')$$), 0::bigint, 'another club''s owner cannot see Riverside''s bookings');
select test.blocked($$update public.courts set price_per_hour = 1 where club_id = test.id('riverside')$$,
  'another club''s owner cannot change Riverside''s courts');
select test.blocked($$select * from public.members where club_id = test.id('riverside')$$,
  'another club''s owner cannot read Riverside''s members');
select test.blocked($$insert into public.bookings (walk_in_name, court_id, starts_at, ends_at, duration_min, total_price, status)
  values ('x', test.id('court1'), test.at('16:00'), test.at('17:00'), 60, 0, 'confirmed')$$,
  'another club''s owner cannot book Riverside courts as the club');

-- The owner manages their own club
select test.login('owner');
select test.is(test.count($$select * from public.bookings b join public.courts c on c.id = b.court_id
  where c.club_id = test.id('riverside')$$), 2::bigint, 'the owner sees their club''s bookings');
select test.allowed($$update public.courts set price_per_hour = 18 where id = test.id('court1')$$,
  'the owner can change their court''s price');

-- Clubs can't change what they pay Kortello, or their payment account
select test.try($$update public.clubs set stripe_account_id = 'acct_hack', stripe_charges_enabled = true,
  paid_until = '2030-01-01', subscription_status = 'active' where id = test.id('riverside')$$);
select test.logout();
select test.ok((select stripe_account_id is null and not coalesce(stripe_charges_enabled, false)
  from public.clubs where id = test.id('riverside')), 'an owner cannot connect a Stripe account directly');
select test.ok((select paid_until is distinct from '2030-01-01' and subscription_status is distinct from 'active'
  from public.clubs where id = test.id('riverside')), 'an owner cannot mark their own plan as paid');
