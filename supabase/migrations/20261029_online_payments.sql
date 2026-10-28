-- ============================================================================
-- Kortello: paying for a court online, with Stripe (29 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261028_leagues.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- Each club connects its own Stripe account (Stripe Connect, "direct
-- charges"): players pay the club, the money lands in the club's Stripe
-- account, and refunds and disputes are the club's, not Kortello's.
--
--   clubs.payment_mode      club: pay at the club (as before)
--                           online: a player pays when booking
--                           either: the player chooses
--   clubs.stripe_account_id / stripe_charges_enabled
--                           set only by the server (service role), after
--                           Stripe says the account can take payments
--
--   bookings.payment_status none: nothing paid online (pay at the club)
--                           pending: waiting for the player to pay; the
--                             court is held until pay_by, then let go
--                           paid · refund_due · refunded
--                           expired: never paid, the booking was let go
--
-- A booking waiting for payment has status 'pending'. Only the server marks
-- it paid (and confirmed): players and clubs can't change payment fields.
-- Cancelling a paid booking (player, club or a court closure) makes it
-- refund_due; the server then refunds it through Stripe.
--
-- Lessons, group sessions and bookings the club makes are paid at the club.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. COLUMNS
-- ----------------------------------------------------------------------------
alter table public.clubs add column if not exists stripe_account_id text;
alter table public.clubs add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.clubs add column if not exists payment_mode text not null default 'club';

alter table public.clubs drop constraint if exists clubs_payment_mode_check;
alter table public.clubs add constraint clubs_payment_mode_check
  check (payment_mode in ('club', 'online', 'either'));

create unique index if not exists clubs_stripe_account_idx
  on public.clubs (stripe_account_id) where stripe_account_id is not null;

-- Visitors see how a club takes payment (not the Stripe account).
grant select (payment_mode, stripe_charges_enabled) on public.clubs to anon;

alter table public.bookings add column if not exists payment_status text not null default 'none';
alter table public.bookings add column if not exists pay_by timestamptz;
alter table public.bookings add column if not exists paid_at timestamptz;
alter table public.bookings add column if not exists amount_paid numeric(10, 2);
alter table public.bookings add column if not exists refunded_at timestamptz;
alter table public.bookings add column if not exists stripe_checkout_session_id text;
-- The club's account the money went to, kept for refunds.
alter table public.bookings add column if not exists stripe_account_id text;

alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check
  check (payment_status in ('none', 'pending', 'paid', 'expired', 'refund_due', 'refunded'));

create index if not exists bookings_payment_todo_idx
  on public.bookings (payment_status, pay_by)
  where payment_status in ('pending', 'refund_due');


-- ----------------------------------------------------------------------------
-- 2. HOW A CLUB TAKES PAYMENT RIGHT NOW
--
-- 'club' unless its Stripe account is ready, whatever the setting says.
-- ----------------------------------------------------------------------------
create or replace function public.club_payment_mode(p_club uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
             when c.stripe_account_id is not null and c.stripe_charges_enabled then c.payment_mode
             else 'club'
           end
    from public.clubs c where c.id = p_club), 'club');
$$;

grant execute on function public.club_payment_mode(uuid) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. ONLY THE SERVER CONNECTS STRIPE
-- ----------------------------------------------------------------------------
create or replace function public.guard_club_stripe()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.stripe_account_id := null;
      new.stripe_charges_enabled := false;
    else
      new.stripe_account_id := old.stripe_account_id;
      new.stripe_charges_enabled := old.stripe_charges_enabled;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_guard_stripe on public.clubs;
create trigger clubs_guard_stripe
  before insert or update on public.clubs
  for each row execute function public.guard_club_stripe();


-- ----------------------------------------------------------------------------
-- 4. PAYMENT ON BOOKINGS
--
-- Runs after bookings_guard_player and bookings_rules_check (triggers run in
-- name order), so the price is already worked out.
-- ----------------------------------------------------------------------------
create or replace function public.guard_booking_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.role()), '');
  v_club uuid;
  v_mode text;
