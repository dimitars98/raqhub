-- ============================================================================
-- Kortello: notifications (22 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261021b_signup_functions.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- What it does
--   1. notifications: one row per notification, for one person.
--   2. notification_prefs: the kinds each person switched off.
--   3. Rules that create notifications when something happens:
--        a player books, books a lesson or cancels      → the club
--        a player enters or leaves a tournament          → the club
--        a staff member accepts an invite               → the club owner
--        the club books or cancels for a player         → that player
--        the tournament draw is made                    → each player in it
--   4. A daily check (run by the hourly job) for: reminders the day before,
--      memberships ending within a week, and the free trial ending.
--   5. Live updates: new notifications reach an open page straight away.
--
-- Nobody is notified about something they did themselves. Notifications
-- are kept for 60 days.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  club_id     uuid references public.clubs(id) on delete cascade,
  -- What happened, e.g. booking_new. The app turns kind + data into text in
  -- the reader's language.
  kind        text not null,
  data        jsonb not null default '{}'::jsonb,
  -- Where tapping it goes, inside the app (e.g. /admin/bookings).
  link        text,
  -- Stops the same notification being made twice (e.g. one reminder per
  -- booking). Null when that can't happen.
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- People can read their own and mark them read; nothing else. Notifications
-- are only ever made by the rules below.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;


-- ----------------------------------------------------------------------------
-- 2. WHAT EACH PERSON SWITCHED OFF
-- ----------------------------------------------------------------------------
create table if not exists public.notification_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  -- Categories switched off, e.g. {bookings,tournaments}
  muted       text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs_own" on public.notification_prefs;
create policy "notification_prefs_own" on public.notification_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notification_prefs from anon, authenticated;
grant select, insert, update on public.notification_prefs to authenticated;

-- Which on/off switch a kind belongs to. 'always' can't be switched off.
create or replace function public.notification_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'booking_new'       then 'bookings'
    when 'lesson_new'        then 'lessons'
    when 'booking_cancelled' then 'cancellations'
    when 'tournament_joined' then 'tournaments'
    when 'tournament_left'   then 'tournaments'
    when 'members_ending'    then 'members'
    when 'staff_joined'      then 'staff'
    when 'club_booked'       then 'club_changes'
    when 'club_cancelled'    then 'club_changes'
    when 'reminder'          then 'reminders'
    when 'draw'              then 'tournaments'
    when 'membership_ending' then 'membership'
    else 'always'
  end;
$$;


-- ----------------------------------------------------------------------------
-- 3. MAKING NOTIFICATIONS
-- ----------------------------------------------------------------------------

-- One notification for one person, unless it's their own doing, they
-- switched that kind off, or the same one already exists.
create or replace function public.notify(
  p_user uuid, p_club uuid, p_kind text, p_data jsonb, p_link text, p_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_user = (select auth.uid()) then
    return;
  end if;
  if exists (
    select 1 from public.notification_prefs np
    where np.user_id = p_user
      and public.notification_category(p_kind) = any (np.muted)
  ) then
    return;
  end if;
  insert into public.notifications (user_id, club_id, kind, data, link, dedupe_key)
  values (p_user, p_club, p_kind, coalesce(p_data, '{}'::jsonb), p_link, p_key)
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- The same notification for a club's owner and everyone on its staff.
create or replace function public.notify_club(
  p_club uuid, p_kind text, p_data jsonb, p_link text,
  p_owner_only boolean default false, p_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_club is null then
    return;
  end if;
  for r in
    select c.owner_id as user_id from public.clubs c
    where c.id = p_club and c.owner_id is not null
    union
    select s.user_id from public.club_staff s
    where s.club_id = p_club and s.user_id is not null and not p_owner_only
  loop
    perform public.notify(r.user_id, p_club, p_kind, p_data, p_link, p_key);
  end loop;
end;
$$;

-- The player account of a club member: the confirmed account with the
-- member's email address, if there is one.
create or replace function public.account_of_member(p_member uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.members m
  join auth.users u on lower(u.email) = lower(m.email)
  where m.id = p_member
    and m.email is not null
    and u.email_confirmed_at is not null
  limit 1;
$$;


-- 3a. Bookings and lessons -----------------------------------------------------
create or replace function public.notify_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_club         uuid;
  v_club_name    text;
  v_club_phone   text;
  v_court        text;
  v_coach        text;
  v_coach_user   uuid;
  v_who          text;
  v_player       uuid;
  v_by_club      boolean;
  v_data         jsonb;
  v_kind         text;
begin
  -- Only changes made by a signed-in person count; the hourly job's own
  -- changes (e.g. marking bookings completed) notify nobody.
  if v_actor is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and not (new.status = 'cancelled' and old.status is distinct from 'cancelled') then
    return null;
  end if;
  if tg_op = 'INSERT' and new.status not in ('confirmed', 'pending') then
    return null;
  end if;

  select k.name, k.club_id into v_court, v_club
    from public.courts k where k.id = new.court_id;
  if new.coach_id is not null then
    select p.full_name, co.profile_id, coalesce(v_club, co.club_id)
      into v_coach, v_coach_user, v_club
      from public.coaches co
      left join public.profiles p on p.id = co.profile_id
      where co.id = new.coach_id;
  end if;
  if v_club is null then
    return null;
  end if;
  select c.name, c.phone into v_club_name, v_club_phone from public.clubs c where c.id = v_club;

  v_who := coalesce(
    (select p.full_name from public.profiles p where p.id = new.player_id),
    (select m.full_name from public.members m where m.id = new.member_id),
    new.walk_in_name
  );
  v_player := coalesce(new.player_id, public.account_of_member(new.member_id));
  v_by_club := public.manages_club(v_club);

  v_data := jsonb_build_object(
    'booking_id', new.id,
    'who', v_who,
    'court', v_court,
    'coach', v_coach,
    'starts_at', new.starts_at,
    'ends_at', new.ends_at,
    'price', new.total_price,
    'weekly', new.series_id is not null,
    'club', v_club_name,
    'club_phone', v_club_phone
  );

  if not v_by_club then
    -- A player did it: tell the club (and the coach, for a lesson).
    v_kind := case
      when tg_op = 'UPDATE' then 'booking_cancelled'
      when new.coach_id is not null then 'lesson_new'
      else 'booking_new'
    end;
    perform public.notify_club(
      v_club, v_kind, v_data,
      case when tg_op = 'UPDATE' then '/admin/bookings' else '/admin/timetable' end
    );
    if v_coach_user is not null then
      perform public.notify(v_coach_user, v_club, v_kind, v_data, '/my-bookings');
    end if;
  elsif v_player is not null then
    -- The club did it for a player: tell the player. A weekly series makes
    -- one notification, not one per week.
    if tg_op = 'INSERT' then
      perform public.notify(
        v_player, v_club, 'club_booked', v_data, '/my-bookings',
        'club_booked:' || coalesce(new.series_id, new.id)::text
      );
    else
      perform public.notify(
        v_player, v_club, 'club_cancelled', v_data, '/my-bookings',
        'club_cancelled:' || coalesce(new.series_id::text || ':' || current_date::text, new.id::text)
      );
    end if;
  end if;
  return null;
exception when others then
  -- A notification must never stop a booking.
  raise warning 'notify_booking: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status on public.bookings
  for each row execute function public.notify_booking();


-- 3b. Tournament sign-ups and the draw -------------------------------------------
create or replace function public.notify_tournament_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_t     record;
  v_count integer;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;
  select t.id, t.name, t.club_id, t.max_entries into v_t
    from public.tournaments t where t.id = v_row.tournament_id;
  if v_t.id is null or public.manages_club(v_t.club_id) then
    return null; -- the club's own changes
  end if;
  select count(*) into v_count from public.tournament_entries e where e.tournament_id = v_t.id;
  perform public.notify_club(
    v_t.club_id,
    case when tg_op = 'DELETE' then 'tournament_left' else 'tournament_joined' end,
    jsonb_build_object(
      'name', v_row.name, 'tournament', v_t.name, 'tournament_id', v_t.id,
      'count', v_count, 'max', v_t.max_entries
    ),
    '/admin/tournaments/' || v_t.id::text
  );
  return null;
exception when others then
  raise warning 'notify_tournament_entry: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists tournament_entries_notify on public.tournament_entries;
create trigger tournament_entries_notify
  after insert or delete on public.tournament_entries
  for each row execute function public.notify_tournament_entry();

create or replace function public.notify_tournament_draw()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not (new.status = 'started' and old.status in ('open', 'closed')) then
    return null;
  end if;
  for r in
    select e.player_id,
           (select o.name
              from public.tournament_matches mt
              join public.tournament_entries o
                on o.id = case when mt.entry1_id = e.id then mt.entry2_id else mt.entry1_id end
             where mt.tournament_id = new.id and mt.round = 1
               and (mt.entry1_id = e.id or mt.entry2_id = e.id)
             limit 1) as opponent
    from public.tournament_entries e
    where e.tournament_id = new.id and e.player_id is not null
  loop
    perform public.notify(
      r.player_id, new.club_id, 'draw',
      jsonb_build_object('tournament', new.name, 'tournament_id', new.id, 'opponent', r.opponent),
      '/tournaments/' || new.id::text
    );
  end loop;
  return null;
exception when others then
  raise warning 'notify_tournament_draw: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists tournaments_notify_draw on public.tournaments;
create trigger tournaments_notify_draw
  after update of status on public.tournaments
  for each row execute function public.notify_tournament_draw();


-- 3c. A staff member accepted the invite ------------------------------------------
create or replace function public.notify_staff_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null then
    perform public.notify_club(
      new.club_id, 'staff_joined', jsonb_build_object('email', new.email),
      '/admin/staff', true
    );
  end if;
  return null;
exception when others then
  raise warning 'notify_staff_joined: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists club_staff_notify on public.club_staff;
create trigger club_staff_notify
  after update of accepted_at on public.club_staff
  for each row execute function public.notify_staff_joined();


-- ----------------------------------------------------------------------------
-- 4. THE DAILY CHECK (called by the hourly job with the secret key)
-- ----------------------------------------------------------------------------
create or replace function public.run_scheduled_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today  date := (now() at time zone 'Europe/Skopje')::date;
  v_hour   integer := extract(hour from now() at time zone 'Europe/Skopje');
  v_before integer;
  v_after  integer;
  r        record;
begin
  select count(*) into v_before from public.notifications;

  -- Reminder about 24 hours before, for bookings made well in advance.
  for r in
    select b.id, coalesce(b.player_id, public.account_of_member(b.member_id)) as user_id,
           coalesce(k.club_id, co.club_id) as club_id, k.name as court,
           pc.full_name as coach, b.starts_at, b.ends_at
    from public.bookings b
    left join public.courts k on k.id = b.court_id
    left join public.coaches co on co.id = b.coach_id
    left join public.profiles pc on pc.id = co.profile_id
    where b.status = 'confirmed'
      and b.starts_at > now()
      and b.starts_at <= now() + interval '24 hours'
      and b.created_at < b.starts_at - interval '3 hours'
  loop
    perform public.notify(
      r.user_id, r.club_id, 'reminder',
      jsonb_build_object('booking_id', r.id, 'court', r.court, 'coach', r.coach,
                         'starts_at', r.starts_at, 'ends_at', r.ends_at),
      '/my-bookings', 'reminder:' || r.id::text
    );
  end loop;

  -- A member's own membership ends within 7 days.
  for r in
    select m.id, m.club_id, m.ends_at::date as ends_on, p.name as plan,
           public.account_of_member(m.id) as user_id
    from public.members m
    left join public.membership_plans p on p.id = m.plan_id
    where m.status = 'active'
      and m.ends_at::date between v_today and v_today + 7
  loop
    perform public.notify(
      r.user_id, r.club_id, 'membership_ending',
      jsonb_build_object('plan', r.plan, 'ends_on', r.ends_on, 'days', r.ends_on - v_today),
      '/membership', 'membership_ending:' || r.id::text || ':' || r.ends_on::text
    );
  end loop;

  -- One summary a day for the club, from 08:00.
  if v_hour >= 8 then
    for r in
      select m.club_id, count(*) as n,
             (array_agg(m.full_name order by m.ends_at, m.full_name))[1:2] as names
      from public.members m
      where m.status = 'active'
        and m.ends_at::date between v_today and v_today + 7
      group by m.club_id
    loop
      perform public.notify_club(
        r.club_id, 'members_ending',
        jsonb_build_object('count', r.n, 'names', to_jsonb(r.names)),
        '/admin/members?tab=ending', false,
        'members_ending:' || r.club_id::text || ':' || v_today::text
      );
    end loop;
  end if;

  -- The free trial ends within 7 days, or ended in the last 3, and isn't paid.
  for r in
    select c.id, c.trial_ends_at
    from public.clubs c
    where c.owner_id is not null
      and c.trial_ends_at > now() - interval '3 days'
      and c.trial_ends_at <= now() + interval '7 days'
      and (c.paid_until is null or c.paid_until < c.trial_ends_at::date)
  loop
    perform public.notify_club(
      r.id,
      case when r.trial_ends_at <= now() then 'trial_ended' else 'trial_ending' end,
      jsonb_build_object('ends_at', r.trial_ends_at,
                         'days', greatest(0, ceil(extract(epoch from r.trial_ends_at - now()) / 86400))::int),
      '/admin/settings', true,
      case when r.trial_ends_at <= now() then 'trial_ended:' else 'trial_ending:' end
        || r.trial_ends_at::date::text
    );
  end loop;

  -- Keep 60 days.
  delete from public.notifications where created_at < now() - interval '60 days';

  select count(*) into v_after from public.notifications;
  return jsonb_build_object('made', greatest(0, v_after - v_before));
end;
$$;


-- None of these are for calling from the app.
revoke execute on function public.notify(uuid, uuid, text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.notify_club(uuid, text, jsonb, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.account_of_member(uuid) from public, anon, authenticated;
revoke execute on function public.run_scheduled_notifications() from public, anon, authenticated;
grant execute on function public.run_scheduled_notifications() to service_role;


-- ----------------------------------------------------------------------------
-- 5. LIVE UPDATES
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
