-- ============================================================================
-- When a club's free month ends: 3 days' grace, then read-only.
--
--   trial    until trial_ends_at                 everything works
--   paid     through paid_until (a date)         everything works
--   grace    3 days after the later of the two   everything works (red banner)
--   locked   after that                          read-only, online booking paused
--
-- Nothing is deleted and nobody is charged. Extending the trial or recording a
-- payment on the owner page (both use the service role) unlocks the club
-- straight away.
--
-- While locked:
--   * the club's owner, staff and group coaches can't add, change or delete
--     anything of the club (they can still look and export);
--   * players and parents can't make new commitments: book, join a group, take
--     an offered place, book a drop-in, enter a tournament. They can still
--     cancel, leave, or say they can't come.
-- Scheduled jobs and the owner page use the service role and are not affected.
--
-- Mirrors clubAccess() in src/lib/plans.ts. Safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. IS THE CLUB LOCKED?
-- ----------------------------------------------------------------------------
create or replace function public.club_locked(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not (
      -- in the free trial
      (c.trial_ends_at is not null and c.trial_ends_at > now())
      -- paid: through the end of paid_until (UTC, like the app)
      or (c.paid_until is not null and (c.paid_until + 1)::timestamp at time zone 'UTC' > now())
      -- 3 days' grace after whichever ended last
      or greatest(
           c.trial_ends_at,
           (c.paid_until + 1)::timestamp at time zone 'UTC'
         ) + interval '3 days' > now()
    )
    from public.clubs c
    where c.id = p_club
  ), false);
$$;

-- Which of these clubs have online booking paused. Visitors can't read the
-- billing columns (20261023_clubs_public_columns.sql), so pages ask this.
create or replace function public.paused_clubs(p_clubs uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from unnest(p_clubs) as id where public.club_locked(id);
$$;

revoke execute on function public.club_locked(uuid) from public;
revoke execute on function public.paused_clubs(uuid[]) from public;
grant execute on function public.club_locked(uuid) to anon, authenticated, service_role;
grant execute on function public.paused_clubs(uuid[]) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. THE GUARD
--
-- One trigger function on every table that holds a club's data. Named
-- "a_..." so it runs before the other triggers and its message wins.
-- ----------------------------------------------------------------------------
create or replace function public.guard_locked_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_club uuid;
  v_group uuid;
  v_manager boolean;
  v_commitment boolean;
begin
  -- Scheduled jobs and the owner page (service role) are never stopped.
  if coalesce((select auth.role()), '') not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then r := old; else r := new; end if;

  case tg_table_name
    when 'clubs' then
      v_club := r.id;
    when 'courts', 'coaches', 'membership_plans', 'members', 'club_staff', 'tournaments' then
      v_club := r.club_id;
    when 'groups' then
      v_club := r.club_id;
      v_group := r.id;
    when 'availability' then
      v_club := coalesce(
        (select c.club_id from public.courts c where c.id = r.court_id),
        (select c.club_id from public.coaches c where c.id = r.coach_id));
    when 'bookings' then
      v_group := r.group_id;
      v_club := coalesce(
        (select c.club_id from public.courts c where c.id = r.court_id),
        (select c.club_id from public.coaches c where c.id = r.coach_id),
        public.group_club(r.group_id));
    when 'group_sessions', 'group_players' then
      v_group := r.group_id;
      v_club := public.group_club(v_group);
    when 'group_attendance' then
      v_group := public.session_group(r.session_id);
      v_club := public.group_club(v_group);
    when 'group_fees' then
      v_group := public.player_group(r.player_id);
      v_club := public.group_club(v_group);
    when 'tournament_entries', 'tournament_matches' then
      v_club := (select t.club_id from public.tournaments t where t.id = r.tournament_id);
    else
      v_club := null;
  end case;

  if v_club is null or not public.club_locked(v_club) then
    return coalesce(new, old);
  end if;

  -- The club's own people: nothing changes while it's read-only.
  v_manager := coalesce(public.manages_club(v_club), false)
    or (v_group is not null and coalesce(public.coaches_group(v_group), false));
  if v_manager then
    raise exception 'club_locked'
      using hint = 'The club''s free trial has ended; the account is read-only until it is renewed.';
  end if;

  -- Players, parents and visitors: only new commitments are stopped.
  -- (Separate branches: a row's fields may only be read on its own table.)
  if tg_table_name in ('bookings', 'tournament_entries') then
    v_commitment := tg_op = 'INSERT';
  elsif tg_table_name = 'group_players' then
    if tg_op = 'INSERT' then
      v_commitment := true;
    elsif tg_op = 'UPDATE' then
      v_commitment := new.status in ('active', 'trial') and old.status not in ('active', 'trial');
    else
      v_commitment := false;
    end if;
  elsif tg_table_name = 'group_attendance' then
    if tg_op = 'INSERT' then
      v_commitment := new.status = 'booked';
    elsif tg_op = 'UPDATE' then
      v_commitment := new.status = 'booked' and old.status is distinct from 'booked';
    else
      v_commitment := false;
    end if;
  elsif tg_table_name in ('club_staff', 'availability') then
    -- Accepting a staff invite and a coach's own availability stay possible.
    v_commitment := false;
  else
    v_commitment := true;
  end if;

  if v_commitment then
    raise exception 'club_locked'
      using hint = 'Online booking is paused at this club.';
  end if;

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clubs', 'courts', 'coaches', 'availability', 'membership_plans', 'members',
    'club_staff', 'bookings', 'groups', 'group_sessions', 'group_players',
    'group_attendance', 'group_fees', 'tournaments', 'tournament_entries',
    'tournament_matches'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists a_club_locked_guard on public.%I', t);
      execute format(
        'create trigger a_club_locked_guard before insert or update or delete on public.%I
           for each row execute function public.guard_locked_club()', t);
    end if;
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. COURT LIMIT: unlimited during the grace days too, like the trial
-- ----------------------------------------------------------------------------
create or replace function public.club_max_courts(p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.trial_ends_at is not null
         and c.trial_ends_at + interval '3 days' > now()
         and (c.paid_until is null or c.trial_ends_at > now()) then null
    when c.plan = 'starter' then 3
    when c.plan = 'club' then 8
    else null
  end
  from public.clubs c
  where c.id = p_club_id;
$$;

commit;
