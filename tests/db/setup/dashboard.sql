-- ============================================================================
-- Tables and columns the live database got from the Supabase dashboard
-- before the migrations folder existed. supabase/schema.sql doesn't have
-- them, so they're added here, between schema.sql and the migrations.
-- ============================================================================

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null default 0,
  billing_period text not null default 'monthly',
  discount_pct numeric,
  created_at timestamptz default now()
);
create table public.members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  plan_id uuid references public.membership_plans(id),
  status text not null default 'active',
  starts_at date not null default current_date,
  ends_at date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.courts add column sport text not null default 'tennis';
alter table public.clubs add column opening_hours jsonb;
alter table public.bookings
  add column member_id uuid references public.members(id),
  add column locale text,
  add column walk_in_name text;
alter table public.bookings alter column player_id drop not null;
grant all on all tables in schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Row-level security made in the dashboard (not in any migration).
-- RECONSTRUCTED: compare with the live database (README > Tests) and keep
-- this in step with it.
-- ----------------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.membership_plans enable row level security;

create policy dash_members_owner on public.members for all
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));
create policy dash_plans_owner on public.membership_plans for all
  using (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.clubs c where c.id = club_id and c.owner_id = auth.uid()));

create policy dash_bookings_owner_select on public.bookings for select
  using (exists (select 1 from public.courts k join public.clubs c on c.id = k.club_id
                 where k.id = court_id and c.owner_id = auth.uid()));
create policy dash_bookings_owner_insert on public.bookings for insert
  with check (exists (select 1 from public.courts k join public.clubs c on c.id = k.club_id
                      where k.id = court_id and c.owner_id = auth.uid()));
create policy dash_bookings_owner_update on public.bookings for update
  using (exists (select 1 from public.courts k join public.clubs c on c.id = k.club_id
                 where k.id = court_id and c.owner_id = auth.uid()));

-- No two active bookings on one court at the same time (the newer of the two
-- dashboard rules that 20261011_rls_hardening.sql mentions).
alter table public.bookings add constraint bookings_no_court_overlap
  exclude using gist (court_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status <> all (array['cancelled', 'no_show']));
