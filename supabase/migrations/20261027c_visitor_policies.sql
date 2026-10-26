-- ============================================================================
-- Kortello: let visitors read courts again (27 Oct 2026)
--
-- Run once in the Supabase SQL Editor. Safe to run a second time.
--
-- Since 20261023_clubs_public_columns.sql, visitors who aren't signed in may
-- not read clubs.owner_id. But some "the club owner can manage this" rules
-- (e.g. courts_manage_club_owner) look at clubs.owner_id and were set for
-- everyone, visitors included. Postgres checks every rule on a table, so a
-- visitor reading courts hit "permission denied for table clubs" and the
-- club's public page showed no courts.
--
-- Those owner rules only ever matter to a signed-in owner, so they now apply
-- to signed-in users only. Nothing changes for anyone signed in.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select p.schemaname, p.tablename, p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and 'public' = any (p.roles)
      and (coalesce(p.qual, '') ilike '%owner_id%' or coalesce(p.with_check, '') ilike '%owner_id%')
  loop
    execute format('alter policy %I on %I.%I to authenticated', r.policyname, r.schemaname, r.tablename);
    raise notice 'now for signed-in users only: %.%', r.tablename, r.policyname;
  end loop;
end;
$$;
