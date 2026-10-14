-- ============================================================================
-- ServeTime: owner page (17 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261016_club_notices.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- What it does
--   1. Nobody can change their own role (player / club_admin / super_admin)
--      by editing their profile. The app's own database functions, such as
--      the one that makes a new club owner a club admin, keep working.
--   2. club_payments: every payment you record on the owner page.
--   3. Makes YOUR account the super admin (edit the email first, see below).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. ROLES CAN'T BE CHANGED FROM THE APP
--
-- A signed-in user's own update of their profile keeps the old role. Changes
-- made by a SECURITY DEFINER function (which runs as its owner, not as the
-- user) still go through, but never to super_admin. The SQL Editor and the
-- service-role key are not limited.
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
declare
  v_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'super_admin' then
      new.role := 'player';
    end if;
    return new;
  end if;

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


-- ----------------------------------------------------------------------------
-- 2. PAYMENTS YOU RECORD
-- ----------------------------------------------------------------------------
create table if not exists public.club_payments (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  plan        text not null check (plan in ('starter', 'club', 'academy')),
  period      text not null check (period in ('month', 'year')),
  amount      numeric(10, 2) not null check (amount >= 0),
  method      text not null check (method in ('bank', 'cash')),
  -- What paid_until became with this payment.
  paid_until  date not null,
  created_at  timestamptz not null default now()
);

create index if not exists club_payments_club_idx
  on public.club_payments (club_id, created_at desc);

-- Only the server (service role) uses this table.
alter table public.club_payments enable row level security;

commit;


-- ----------------------------------------------------------------------------
-- 3. MAKE YOURSELF THE SUPER ADMIN
--
-- Put the email you sign in with between the quotes, then run this line on
-- its own (select it and press Run). Should say "UPDATE 1".
-- ----------------------------------------------------------------------------
-- update public.profiles set role = 'super_admin'
-- where id = (select id from auth.users where email = 'you@example.com');
