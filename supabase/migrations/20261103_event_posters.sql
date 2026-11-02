-- ============================================================================
-- RaqHub: event posters (3 Nov 2026)
--
-- Run once in the Supabase SQL Editor. Safe to run a second time.
--
-- A club can upload a poster for a league, tournament or Americano evening.
-- It shows on the event's public page and in the picture shown when its link
-- is shared. The image itself is in the public "avatars" bucket, in the
-- uploader's own folder, like club logos and court photos.
-- ============================================================================

alter table public.leagues       add column if not exists cover_url text;
alter table public.tournaments   add column if not exists cover_url text;
alter table public.social_events add column if not exists cover_url text;

alter table public.leagues drop constraint if exists leagues_cover_url_check;
alter table public.leagues add constraint leagues_cover_url_check
  check (cover_url is null or cover_url like 'https://%');
alter table public.tournaments drop constraint if exists tournaments_cover_url_check;
alter table public.tournaments add constraint tournaments_cover_url_check
  check (cover_url is null or cover_url like 'https://%');
alter table public.social_events drop constraint if exists social_events_cover_url_check;
alter table public.social_events add constraint social_events_cover_url_check
  check (cover_url is null or cover_url like 'https://%');

-- Visitors who aren't signed in read these pages too.
grant select (cover_url) on public.leagues, public.tournaments, public.social_events to anon;
