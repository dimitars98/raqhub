-- ============================================================================
-- A tiny test kit for the database tests (loaded once, before seed.sql).
--
--   select test.login('bojan');      act as that player (as the app would)
--   select test.login_anon();        act as someone not signed in
--   select test.login_service();     act as the server (service role key)
--
--   select test.ok(<true or false>, 'what it checks');
--   select test.is(<got>, <expected>, 'what it checks');
--   select test.fails($$<sql>$$, 'what it checks' [, 'expected error text']);
--   select test.blocked($$<sql>$$, 'what it checks');   error OR no rows touched
--   select test.try($$<sql>$$);   run it, ignoring any error; then check the
--                                 data didn't change (some guards quietly
--                                 keep the old value instead of failing)
--
--   with b as (insert ... returning id) select test.keep('booking', id) from b;
--   test.id('booking')       the id kept earlier
--   test.uid('bojan')  the user id of a seeded person
--
-- Every passing check prints "ok - ...". The first failing check stops the
-- file with "not ok - ...", which the runner (run.sh) reports.
-- ============================================================================

create schema test;
grant usage on schema test to anon, authenticated, service_role;

-- People in seed.sql, by short name.
create table test.users (name text primary key, id uuid not null);
-- Ids a test file wants to remember between statements.
create table test.ids (k text primary key, v uuid);
grant all on test.users, test.ids to anon, authenticated, service_role;

create function test.uid(p_name text) returns uuid language plpgsql stable as $$
declare v uuid;
begin
  select id into v from test.users where name = p_name;
  if v is null then raise exception 'test.uid: nobody called %', p_name; end if;
  return v;
end $$;

create function test.keep(p_k text, p_v uuid) returns uuid language sql as $$
  insert into test.ids values (p_k, p_v) on conflict (k) do update set v = excluded.v returning v $$;

create function test.id(p_k text) returns uuid language plpgsql stable as $$
declare v uuid;
begin
  select ids.v into v from test.ids where k = p_k;
  if v is null then raise exception 'test.id: nothing kept as %', p_k; end if;
  return v;
end $$;

-- Switching who we are. RESET ROLE first: only the session's own user may
-- change roles, and it's a superuser, so this works from any role.
create function test.login(p_name text) returns void language plpgsql as $$
begin
  perform test.login_id(test.uid(p_name));
end $$;

create function test.login_id(v uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', v::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  set role authenticated;
end $$;

create function test.login_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  set role anon;
end $$;

create function test.login_service() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
  set role service_role;
end $$;

-- Back to the superuser, to look at everything (e.g. after an action).
create function test.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
end $$;

-- Checks
create function test.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'not ok - %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end $$;

create function test.is(p_got anyelement, p_want anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'not ok - % (got %, expected %)', p_label, coalesce(p_got::text, 'null'), coalesce(p_want::text, 'null');
  end if;
  raise notice 'ok - %', p_label;
end $$;

-- The statement must raise an error (optionally one containing p_error).
create function test.fails(p_sql text, p_label text, p_error text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_error is not null and position(lower(p_error) in lower(sqlerrm)) = 0 then
      raise exception 'not ok - % (failed, but with "%", expected "%")', p_label, sqlerrm, p_error;
    end if;
    raise notice 'ok - %', p_label;
    return;
  end;
  raise exception 'not ok - % (it worked, but should have failed)', p_label;
end $$;

-- The statement must not change or show anything: an error, or 0 rows.
-- (Row-level security often doesn't raise an error: the rows just aren't there.)
create function test.blocked(p_sql text, p_label text) returns void language plpgsql as $$
declare n integer;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    raise notice 'ok - % (refused: %)', p_label, left(sqlerrm, 60);
    return;
  end;
  if n > 0 then
    raise exception 'not ok - % (% row(s) affected, expected none)', p_label, n;
  end if;
  raise notice 'ok - %', p_label;
end $$;

-- Runs a statement and ignores any error.
create function test.try(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end $$;

-- The statement must work and touch at least one row.
create function test.allowed(p_sql text, p_label text) returns void language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'not ok - % (no rows affected)', p_label;
  end if;
  raise notice 'ok - %', p_label;
exception when others then
  if sqlerrm like 'not ok - %' then raise; end if;
  raise exception 'not ok - % (error: %)', p_label, sqlerrm;
end $$;

-- How many rows a query returns, as the current user.
create function test.count(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n;
end $$;

-- Tomorrow (or N days ahead) at a club time, e.g. test.at('19:00').
create function test.at(p_time text, p_days integer default 1) returns timestamptz language sql stable as $$
  select ((current_date + p_days)::timestamp + p_time::time) at time zone 'Europe/Skopje' $$;

grant execute on all functions in schema test to anon, authenticated, service_role;
