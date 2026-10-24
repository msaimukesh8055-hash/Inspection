-- scripts/demo-reset.sql
-- Puts the 3 seeded demo rentals back to "active" with no return photos or assessment,
-- so the demo can run again. Run with: npm run demo:reset
-- Keeps pickup photos and agent_runs (cost history). Storage files are overwritten by the next upload.
begin;

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
