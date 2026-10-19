-- ============================================================================
-- Kortello: lessons hold a court (15 Oct 2026)
--
-- Run once in the Supabase SQL Editor, after 20261014b_no_shows.sql.
-- Wrapped in a transaction: if anything fails, nothing changes.
-- Safe to run a second time.
--
-- Before this, a lesson with a coach had no court, so the same court could be
-- booked by someone else during the lesson.
--
-- What it does
--   1. When a player books a lesson with a coach who belongs to a club, the
--      database gives the lesson one of that club's free courts (courts whose
--      sport is in the coach's specialities first). If every court is taken,
--      the booking is refused. The lesson keeps the COACH's price.
--      Coaches without a club, and clubs with no courts, work as before.
--   2. The coach's taken times now also include times when every court at
--      the coach's club is taken, so the booking form greys them out.
--   3. Upcoming lessons that have no court yet get one, where one is free.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. PLAYER BOOKINGS: lessons get a court
--
-- Same as in 20261012_coaches_hours_member_bookings.sql, except for the
-- lines marked "lesson".
-- ----------------------------------------------------------------------------
create or replace function public.guard_player_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text := coalesce(auth.jwt() ->> 'role', '');
  v_court_id  uuid;
  v_coach_id  uuid;
  v_club_id   uuid;
  v_rate      numeric;
  v_discount  numeric := 0;
  v_hours     jsonb;
  v_day       jsonb;
  v_start     timestamp;
  v_end       timestamp;
  v_specs     text[];   -- lesson: the coach's specialities
  v_free      uuid;     -- lesson: the court it gets
begin
  -- Only requests coming through the API as a signed-in user are checked.
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_court_id := new.court_id;
    v_coach_id := new.coach_id;
  else
    v_court_id := old.court_id;
    v_coach_id := old.coach_id;
  end if;

  -- Owner of the club this court (or, for a lesson, this coach) belongs to.
  if (v_court_id is not null and exists (
        select 1
        from public.courts c
        join public.clubs cl on cl.id = c.club_id
        where c.id = v_court_id and cl.owner_id = v_uid))
     or (v_court_id is null and v_coach_id is not null and exists (
        select 1
        from public.coaches co
        join public.clubs cl on cl.id = co.club_id
        where co.id = v_coach_id and cl.owner_id = v_uid)) then
    return new;
  end if;

  -- ---- Player: UPDATE (only cancelling) -------------------------------------
  if tg_op = 'UPDATE' then
    if new.status = 'cancelled'
       and old.status in ('pending', 'confirmed', 'cancelled') then
      new := old;
      new.status := 'cancelled';
      return new;
    end if;
    raise exception 'Players can only cancel a booking'
      using errcode = '42501';
  end if;

  -- ---- Player: INSERT -------------------------------------------------------
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

  -- lesson: a booking with a coach is priced by the coach, whatever court
  -- was sent; the court is chosen further down.
  if new.coach_id is not null then
    select co.price_per_hour, co.club_id, cl.opening_hours, co.specializations
      into v_rate, v_club_id, v_hours, v_specs
    from public.coaches co
    left join public.clubs cl on cl.id = co.club_id
    where co.id = new.coach_id
      and co.is_active is true;
  else
    select c.price_per_hour, c.club_id, cl.opening_hours
      into v_rate, v_club_id, v_hours
    from public.courts c
    join public.clubs cl on cl.id = c.club_id
    where c.id = new.court_id
      and c.is_active is true
      and cl.is_active is true;
  end if;

  if v_rate is null then
    raise exception 'This court or coach is not available'
      using errcode = '22023';
  end if;

  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);

  -- Opening hours, in the club's local time.
  if v_hours is not null then
    v_start := new.starts_at at time zone 'Europe/Skopje';
    v_end   := new.ends_at   at time zone 'Europe/Skopje';
    v_day   := v_hours -> (extract(isodow from v_start)::int - 1);

    if coalesce((v_day ->> 'open')::boolean, false) is false then
      raise exception 'The club is closed on that day'
        using errcode = '22023';
    end if;

    if v_start::time < (v_day ->> 'from')::time
       or v_end::date <> v_start::date
       or v_end::time > (v_day ->> 'to')::time then
      raise exception 'That time is outside the club''s opening hours'
        using errcode = '22023';
    end if;
  end if;

  -- lesson: take a free court at the coach's club. If two players grab the
  -- last court at the same moment, the court overlap rule stops the second.
  if new.coach_id is not null then
    new.court_id := null;

    if v_club_id is not null and exists (
      select 1 from public.courts c
      where c.club_id = v_club_id and c.is_active is true
    ) then
      select c.id into v_free
      from public.courts c
      where c.club_id = v_club_id
        and c.is_active is true
        and not exists (
          select 1
          from public.bookings b
          where b.court_id = c.id
            and b.status not in ('cancelled', 'no_show')
            and b.starts_at < new.ends_at
            and b.ends_at   > new.starts_at
        )
      order by
        exists (
          select 1 from unnest(coalesce(v_specs, '{}'::text[])) s
          where lower(s) like '%' || c.sport::text || '%'
        ) desc,
        c.name,
        c.id
      limit 1;

      if v_free is null then
        raise exception 'No court is free at that time'
          using errcode = '22023';
      end if;

      new.court_id := v_free;
    end if;
  end if;

  -- Member discount: active membership at THIS club, confirmed email.
  if v_club_id is not null then
    select coalesce(max(mp.discount_pct), 0)
      into v_discount
    from auth.users u
    join public.members m on lower(m.email) = lower(u.email)
    join public.membership_plans mp on mp.id = m.plan_id
    where u.id = v_uid
      and u.email_confirmed_at is not null
      and m.club_id = v_club_id
      and m.status = 'active';
  end if;

  v_discount := least(greatest(coalesce(v_discount, 0), 0), 100);

  new.total_price := round(v_rate * new.duration_min / 60.0 * (1 - v_discount / 100.0), 2);
  new.status      := 'confirmed';
  new.member_id   := null;
  new.walk_in_name := null;
  new.checked_in_at := null;
  new.stripe_payment_intent_id := null;

  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. TAKEN TIMES FOR THE LESSON FORM
