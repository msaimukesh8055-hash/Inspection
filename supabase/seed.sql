-- supabase/seed.sql
-- Demo seed data. Fake riders, a demo Honda Activa fleet (plates match the sample photos), and demo INR prices
-- (not any real company's rates). Fixed IDs so the demo and evals can refer to them.
-- Safe to re-run: every insert skips rows that already exist.

insert into public.vehicles (id, model, reg_no, colour) values
  ('00000000-0000-4000-8000-000000000101', 'Honda Activa', 'GA07M2211', 'Matte Grey'),
  ('00000000-0000-4000-8000-000000000102', 'Honda Activa', 'GA06T5141', 'Matte Grey'),
  ('00000000-0000-4000-8000-000000000103', 'Honda Activa', 'GA06T5142', 'Matte Grey')
on conflict (id) do nothing;

insert into public.riders (id, name, phone) values
  ('00000000-0000-4000-8000-000000000201', 'Demo Rider Asha',  '+91 90000 00001'),
  ('00000000-0000-4000-8000-000000000202', 'Demo Rider Vikram', '+91 90000 00002'),
  ('00000000-0000-4000-8000-000000000203', 'Demo Rider Meera', '+91 90000 00003')
on conflict (id) do nothing;

-- One active rental per vehicle, picked up a few hours ago. deposit_inr defaults to 2000.
insert into public.rentals (id, vehicle_id, rider_id, status, picked_up_at) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000201', 'active', now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000102',
   '00000000-0000-4000-8000-000000000202', 'active', now() - interval '4 hours'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000103',
   '00000000-0000-4000-8000-000000000203', 'active', now() - interval '2 hours')
on conflict (id) do nothing;

-- Parts and labour. A light scratch (polish) stays under the ₹1,500 threshold; panel replacements go over it.
-- (The Activa rows also come from migration 20261025090000_activa_fleet.sql; both skip existing codes.)
insert into public.parts_catalog (part_code, vehicle_model, description, parts_inr, labour_inr) values
  ('ACT-SCRATCH-POLISH', 'Honda Activa', 'Scratch polish and touch-up, one panel',  150, 350),
  ('ACT-FRONT-PANEL',    'Honda Activa', 'Front apron panel',                      1450, 400),
  ('ACT-SIDE-PANEL-L',   'Honda Activa', 'Left rear side panel',                   1450, 400),
  ('ACT-SIDE-PANEL-R',   'Honda Activa', 'Right rear side panel',                  1450, 400),
  ('ACT-FRONT-MUDGUARD', 'Honda Activa', 'Front mudguard',                          650, 200),
  ('ACT-HEADLAMP',       'Honda Activa', 'Headlamp assembly',                      1350, 250),
  ('ACT-TAIL-LAMP',      'Honda Activa', 'Tail lamp assembly',                      950, 200),
  ('ACT-MIRROR',         'Honda Activa', 'Rear-view mirror, one side',              280,  80),
  ('ACT-INDICATOR',      'Honda Activa', 'Turn indicator assembly, one side',       220, 100)
on conflict (part_code) do nothing;

insert into public.config (key, value) values
  ('threshold_inr', '1500'),
  ('min_confidence', '0.75')
on conflict (key) do nothing;
