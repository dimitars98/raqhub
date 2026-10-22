-- ============================================================================
-- Kortello: what visitors can see about a club (23 Oct 2026)
--
-- Run once in the Supabase SQL Editor. Safe to run a second time.
--
-- Anyone not signed in could read every column of every active club,
-- including its plan, trial end, paid-until date and owner. From now on
-- visitors only get what a club's public page shows: name, address,
-- contact details, pictures, opening hours and booking rules.
--
-- Signed-in people are not affected. A column added to clubs later is
-- hidden from visitors until it's added to the list below.
-- ============================================================================

begin;

revoke select on public.clubs from anon;

grant select (
  id, name, slug, description,
  address, city, country, lat, lng,
  phone, email, website,
  logo_url, cover_url,
  opening_hours, booking_rules,
  is_active, created_at, updated_at
) on public.clubs to anon;

commit;
