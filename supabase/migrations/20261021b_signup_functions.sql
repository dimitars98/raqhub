-- ============================================================================
-- Kortello: sign-up functions (21 Oct 2026)
--
-- These two already exist in your database; they were made in Supabase and
-- never saved in this project. This file records them exactly as they are,
-- so the project holds everything a fresh database needs.
-- Run it on a new database after schema.sql. Safe to run on your current one
-- too: nothing changes except who may call claim_club_admin_role (see 3).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. A PROFILE FOR EVERY NEW ACCOUNT
--
-- Runs when someone signs up. They start as a player, or as a club admin if
-- they signed up through "For clubs". Nothing else can be asked for here
-- (and 20261021_super_admin_lock.sql blocks super_admin on top of that).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case
      when new.raw_user_meta_data->>'role' = 'club_admin' then 'club_admin'
      else 'player'
    end
  );
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. CLUB ADMIN AFTER SIGNING UP WITH GOOGLE
--
-- Google sign-up can't send "For clubs" along, so the app calls this right
-- after. It only turns your own account from player into club admin, and
-- only in the first 5 minutes after it was created.
-- ----------------------------------------------------------------------------
create or replace function public.claim_club_admin_role()
returns void
language sql
security definer
set search_path to ''
as $$
  update public.profiles p
  set role = 'club_admin'
  from auth.users u
  where p.id = auth.uid()
    and u.id = p.id
    and p.role = 'player'
    and u.created_at > now() - interval '5 minutes';
$$;

-- ----------------------------------------------------------------------------
-- 3. ONLY SIGNED-IN USERS MAY CALL IT
--
-- Someone not signed in couldn't change anything with it anyway; this just
-- keeps it off the list of things they can call at all.
-- ----------------------------------------------------------------------------
revoke execute on function public.claim_club_admin_role() from public, anon;
grant execute on function public.claim_club_admin_role() to authenticated;

commit;
