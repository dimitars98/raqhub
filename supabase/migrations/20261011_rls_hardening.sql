-- ============================================================================
-- ServeTime: RLS hardening (11 Oct 2026)
--
-- Run once in the Supabase SQL Editor. It is wrapped in a transaction, so if
-- any statement fails nothing is changed. Safe to run a second time.
--
-- What it does
--   1. Bookings   players can only create honest bookings and only cancel them
--   2. Members    a player can read their own membership (my_memberships)
--   3. Profiles   no more public phone numbers
--   4. Clubs      owner always sees own club, one club per owner
--   5. Coaches    a coach can no longer move themselves to another club
--   6. Storage    avatar uploads, limited to the user's own folder
--   7. Cleanup    remove the duplicate overlap rule on bookings
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. BOOKINGS
--
-- The policies decide WHICH rows a user may touch. They cannot decide WHAT
-- the row contains, so this trigger does that for players:
--   insert  the database sets end time, price (with member discount) and status
--   update  the only change allowed is cancelling
-- Club owners working on their own courts are not restricted here; the
-- existing policies already limit them to their own club.
-- The SQL Editor and the service-role key are not restricted either.
-- ----------------------------------------------------------------------------
create or replace function public.guard_player_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_role     text := coalesce(auth.jwt() ->> 'role', '');
  v_court_id uuid;
  v_club_id  uuid;
  v_rate     numeric;
  v_discount numeric := 0;
begin
  -- Only requests coming through the API as a signed-in user are checked.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_court_id := new.court_id;
  else
    v_court_id := old.court_id;
  end if;

  -- Owner of the club this court belongs to: no extra rules.
  if v_court_id is not null and exists (
    select 1
    from public.courts c
    join public.clubs cl on cl.id = c.club_id
    where c.id = v_court_id
      and cl.owner_id = v_uid
  ) then
    return new;
  end if;

  -- ---- Player: UPDATE ------------------------------------------------------
  if tg_op = 'UPDATE' then
    if new.status = 'cancelled'
       and old.status in ('pending', 'confirmed', 'cancelled') then
      -- Keep every column as it was; only the status changes.
      new := old;
      new.status := 'cancelled';
      return new;
    end if;
    raise exception 'Players can only cancel a booking'
      using errcode = '42501';
  end if;

  -- ---- Player: INSERT ------------------------------------------------------
  if new.player_id is distinct from v_uid then
    raise exception 'You can only book for yourself'
      using errcode = '42501';
  end if;

  if new.duration_min is null
     or new.duration_min < 30
     or new.duration_min > 240 then
    raise exception 'Invalid booking duration'
      using errcode = '22023';
  end if;

  if new.starts_at < now() - interval '5 minutes' then
    raise exception 'That time has already passed'
      using errcode = '22023';
  end if;

  -- Price source: the court, or the coach for a coach-only booking.
  if new.court_id is not null then
    select c.price_per_hour, c.club_id
      into v_rate, v_club_id
    from public.courts c
    join public.clubs cl on cl.id = c.club_id
    where c.id = new.court_id
      and c.is_active is true
      and cl.is_active is true;
  else
    select co.price_per_hour, co.club_id
      into v_rate, v_club_id
    from public.coaches co
    where co.id = new.coach_id
      and co.is_active is true;
  end if;

  if v_rate is null then
    raise exception 'This court or coach is not available'
      using errcode = '22023';
  end if;

  -- Member discount: only for an active membership at THIS club, matched on
  -- the user's confirmed email address.
  select coalesce(max(mp.discount_pct), 0)
    into v_discount
  from auth.users u
  join public.members m on lower(m.email) = lower(u.email)
  join public.membership_plans mp on mp.id = m.plan_id
  where u.id = v_uid
    and u.email_confirmed_at is not null
    and m.club_id = v_club_id
    and m.status = 'active';

  v_discount := least(greatest(coalesce(v_discount, 0), 0), 100);

  -- Values the browser is never trusted with.
  new.ends_at     := new.starts_at + make_interval(mins => new.duration_min);
  new.total_price := round(v_rate * new.duration_min / 60.0 * (1 - v_discount / 100.0), 2);
  new.status      := 'confirmed';
  new.member_id   := null;
  new.walk_in_name := null;
  new.checked_in_at := null;
  new.stripe_payment_intent_id := null;

  return new;
end;
$$;

-- The name sorts before trg_bookings_updated_at, so this runs first.
drop trigger if exists bookings_guard_player on public.bookings;
create trigger bookings_guard_player
  before insert or update on public.bookings
  for each row execute function public.guard_player_booking();


