-- ============================================================================
-- Kortello: super admin lock (21 Oct 2026)
--
-- Run once in the Supabase SQL Editor. Safe to run a second time.
--
-- Closes one gap in 20261017_owner_page.sql. That trigger stopped signed-in
-- users from giving themselves a role, but it let NEW profiles through
-- untouched when they were created during sign-up (sign-up doesn't run as a
-- signed-in user). If the sign-up trigger copies the role someone sends
-- along, anyone could sign up straight in as super_admin.
--
-- Now a new profile can only ever start as 'player' or 'club_admin',
-- whoever creates it. super_admin can only be given by changing an existing
-- profile in the SQL Editor (or with the secret key), never by the app.
-- ============================================================================

begin;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- New profiles: always player or club admin, no matter who creates them.
  if tg_op = 'INSERT' then
    if new.role is null or new.role not in ('player', 'club_admin') then
      new.role := 'player';
    end if;
    return new;
  end if;

  -- The SQL Editor and the secret key may change roles.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  -- From the app: never to super_admin, and never by the user themselves.
  -- (The app's own SECURITY DEFINER functions may still make someone a
  -- club admin.)
  if new.role is distinct from old.role then
    if new.role = 'super_admin' or current_user in ('authenticated', 'anon') then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

commit;


-- ----------------------------------------------------------------------------
-- CHECK: who is super admin right now? Should be only you.
-- ----------------------------------------------------------------------------
-- select u.email, p.role
--   from public.profiles p join auth.users u on u.id = p.id
--  where p.role = 'super_admin';