begin
  if tg_op = 'INSERT' then
    -- The server (webhook, jobs) sets what it needs.
    if v_role not in ('authenticated', 'anon') then
      return new;
    end if;

    select c.club_id into v_club from public.courts c where c.id = new.court_id;
    v_mode := public.club_payment_mode(v_club);

    if new.player_id is not null
       and new.player_id = (select auth.uid())
       and new.coach_id is null
       and new.group_id is null
       and v_club is not null
       and not coalesce(public.manages_club(v_club), false)
       and coalesce(new.total_price, 0) > 0
       and (v_mode = 'online' or (v_mode = 'either' and new.payment_status = 'pending')) then
      -- Held for the player while they pay (Stripe's checkout lasts 30 minutes).
      new.status := 'pending';
      new.payment_status := 'pending';
      new.pay_by := now() + interval '31 minutes';
    else
      new.payment_status := 'none';
      new.pay_by := null;
    end if;
    new.paid_at := null;
    new.amount_paid := null;
    new.refunded_at := null;
    new.stripe_checkout_session_id := null;
    new.stripe_account_id := null;
    new.stripe_payment_intent_id := null;
    return new;
  end if;

  -- UPDATE ---------------------------------------------------------------------
  if v_role in ('authenticated', 'anon') then
    -- Payment fields change only on the server.
    new.payment_status := old.payment_status;
    new.pay_by := old.pay_by;
    new.paid_at := old.paid_at;
    new.amount_paid := old.amount_paid;
    new.refunded_at := old.refunded_at;
    new.stripe_checkout_session_id := old.stripe_checkout_session_id;
    new.stripe_account_id := old.stripe_account_id;
    new.stripe_payment_intent_id := old.stripe_payment_intent_id;
    -- A booking waiting for payment is confirmed by the payment, not by hand.
    if old.payment_status = 'pending' and new.status = 'confirmed' then
      new.status := old.status;
    end if;
  end if;

  -- Cancelled: a paid booking gets its money back; an unpaid one is let go.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if new.payment_status = 'paid' then
      new.payment_status := 'refund_due';
    elsif new.payment_status = 'pending' then
      new.payment_status := 'expired';
      new.pay_by := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_zy_payment on public.bookings;
create trigger bookings_zy_payment
  before insert or update on public.bookings
  for each row execute function public.guard_booking_payment();

-- The club hears about an online booking once it is paid (section 5), not
-- while the player is still on the payment page.
drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status on public.bookings
  for each row
  when (new.payment_status not in ('pending', 'expired'))
  execute function public.notify_booking();


-- ----------------------------------------------------------------------------
-- 5. THE SERVER: PAID, AND LETTING UNPAID BOOKINGS GO
-- ----------------------------------------------------------------------------

-- Stripe says the player paid. Confirms the booking and tells the club. If
-- the booking was already let go (paid too late), it is marked for a refund.
-- Returns 'confirmed' the first time, then the payment status: safe to call
-- twice (the return page and the webhook both do).
create or replace function public.confirm_online_payment(
  p_booking uuid, p_session text, p_payment_intent text, p_amount numeric, p_account text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
  v_club uuid;
  v_data jsonb;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then
    return 'missing';
  end if;
  if b.payment_status in ('paid', 'refund_due', 'refunded') then
    return b.payment_status;
  end if;

  if b.status = 'pending' then
    update public.bookings
    set status = 'confirmed', payment_status = 'paid', paid_at = now(), pay_by = null,
        amount_paid = p_amount, stripe_checkout_session_id = p_session,
        stripe_payment_intent_id = p_payment_intent, stripe_account_id = p_account
    where id = b.id;

    -- Tell the club, like any player booking (notify_booking stays quiet
    -- for the server's own changes).
    select k.club_id into v_club from public.courts k where k.id = b.court_id;
    v_data := jsonb_build_object(
      'booking_id', b.id,
      'who', (select p.full_name from public.profiles p where p.id = b.player_id),
      'court', (select k.name from public.courts k where k.id = b.court_id),
      'starts_at', b.starts_at,
      'ends_at', b.ends_at,
      'price', b.total_price,
      'paid', true,
      'weekly', false,
      'club', (select c.name from public.clubs c where c.id = v_club),
      'club_phone', (select c.phone from public.clubs c where c.id = v_club)
    );
    begin
      perform public.notify_club(v_club, 'booking_new', v_data, '/admin/timetable');
    exception when others then
      raise warning 'confirm_online_payment notify: %', sqlerrm;
    end;
    -- Just confirmed now (a second call returns 'paid').
    return 'confirmed';
  end if;

  -- Let go before the money arrived: give it back.
  update public.bookings
  set payment_status = 'refund_due', paid_at = now(), pay_by = null,
      amount_paid = p_amount, stripe_checkout_session_id = p_session,
      stripe_payment_intent_id = p_payment_intent, stripe_account_id = p_account
  where id = b.id;
  return 'refund_due';
end;
$$;

-- Bookings nobody paid for in time. Returns them, so the server can close
-- their Stripe checkout too.
create or replace function public.expire_unpaid_bookings()
returns table (id uuid, stripe_checkout_session_id text, club_account text)
language sql
security definer
set search_path = ''
as $$
  update public.bookings b
  set status = 'cancelled', payment_status = 'expired', pay_by = null
  from public.courts k
  join public.clubs c on c.id = k.club_id
  where k.id = b.court_id
    and b.payment_status = 'pending'
    and b.pay_by < now()
  returning b.id, b.stripe_checkout_session_id, c.stripe_account_id;
$$;

revoke execute on function public.confirm_online_payment(uuid, text, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_bookings() from public, anon, authenticated;
grant execute on function public.confirm_online_payment(uuid, text, text, numeric, text) to service_role;
grant execute on function public.expire_unpaid_bookings() to service_role;

commit;
