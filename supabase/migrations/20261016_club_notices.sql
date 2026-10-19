-- ============================================================================
-- Kortello: emails about a club's account (16 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261015_lessons_hold_court.sql.
-- Safe to run a second time.
--
-- One row per email already sent about a club, so none is ever sent twice:
--   new_club                  the email to you when a club signs up
--   trial_ending:2026-11-13   "your trial ends soon" for that trial end date
--   trial_ended:2026-11-13    "your trial has ended" for that trial end date
-- If you extend a club's trial, the new end date gets its own emails.
-- ============================================================================

begin;

create table if not exists public.club_notices (
  club_id uuid not null references public.clubs(id) on delete cascade,
  kind    text not null,
  sent_at timestamptz not null default now(),
  primary key (club_id, kind)
);

-- Only the server (service role) uses this table.
alter table public.club_notices enable row level security;

commit;
