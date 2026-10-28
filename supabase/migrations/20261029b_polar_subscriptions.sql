-- ============================================================================
-- Kortello: clubs pay for their plan by card, through Polar (29 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261029_online_payments.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- Polar sells the Kortello plans as subscriptions (it is the "merchant of
-- record": it charges the card, handles VAT and pays you out). Its webhook
-- (src/app/api/polar/webhook/route.ts, service role) keeps these up to date:
--
--   clubs.plan, clubs.paid_until    as before: what the club has paid for
--   clubs.polar_subscription_id     the club's Polar subscription
--   clubs.subscription_status       active, trialing, past_due, canceled, …
--   clubs.subscription_period       month or year
--   clubs.subscription_ends         true: cancelled, ends at paid_until
--   club_payments                   every card payment, method 'card'
--
-- Bank transfers and cash still work: you record them on the owner page.
-- ============================================================================

begin;

alter table public.clubs add column if not exists polar_subscription_id text;
alter table public.clubs add column if not exists subscription_status text;
alter table public.clubs add column if not exists subscription_period text;
alter table public.clubs add column if not exists subscription_ends boolean not null default false;

alter table public.clubs drop constraint if exists clubs_subscription_period_check;
alter table public.clubs add constraint clubs_subscription_period_check
  check (subscription_period is null or subscription_period in ('month', 'year'));

-- Only the server changes them (like plan and paid_until).
create or replace function public.guard_club_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.polar_subscription_id := null;
      new.subscription_status := null;
      new.subscription_period := null;
      new.subscription_ends := false;
    else
      new.polar_subscription_id := old.polar_subscription_id;
      new.subscription_status := old.subscription_status;
      new.subscription_period := old.subscription_period;
      new.subscription_ends := old.subscription_ends;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_guard_subscription on public.clubs;
create trigger clubs_guard_subscription
  before insert or update on public.clubs
  for each row execute function public.guard_club_subscription();

-- Card payments from Polar appear with the ones you record.
alter table public.club_payments drop constraint if exists club_payments_method_check;
alter table public.club_payments add constraint club_payments_method_check
  check (method in ('bank', 'cash', 'card'));
alter table public.club_payments add column if not exists polar_order_id text;
create unique index if not exists club_payments_polar_order_idx
  on public.club_payments (polar_order_id) where polar_order_id is not null;

commit;
