-- ============================================================================
-- RaqHub: court photos (2 Nov 2026)
--
-- Run once in the Supabase SQL Editor. Safe to run a second time.
--
-- A club can upload a photo of each court. Empty: the app draws the court
-- (src/components/courts/CourtArt.tsx). The photo itself is in the public
-- "avatars" bucket, in the uploader's own folder, like the club logo.
-- ============================================================================

alter table public.courts
  add column if not exists image_url text;

alter table public.courts drop constraint if exists courts_image_url_check;
alter table public.courts
  add constraint courts_image_url_check
  check (image_url is null or image_url like 'https://%');

-- Visitors who aren't signed in may only read the courts columns they were
-- given one by one; without this the club's public page shows no courts.
grant select (image_url) on public.courts to anon;
