-- ============================================
-- ServeTime — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  full_name    text,
  avatar_url   text,
  phone        text,
  role         text not null default 'player' check (role in ('player', 'coach', 'club_admin', 'super_admin')),
  stripe_customer_id text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================
-- CLUBS
-- ============================================
create table public.clubs (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  slug         text not null unique,
  description  text,
  address      text,
  city         text,
  country      text default 'MK',
  lat          numeric(9,6),
  lng          numeric(9,6),
  phone        text,
  email        text,
  website      text,
  logo_url     text,
  cover_url    text,
  is_active    boolean default true,
  owner_id     uuid references public.profiles(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================
-- COURTS
-- ============================================
create table public.courts (
  id           uuid primary key default uuid_generate_v4(),
  club_id      uuid references public.clubs(id) on delete cascade not null,
  name         text not null,
  surface      text not null check (surface in ('clay', 'hard', 'grass', 'artificial_grass', 'carpet')),
  is_indoor    boolean default false,
  is_active    boolean default true,
  price_per_hour numeric(8,2) not null,
  description  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================
-- COACHES
-- ============================================
create table public.coaches (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid references public.profiles(id) on delete cascade not null,
  club_id         uuid references public.clubs(id),
  bio             text,
  specializations text[] default '{}',
  levels          text[] default '{}' check (levels <@ array['beginner','intermediate','advanced','junior','adult']),
  price_per_hour  numeric(8,2) not null,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================
-- BOOKINGS
-- ============================================
create table public.bookings (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.profiles(id) not null,
  court_id        uuid references public.courts(id),
  coach_id        uuid references public.coaches(id),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  duration_min    integer not null default 60,
  status          text not null default 'confirmed'
                    check (status in ('pending','confirmed','cancelled','completed','no_show')),
  total_price     numeric(8,2) not null,
  notes           text,
  reference       text unique not null default ('SCT-' || upper(substr(md5(random()::text), 1, 6))),
  stripe_payment_intent_id text,
  checked_in_at   timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  -- Must have at least a court or coach
  constraint booking_has_target check (court_id is not null or coach_id is not null),
  -- End must be after start
  constraint booking_time_valid check (ends_at > starts_at)
);

-- ============================================
-- AVAILABILITY (coach/court blocks)
-- ============================================
create table public.availability (
  id          uuid primary key default uuid_generate_v4(),
  court_id    uuid references public.courts(id) on delete cascade,
  coach_id    uuid references public.coaches(id) on delete cascade,
  day_of_week integer check (day_of_week between 0 and 6), -- 0=Sun
  start_time  time not null,
  end_time    time not null,
  is_active   boolean default true,
  constraint availability_has_owner check (court_id is not null or coach_id is not null)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles   enable row level security;
alter table public.clubs      enable row level security;
alter table public.courts     enable row level security;
alter table public.coaches    enable row level security;
alter table public.bookings   enable row level security;
alter table public.availability enable row level security;

-- Profiles: users can read all, edit only their own
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Clubs: public read, club admins can edit their club
create policy "clubs_select_all" on public.clubs for select using (is_active = true);
create policy "clubs_update_owner" on public.clubs for update using (auth.uid() = owner_id);

-- Courts: public read active courts, club owner can manage
create policy "courts_select_all" on public.courts for select using (is_active = true);
create policy "courts_manage_club_owner" on public.courts for all
  using (exists (
    select 1 from public.clubs where clubs.id = courts.club_id and clubs.owner_id = auth.uid()
  ));

-- Coaches: public read active coaches
create policy "coaches_select_all" on public.coaches for select using (is_active = true);
create policy "coaches_update_own" on public.coaches for update using (profile_id = auth.uid());

-- Bookings: players see their own, club admins see their club's bookings
create policy "bookings_select_own" on public.bookings for select using (player_id = auth.uid());
create policy "bookings_insert_own" on public.bookings for insert with check (player_id = auth.uid());
create policy "bookings_update_own" on public.bookings for update using (player_id = auth.uid());

-- Availability: public read
create policy "availability_select_all" on public.availability for select using (true);

-- ============================================
-- TRIGGERS — updated_at
-- ============================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at   before update on public.profiles   for each row execute function handle_updated_at();
create trigger trg_clubs_updated_at      before update on public.clubs      for each row execute function handle_updated_at();
create trigger trg_courts_updated_at     before update on public.courts     for each row execute function handle_updated_at();
create trigger trg_coaches_updated_at    before update on public.coaches    for each row execute function handle_updated_at();
create trigger trg_bookings_updated_at   before update on public.bookings   for each row execute function handle_updated_at();

-- ============================================
-- TRIGGER — auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- SEED DATA (optional — remove in production)
-- ============================================
-- Insert a demo club after you've signed up and have a user ID:
-- insert into public.clubs (name, slug, city, owner_id) values ('City Tennis Club', 'city-tc', 'Skopje', '<your-user-id>');
