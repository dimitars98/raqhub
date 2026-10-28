-- ============================================================================
-- The people and clubs every database test starts with.
--
--   Riverside (owner: "owner")      Court 1, Court 2 (tennis), Padel 1, Padel 2
--                                   coach "ana"; "mila" is a club member
--   Hillside  (owner: "owner2")     Court A (tennis) — another club, to check
--                                   that clubs can't see each other's data
--   players: bojan, eli, mila, marko, ivana, nikola, sara, petar, stranger
-- ============================================================================

insert into test.users (name, id) values
  ('owner',    '00000000-0000-0000-0000-000000000001'),
  ('owner2',   '00000000-0000-0000-0000-000000000002'),
  ('ana',      '00000000-0000-0000-0000-000000000003'),
  ('bojan',    '00000000-0000-0000-0000-000000000011'),
  ('eli',      '00000000-0000-0000-0000-000000000012'),
  ('mila',     '00000000-0000-0000-0000-000000000013'),
  ('marko',    '00000000-0000-0000-0000-000000000014'),
  ('ivana',    '00000000-0000-0000-0000-000000000015'),
  ('nikola',   '00000000-0000-0000-0000-000000000016'),
  ('sara',     '00000000-0000-0000-0000-000000000017'),
  ('petar',    '00000000-0000-0000-0000-000000000018'),
  ('stranger', '00000000-0000-0000-0000-000000000019');

-- Signing up makes the profile (a trigger), as on Supabase.
insert into auth.users (id, email, raw_user_meta_data)
select id, name || '@test.mk',
  jsonb_build_object('full_name', case name
    when 'owner' then 'Club Owner' when 'owner2' then 'Other Owner' when 'ana' then 'Coach Ana'
    else initcap(name) end)
from test.users;

insert into public.clubs (id, name, slug, owner_id, trial_ends_at) values
  ('10000000-0000-0000-0000-000000000001', 'Riverside', 'riverside', test.uid('owner'),  now() + interval '20 days'),
  ('10000000-0000-0000-0000-000000000002', 'Hillside',  'hillside',  test.uid('owner2'), now() + interval '20 days');

insert into public.courts (id, club_id, name, surface, price_per_hour, sport) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Court 1', 'clay', 16, 'tennis'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Court 2', 'clay', 16, 'tennis'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Padel 1', 'artificial_grass', 20, 'padel'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Padel 2', 'artificial_grass', 20, 'padel'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'Court A', 'hard', 12, 'tennis');

insert into public.coaches (id, profile_id, club_id, price_per_hour, specializations) values
  ('30000000-0000-0000-0000-000000000001', test.uid('ana'), '10000000-0000-0000-0000-000000000001', 30, '{tennis}');

insert into public.members (id, club_id, full_name, email) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Mila M', 'MILA@test.mk');

-- Short names for the ids above.
insert into test.ids (k, v) values
  ('riverside', '10000000-0000-0000-0000-000000000001'),
  ('hillside',  '10000000-0000-0000-0000-000000000002'),
  ('court1',    '20000000-0000-0000-0000-000000000001'),
  ('court2',    '20000000-0000-0000-0000-000000000002'),
  ('padel1',    '20000000-0000-0000-0000-000000000003'),
  ('padel2',    '20000000-0000-0000-0000-000000000004'),
  ('courtA',    '20000000-0000-0000-0000-000000000009'),
  ('coach',     '30000000-0000-0000-0000-000000000001'),
  ('member',    '40000000-0000-0000-0000-000000000001');
