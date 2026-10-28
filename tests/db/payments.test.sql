-- ============================================================================
-- Online court payments (Stripe): who decides that a booking is paid, what
-- happens to unpaid and cancelled ones.
-- ============================================================================

-- Before the club's Stripe account is ready, bookings are paid at the club.
select test.login('bojan');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price, status)
values (test.uid('bojan'), test.id('court1'), test.at('09:00'), test.at('10:00'), 60, 0, 'confirmed');
select test.logout();
select test.is((select payment_status from public.bookings where starts_at = test.at('09:00')), 'none',
  'without Stripe, a booking is paid at the club');

-- Only the server (after Stripe confirms the account) can turn payments on.
select test.login_service();
update public.clubs set stripe_account_id = 'acct_123', stripe_charges_enabled = true, payment_mode = 'online'
where id = test.id('riverside');

select test.login('bojan');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price, status)
values (test.uid('bojan'), test.id('court1'), test.at('11:00'), test.at('12:00'), 60, 0, 'confirmed');
select test.logout();
select test.ok((select payment_status = 'pending' and pay_by is not null
  from public.bookings where starts_at = test.at('11:00')),
  'with online payments, a new booking waits for payment (and is held for a while)');
select test.is((select total_price from public.bookings where starts_at = test.at('11:00')), 16::numeric,
  'the price comes from the court, not from what the browser sent');

-- The player can't mark it paid.
select test.login('bojan');
select test.try($$update public.bookings set payment_status = 'paid', status = 'confirmed'
  where starts_at = test.at('11:00')$$);
select test.logout();
select test.is((select payment_status from public.bookings where starts_at = test.at('11:00')), 'pending',
  'a player cannot mark their own booking as paid');
select test.is((select count(*) from public.notifications where kind = 'booking_new'
  and data ->> 'starts_at' is not null and (data ->> 'starts_at')::timestamptz = test.at('11:00')), 0::bigint,
  'the club isn''t told about a booking until it''s paid');

-- Nor can they call the function Stripe's webhook uses.
select test.login('bojan');
select test.fails($$select public.confirm_online_payment((select id from public.bookings where starts_at = test.at('11:00')),
  'cs_1', 'pi_1', 16, 'acct_123')$$, 'only the server can confirm a payment');

-- The webhook confirms it (twice: Stripe may send the same event again).
select test.login_service();
select public.confirm_online_payment((select id from public.bookings where starts_at = test.at('11:00')), 'cs_1', 'pi_1', 16, 'acct_123');
select public.confirm_online_payment((select id from public.bookings where starts_at = test.at('11:00')), 'cs_1', 'pi_1', 16, 'acct_123');
select test.logout();
select test.ok((select payment_status = 'paid' and amount_paid = 16 from public.bookings where starts_at = test.at('11:00')),
  'after Stripe confirms, the booking is paid');
select test.is((select count(*) from public.notifications where kind = 'booking_new'
  and data ->> 'starts_at' is not null and (data ->> 'starts_at')::timestamptz = test.at('11:00')), 1::bigint,
  'the club is told once, even if Stripe sends the event twice');

-- Cancelling a paid booking marks a refund as due.
select test.login('bojan');
update public.bookings set status = 'cancelled' where starts_at = test.at('11:00');
select test.logout();
select test.is((select payment_status from public.bookings where starts_at = test.at('11:00')), 'refund_due',
  'cancelling a paid booking marks a refund as due');

-- An unpaid booking expires and frees the court.
select test.login('bojan');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price, status)
values (test.uid('bojan'), test.id('court1'), test.at('13:00'), test.at('14:00'), 60, 0, 'confirmed');
select test.login_service();
update public.bookings set pay_by = now() - interval '1 minute' where starts_at = test.at('13:00');
select test.is((select count(*) from public.expire_unpaid_bookings()), 1::bigint, 'an unpaid booking expires');
select test.logout();
select test.is((select status from public.bookings where starts_at = test.at('13:00')), 'cancelled',
  '... and is cancelled, so the court is free again');

-- "Either" mode: the player chooses.
select test.login_service();
update public.clubs set payment_mode = 'either' where id = test.id('riverside');
select test.login('bojan');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price, status)
values (test.uid('bojan'), test.id('court1'), test.at('15:00'), test.at('16:00'), 60, 0, 'confirmed');
insert into public.bookings (player_id, court_id, starts_at, ends_at, duration_min, total_price, status, payment_status)
values (test.uid('bojan'), test.id('court1'), test.at('17:00'), test.at('18:00'), 60, 0, 'confirmed', 'pending');
select test.logout();
select test.is((select payment_status from public.bookings where starts_at = test.at('15:00')), 'none',
  'in "either" mode, a player may pay at the club');
select test.is((select payment_status from public.bookings where starts_at = test.at('17:00')), 'pending',
  'in "either" mode, a player may pay online');

-- The club's own bookings (walk-ins) are paid at the club.
select test.login('owner');
insert into public.bookings (walk_in_name, court_id, starts_at, ends_at, duration_min, total_price, status)
values ('Walk-in', test.id('court1'), test.at('19:00'), test.at('20:00'), 60, 16, 'confirmed');
select test.logout();
select test.is((select payment_status from public.bookings where starts_at = test.at('19:00')), 'none',
  'a booking the club makes is paid at the club');
