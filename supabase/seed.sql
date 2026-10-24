-- supabase/seed.sql
-- Demo seed data. Fake riders, made-up registration numbers, and demo INR prices
-- (not any real company's rates). Fixed IDs so the demo and evals can refer to them.
-- Safe to re-run: every insert skips rows that already exist.

insert into public.vehicles (id, model, reg_no, colour) values
  ('00000000-0000-4000-8000-000000000101', 'TVS Jupiter', 'KA01DM0101', 'Starlight Blue'),
  ('00000000-0000-4000-8000-000000000102', 'TVS Radeon',  'KA01DM0102', 'Titanium Grey'),
  ('00000000-0000-4000-8000-000000000103', 'TVS Ntorq',   'KA01DM0103', 'Racing Red')
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
insert into public.parts_catalog (part_code, vehicle_model, description, parts_inr, labour_inr) values
  ('JUP-SCRATCH-POLISH',  'TVS Jupiter', 'Scratch polish and touch-up, one panel',   150, 350),
  ('JUP-FRONT-PANEL',     'TVS Jupiter', 'Front apron panel',                       1450, 400),
  ('JUP-SIDE-PANEL-L',    'TVS Jupiter', 'Left side body panel',                    1200, 350),
  ('JUP-SIDE-PANEL-R',    'TVS Jupiter', 'Right side body panel',                   1200, 350),
  ('JUP-FRONT-MUDGUARD',  'TVS Jupiter', 'Front mudguard',                           650, 200),
  ('JUP-MIRROR',          'TVS Jupiter', 'Rear-view mirror, one side',               280,  80),
  ('JUP-INDICATOR',       'TVS Jupiter', 'Turn indicator assembly, one side',        220, 100),
  ('RAD-SCRATCH-POLISH',  'TVS Radeon',  'Scratch polish and touch-up, one panel',   150, 350),
  ('RAD-FUEL-TANK',       'TVS Radeon',  'Fuel tank (dent beyond repair)',          3200, 600),
  ('RAD-SIDE-COVER-L',    'TVS Radeon',  'Left side cover',                          480, 150),
  ('RAD-SIDE-COVER-R',    'TVS Radeon',  'Right side cover',                         480, 150),
  ('RAD-FRONT-MUDGUARD',  'TVS Radeon',  'Front mudguard',                           550, 200),
  ('RAD-HEADLAMP',        'TVS Radeon',  'Headlamp assembly',                       1350, 250),
  ('RAD-MIRROR',          'TVS Radeon',  'Rear-view mirror, one side',               250,  80),
  ('NTQ-SCRATCH-POLISH',  'TVS Ntorq',   'Scratch polish and touch-up, one panel',   180, 400),
  ('NTQ-FRONT-PANEL',     'TVS Ntorq',   'Front panel',                             1650, 450),
  ('NTQ-SIDE-PANEL-L',    'TVS Ntorq',   'Left side body panel',                    1400, 400),
  ('NTQ-SIDE-PANEL-R',    'TVS Ntorq',   'Right side body panel',                   1400, 400),
  ('NTQ-TAIL-LAMP',       'TVS Ntorq',   'Tail lamp assembly',                       950, 200),
  ('NTQ-MIRROR',          'TVS Ntorq',   'Rear-view mirror, one side',               320,  80),
  ('NTQ-INDICATOR',       'TVS Ntorq',   'Turn indicator assembly, one side',        260, 100)
on conflict (part_code) do nothing;

insert into public.config (key, value) values
  ('threshold_inr', '1500'),
  ('min_confidence', '0.75')
on conflict (key) do nothing;
