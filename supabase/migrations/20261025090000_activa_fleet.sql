-- supabase/migrations/20261025090000_activa_fleet.sql
-- Data only, no schema change. The demo now uses real photos of a Goa rental Honda Activa
-- (black plate, yellow letters), so the three demo vehicles become an Activa fleet told apart by plate,
-- with an Activa parts list. Demo INR prices, not any real company's rates.

update public.vehicles set model = 'Honda Activa', reg_no = 'GA07M2211', colour = 'Matte Grey'
where id = '00000000-0000-4000-8000-000000000101';
update public.vehicles set model = 'Honda Activa', reg_no = 'GA06T5141', colour = 'Matte Grey'
where id = '00000000-0000-4000-8000-000000000102';
update public.vehicles set model = 'Honda Activa', reg_no = 'GA06T5142', colour = 'Matte Grey'
where id = '00000000-0000-4000-8000-000000000103';

-- A light scratch (polish) stays under the ₹1,500 limit; a dented panel needs a new one and goes over it.
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