-- ----------------------------------------------------------------------------
-- 2. MEMBERS
--
-- The members table stays owner-only (it holds the club's private notes).
-- Players get their own membership through this function instead. It matches
-- on the confirmed email of the signed-in user and leaves the notes out.
-- Returns a JSON array: member fields + "club" {id, name} + "plan" {...}.
-- ----------------------------------------------------------------------------
create or replace function public.my_memberships()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      (to_jsonb(m) - 'notes')
        || jsonb_build_object(
             'club', jsonb_build_object('id', c.id, 'name', c.name),
             'plan', to_jsonb(mp)
           )
      order by (m.status = 'active') desc, m.created_at desc
    ),
    '[]'::jsonb
  )
  from auth.users u
  join public.members m on lower(m.email) = lower(u.email)
  join public.clubs c on c.id = m.club_id
  left join public.membership_plans mp on mp.id = m.plan_id
  where u.id = auth.uid()
    and u.email_confirmed_at is not null;
$$;

revoke execute on function public.my_memberships() from public, anon;
grant execute on function public.my_memberships() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. PROFILES
--
-- Before: anyone, even logged out, could read every profile including phone.
-- After:
--   - you can read your own profile
--   - everyone can read the profile of an active coach (public coach pages)
--   - a club owner can read their coaches and the players who booked with them
--   - logged-out visitors only ever get id, full_name and avatar_url
-- ----------------------------------------------------------------------------
-- The two helper functions below run with the table owner's rights. That is
-- on purpose: the clubs policies look at profiles, so if the profiles policies
-- looked at clubs directly Postgres would stop with "infinite recursion".
create or replace function public.profile_is_active_coach(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coaches co
    where co.profile_id = p_profile_id
      and co.is_active is true
  );
$$;

create or replace function public.profile_visible_to_my_club(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.coaches co
      join public.clubs cl on cl.id = co.club_id
      where co.profile_id = p_profile_id
        and cl.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.bookings b
      join public.courts c on c.id = b.court_id
      join public.clubs cl on cl.id = c.club_id
      where b.player_id = p_profile_id
        and cl.owner_id = auth.uid()
    );
$$;

revoke execute on function public.profile_is_active_coach(uuid) from public;
grant  execute on function public.profile_is_active_coach(uuid) to anon, authenticated;
revoke execute on function public.profile_visible_to_my_club(uuid) from public, anon;
grant  execute on function public.profile_visible_to_my_club(uuid) to authenticated;

drop policy if exists "profiles_select_all"         on public.profiles;
drop policy if exists "profiles_select_own"         on public.profiles;
drop policy if exists "profiles_select_coaches"     on public.profiles;
drop policy if exists "profiles_select_club_owner"  on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_select_coaches" on public.profiles
  for select to anon, authenticated
  using (public.profile_is_active_coach(id));

create policy "profiles_select_club_owner" on public.profiles
  for select to authenticated
  using (public.profile_visible_to_my_club(id));

-- Logged-out visitors: name and picture only, never phone or Stripe id.
revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url) on public.profiles to anon;


-- ----------------------------------------------------------------------------
-- 4. CLUBS
-- ----------------------------------------------------------------------------
-- An owner can always see their own club, even if it is deactivated.
drop policy if exists "clubs_select_owner" on public.clubs;
create policy "clubs_select_owner" on public.clubs
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- One club per owner (every admin page assumes this). Skipped with a notice
-- if somebody already owns two clubs, so the rest of the migration still runs.
do $$
begin
  if exists (
    select 1 from public.clubs
    where owner_id is not null
    group by owner_id
    having count(*) > 1
  ) then
    raise notice 'SKIPPED clubs_one_per_owner: an owner already has more than one club. Fix the data, then run this file again.';
  else
    create unique index if not exists clubs_one_per_owner
      on public.clubs (owner_id)
      where owner_id is not null;
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. COACHES
--
-- This policy let a coach change their own club_id, price and active flag.
-- No screen in the app uses it; club owners manage coaches.
-- ----------------------------------------------------------------------------
drop policy if exists "coaches_update_own" on public.coaches;


-- ----------------------------------------------------------------------------
-- 6. STORAGE: avatars
--
-- Files are stored as  <user id>/avatar.<ext>  and each user may only write
-- inside their own folder. The bucket is public, so pictures are shown through
-- their public URL without needing a read policy for everyone.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- ----------------------------------------------------------------------------
-- 7. CLEANUP: duplicate overlap rule on bookings
--
-- There are two "no overlapping bookings on one court" constraints. The newer
-- one (everything except cancelled / no_show) already covers the older one
-- (confirmed, pending, completed). The older one is dropped only if the newer
-- one is really there.
-- ----------------------------------------------------------------------------
do $$
declare
  v_old text;
  v_has_new boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'x'
      and pg_get_constraintdef(oid) like '%court_id WITH =%'
      and pg_get_constraintdef(oid) like '%<> ALL%cancelled%no_show%'
  ) into v_has_new;

  select conname into v_old
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and contype = 'x'
    and pg_get_constraintdef(oid) like '%court_id WITH =%'
    and pg_get_constraintdef(oid) like '%= ANY%confirmed%pending%completed%'
  limit 1;

  if v_has_new and v_old is not null then
    execute format('alter table public.bookings drop constraint %I', v_old);
    raise notice 'Dropped duplicate constraint %', v_old;
  end if;
end;
$$;

commit;
