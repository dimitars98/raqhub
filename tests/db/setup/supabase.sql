-- ============================================================================
-- A stand-in for what Supabase adds to every project, so the database can be
-- built on a plain Postgres for the tests: the anon / authenticated /
-- service_role roles, auth.users and auth.uid(), storage, and a do-nothing
-- pg_cron.
--
-- The tests "log in" by setting the same request settings Supabase sets
-- from a user's token (see test.login in ../helpers.sql).
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz default now(),
  raw_user_meta_data jsonb default '{}',
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'role', nullif(current_setting('request.jwt.claim.role', true), ''),
    'sub', nullif(current_setting('request.jwt.claim.sub', true), '')) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema storage;
create table storage.objects (id uuid, bucket_id text, name text, owner uuid);
create table storage.buckets (id text primary key, name text, public boolean);
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- pg_cron only exists on Supabase: scheduling a job does nothing here.
create schema cron;
create function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(text) returns boolean language sql as $$ select true $$;
create table cron.job (jobname text);
