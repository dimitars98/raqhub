-- ============================================================================
-- Kortello: free automation (12 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after the two earlier files.
-- Wrapped in a transaction; safe to run a second time.
--
-- What it does
--   1. Columns the email jobs use to never send the same email twice
--   2. Bookings that are over become "completed" by themselves (every 15 min)
--   3. Memberships past their end date become "expired" (every night)
--   4. Both jobs are scheduled with Supabase Cron (pg_cron), which is free
--
-- The emails themselves (reminders, renewals, weekly report) are sent by the
-- app. Schedule that call separately with supabase/cron_http_job.sql once the
-- app is online.
-- ============================================================================

create extension if not exists pg_cron;

begin;

-- ----------------------------------------------------------------------------
-- 1. BOOKKEEPING FOR EMAILS
-- ----------------------------------------------------------------------------
-- When the 24-hour reminder went out (null = not yet).
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- Language the player used when booking, so the reminder speaks it too.
alter table public.bookings
  add column if not exists locale text;

-- When the "your membership ends soon" email went out for the current end date.
alter table public.members
  add column if not exists renewal_reminder_sent_at timestamptz;

-- If the club extends a membership, a new reminder is due before the new date.
create or replace function public.reset_renewal_reminder()
returns trigger
language plpgsql
as $$
begin
  if new.ends_at is distinct from old.ends_at then
    new.renewal_reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists members_reset_renewal_reminder on public.members;
create trigger members_reset_renewal_reminder
  before update on public.members
  for each row execute function public.reset_renewal_reminder();

-- One weekly report per club per week.
create table if not exists public.club_weekly_reports (
  club_id    uuid not null references public.clubs(id) on delete cascade,
  week_start date not null,
  sent_at    timestamptz not null default now(),
  primary key (club_id, week_start)
);

-- Only the server (service role) uses this table.
alter table public.club_weekly_reports enable row level security;


-- ----------------------------------------------------------------------------
-- 2. FINISHED BOOKINGS BECOME "COMPLETED"
--
-- Confirmed bookings whose end time passed 15 minutes ago. Staff can still
-- change one to "no show" afterwards.
-- ----------------------------------------------------------------------------
create or replace function public.complete_finished_bookings()
returns integer
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.bookings
    set status = 'completed'
    where status = 'confirmed'
      and ends_at < now() - interval '15 minutes'
    returning 1
  )
  select count(*)::int from done;
$$;


-- ----------------------------------------------------------------------------
-- 3. MEMBERSHIPS PAST THEIR END DATE BECOME "EXPIRED"
-- ----------------------------------------------------------------------------
create or replace function public.expire_memberships()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    update public.members
    set status = 'expired'
    where status = 'active'
      and ends_at is not null
      and ends_at < (now() at time zone 'Europe/Skopje')::date
    returning 1
  )
  select count(*)::int from gone;
$$;

-- Nobody calls these through the API; only the scheduler and the server.
revoke execute on function public.complete_finished_bookings() from public, anon, authenticated;
revoke execute on function public.expire_memberships() from public, anon, authenticated;

commit;


-- ----------------------------------------------------------------------------
-- 4. SCHEDULE (Supabase Cron). Scheduling again under the same name replaces
-- the old job, so running this file twice is fine.
-- ----------------------------------------------------------------------------
select cron.schedule(
  'servetime-complete-bookings',
  '*/15 * * * *',
  $$ select public.complete_finished_bookings(); $$
);

-- 00:05 Skopje time (22:05 UTC in summer, 23:05 in winter; 22:05 covers both)
select cron.schedule(
  'servetime-expire-memberships',
  '5 22 * * *',
  $$ select public.expire_memberships(); $$
);

-- Keep the scheduler's own log small (it never cleans itself up).
select cron.schedule(
  'servetime-clean-cron-log',
  '0 3 * * 0',
  $$ delete from cron.job_run_details where end_time < now() - interval '14 days'; $$
);
