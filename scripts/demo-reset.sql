-- scripts/demo-reset.sql
-- Puts the 3 seeded demo rentals back to "active" with no return photos or assessment,
-- so the demo can run again. Run with: npm run demo:reset
-- Also removes pickups recorded through New pickup (any rental that is not a seeded demo or eval
-- rental) and the vehicles created for them. Keeps the seeded pickup photos and agent_runs (cost
-- history). Storage files are left in place; the next upload to a path overwrites them.
begin;

delete from public.rentals
where id not between '00000000-0000-4000-8000-000000000301' and '00000000-0000-4000-8000-000000000303'
  and id not between '00000000-0000-4000-8000-000000000401' and '00000000-0000-4000-8000-000000000415';

delete from public.vehicles
where id not between '00000000-0000-4000-8000-000000000101' and '00000000-0000-4000-8000-000000000103'
  and not exists (select 1 from public.rentals r where r.vehicle_id = vehicles.id);

delete from public.assessments
where rental_id in (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000303'
);

delete from public.photos
where stage = 'return'
  and rental_id in (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000303'
  );

update public.rentals
set status = 'active', returned_at = null
where id in (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000303'
);

commit;
