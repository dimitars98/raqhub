-- ============================================================================
-- ServeTime: weekly repeating bookings (19 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261018_tournaments.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- A club can add a booking that repeats every week ("every Tuesday at 19:00
-- for 12 weeks"). Each week is an ordinary booking; the ones made together
-- share a series_id, so the club can cancel the rest of a series at once.
-- Nothing else changes: overlaps, prices and access rules work exactly as
-- for any other booking.
-- ============================================================================

begin;

alter table public.bookings
  add column if not exists series_id uuid;

create index if not exists bookings_series_idx
  on public.bookings (series_id, starts_at)
  where series_id is not null;

commit;