--
-- The coach's own bookings, plus every half hour of the day when all of the
-- club's courts are taken. Times only, nothing about who booked.
-- ----------------------------------------------------------------------------
create or replace function public.get_coach_busy_slots(p_coach_id uuid, p_day date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (p_day::timestamp at time zone 'Europe/Skopje')       as day_start,
           ((p_day + 1)::timestamp at time zone 'Europe/Skopje') as day_end
  ),
  club_courts as (
    select c.id
    from public.courts c
    join public.coaches co on co.club_id = c.club_id
    where co.id = p_coach_id
      and c.is_active is true
  ),
  blocks as (
    select g as block_start, g + interval '30 minutes' as block_end
    from bounds,
         generate_series(bounds.day_start, bounds.day_end - interval '30 minutes',
                         interval '30 minutes') g
  )
  select b.starts_at, b.ends_at
  from public.bookings b, bounds
  where b.coach_id = p_coach_id
    and b.status not in ('cancelled', 'no_show')
    and b.starts_at < bounds.day_end
    and b.ends_at   > bounds.day_start

  union all

  select bl.block_start, bl.block_end
  from blocks bl
  where exists (select 1 from club_courts)
    and not exists (
      select 1
      from club_courts cc
      where not exists (
        select 1
        from public.bookings b
        where b.court_id = cc.id
          and b.status not in ('cancelled', 'no_show')
          and b.starts_at < bl.block_end
          and b.ends_at   > bl.block_start
      )
    );
$$;


-- ----------------------------------------------------------------------------
-- 3. UPCOMING LESSONS WITHOUT A COURT
--
-- Each one gets a free court at its coach's club. A lesson with no free court
-- is left as it is and listed in the output, so you can sort it out with the
-- club.
-- ----------------------------------------------------------------------------
do $$
declare
  r      record;
  v_free uuid;
begin
  for r in
    select b.id, b.starts_at, b.ends_at, co.club_id, co.specializations
    from public.bookings b
    join public.coaches co on co.id = b.coach_id
    where b.court_id is null
      and co.club_id is not null
      and exists (select 1 from public.courts c
                  where c.club_id = co.club_id and c.is_active is true)
      and b.status in ('confirmed', 'pending')
      and b.ends_at > now()
    order by b.starts_at
  loop
    v_free := null;
    select c.id into v_free
    from public.courts c
    where c.club_id = r.club_id
      and c.is_active is true
      and not exists (
        select 1 from public.bookings b
        where b.court_id = c.id
          and b.status not in ('cancelled', 'no_show')
          and b.starts_at < r.ends_at
          and b.ends_at   > r.starts_at
      )
    order by
      exists (
        select 1 from unnest(coalesce(r.specializations, '{}'::text[])) s
        where lower(s) like '%' || c.sport::text || '%'
      ) desc,
      c.name,
      c.id
    limit 1;

    if v_free is null then
      raise notice 'No free court for lesson % at %', r.id, r.starts_at;
    else
      update public.bookings set court_id = v_free where id = r.id;
    end if;
  end loop;
end;
$$;

commit;
