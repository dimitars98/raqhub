-- ============================================================================
-- Kortello: court colours (27 Oct 2026)
--
-- Run once in the Supabase SQL Editor. Safe to run a second time.
--
-- The colour of a court as it really is (a hard court can be blue or green),
-- so the booking page draws it right and says it: "Hard · Blue".
-- Empty: the app uses the usual colour of the court's surface.
-- ============================================================================

alter table public.courts
  add column if not exists color text;

alter table public.courts drop constraint if exists courts_color_check;
alter table public.courts
  add constraint courts_color_check
  check (color is null or color in ('blue', 'green', 'terracotta', 'red', 'purple', 'grey'));
