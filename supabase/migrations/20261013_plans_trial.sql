-- ============================================================================
-- Kortello: plans and the 1-month free trial (13 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after the 12 Oct files.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- What it does
--   1. Clubs get a plan (starter / club / academy), a trial end date and a
--      "paid until" date
--   2. Only you (SQL Editor / service role) can change those three columns;
--      a club owner can't upgrade themselves from the browser
--   3. Court limit per plan, checked by the database itself
--
-- Plans (keep in step with src/lib/plans.ts)
--   starter   up to 3 active courts
--   club      up to 8 active courts
--   academy   unlimited
--   During the free trial every club has everything, with no court limit.
--
-- Billing is by hand for now. When a club pays, run for example:
--   update public.clubs
--      set plan = 'club', paid_until = '2026-12-31'
--    where slug = 'their-club-slug';
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. COLUMNS
-- ----------------------------------------------------------------------------
alter table public.clubs
  add column if not exists plan text not null default 'club';

alter table public.clubs
  drop constraint if exists clubs_plan_valid;
alter table public.clubs
  add constraint clubs_plan_valid check (plan in ('starter', 'club', 'academy'));

-- New clubs get one month free from the day they sign up.
alter table public.clubs
  add column if not exists trial_ends_at timestamptz;
alter table public.clubs
  alter column trial_ends_at set default (now() + interval '30 days');

-- Clubs that already exist start their free month today.
update public.clubs
   set trial_ends_at = now() + interval '30 days'
 where trial_ends_at is null;

-- Last day the club has paid for (null = hasn't paid yet).
alter table public.clubs
  add column if not exists paid_until date;


-- ----------------------------------------------------------------------------
-- 2. ONLY YOU CAN CHANGE THE PLAN
--
-- Club owners may update their own club (name, hours, ...). This trigger puts
-- the billing columns back whenever the change comes from a signed-in user,
-- and gives every new club the standard trial no matter what was sent.
-- ----------------------------------------------------------------------------
create or replace function public.protect_club_billing()
returns trigger
language plpgsql
as $$
begin
  if coalesce((select auth.role()), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'club';
      new.trial_ends_at := now() + interval '30 days';
      new.paid_until := null;
    else
      new.plan := old.plan;
      new.trial_ends_at := old.trial_ends_at;
      new.paid_until := old.paid_until;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_protect_billing on public.clubs;
create trigger clubs_protect_billing
  before insert or update on public.clubs
  for each row execute function public.protect_club_billing();


-- ----------------------------------------------------------------------------
-- 3. COURT LIMIT
--
-- Null = no limit. Only checked when a court is added or switched on, so a
-- club that is over its limit when the trial ends keeps the courts it has.
-- ----------------------------------------------------------------------------
create or replace function public.club_max_courts(p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.trial_ends_at is not null and c.trial_ends_at > now() then null
    when c.plan = 'starter' then 3
    when c.plan = 'club' then 8
    else null
  end
  from public.clubs c
  where c.id = p_club_id;
$$;

revoke execute on function public.club_max_courts(uuid) from public, anon;
grant execute on function public.club_max_courts(uuid) to authenticated;

create or replace function public.enforce_court_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_courts integer;
  active_courts integer;
begin
  if not coalesce(new.is_active, false) then
    return new;
  end if;
  -- Nothing to check if an active court only had its name or price changed.
  if tg_op = 'UPDATE'
     and coalesce(old.is_active, false)
     and old.club_id is not distinct from new.club_id then
    return new;
  end if;

  max_courts := public.club_max_courts(new.club_id);
  if max_courts is null then
    return new;
  end if;

  select count(*) into active_courts
    from public.courts
   where club_id = new.club_id
     and is_active
     and id <> new.id;

  if active_courts >= max_courts then
    raise exception 'court limit reached: this plan allows % active courts', max_courts
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists courts_enforce_limit on public.courts;
create trigger courts_enforce_limit
  before insert or update of is_active, club_id on public.courts
  for each row execute function public.enforce_court_limit();

commit;
