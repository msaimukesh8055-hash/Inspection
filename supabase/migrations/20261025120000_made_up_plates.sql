-- supabase/migrations/20261025120000_made_up_plates.sql
-- Data only, no schema change. Fleet1 carried the photographed scooter's real plate, so all three demo
-- vehicles get made-up plates that match the redacted photos.

update public.vehicles set reg_no = 'GA07M2211' where id = '00000000-0000-4000-8000-000000000101';
update public.vehicles set reg_no = 'GA07M2212' where id = '00000000-0000-4000-8000-000000000102';
update public.vehicles set reg_no = 'GA07M2213' where id = '00000000-0000-4000-8000-000000000103';
