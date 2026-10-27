-- scripts/demo-reset.sql
-- Puts the seeded demo rentals back to their starting state so the demo can run again:
-- GA07M2211 (Asha) and GA07M2213 (Meera) active with no return; GA07M2212 (Vikram) returned and
-- sent back by the inspector, so the "Sent back by the inspector" section always has one entry.
-- Run with: npm run demo:reset (which also uploads Vikram's four return photos, see
-- scripts/demo-return-photos.ts; SQL cannot upload files).
-- Also removes pickups recorded through New pickup (any rental that is not a seeded demo, eval or
-- sample-history rental) and the vehicles created for them. The sample history (npm run history:seed)
-- is left alone. Keeps the seeded pickup photos and agent_runs (cost
-- history). Storage files are left in place; the next upload to a path overwrites them.
begin;

delete from public.rentals
where id not between '00000000-0000-4000-8000-000000000301' and '00000000-0000-4000-8000-000000000303'
  and id not between '00000000-0000-4000-8000-000000000401' and '00000000-0000-4000-8000-000000000415'
  and id not between '00000000-0000-4000-8000-000000000601' and '00000000-0000-4000-8000-000000000699';

delete from public.vehicles
where id not between '00000000-0000-4000-8000-000000000101' and '00000000-0000-4000-8000-000000000103'
  and id not between '00000000-0000-4000-8000-000000000111' and '00000000-0000-4000-8000-000000000114'
  and not exists (select 1 from public.rentals r where r.vehicle_id = vehicles.id);

delete from public.reassessments
where rental_id in (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000303'
);

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

-- Vikram's return, sent back by the inspector. The AI's first answer priced the scratch as a new panel
-- (₹1,850, Path B); the inspector sent it back. Reassessing it should give the ₹500 polish on Path A.
update public.rentals set status = 'returned', returned_at = now() - interval '25 minutes'
where id = '00000000-0000-4000-8000-000000000302';

insert into public.assessments (id, rental_id, path, route_reasons, total_inr, status, photo_quality_ok, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000751', '00000000-0000-4000-8000-000000000302', 'B', '{amount_over_threshold}', 1850, 'sent_back', true,
   now() - interval '24 minutes', now() - interval '10 minutes');

insert into public.status_events (assessment_id, status, at) values
  ('00000000-0000-4000-8000-000000000751', 'returned', now() - interval '24 minutes'),
  ('00000000-0000-4000-8000-000000000751', 'assessing', now() - interval '24 minutes'),
  ('00000000-0000-4000-8000-000000000751', 'order_raised', now() - interval '23 minutes'),
  ('00000000-0000-4000-8000-000000000751', 'at_refurb', now() - interval '23 minutes'),
  ('00000000-0000-4000-8000-000000000751', 'sent_back', now() - interval '10 minutes');

insert into public.diagnostic_orders (id, assessment_id, status, summary, priority, route_reasons, provisional_total_inr, held_inr, created_at) values
  ('00000000-0000-4000-8000-000000000a51', '00000000-0000-4000-8000-000000000751', 'closed',
   'Damage on the left side panel; estimate above the counter limit.', 'normal', '{amount_over_threshold}', 1850, 1850, now() - interval '23 minutes');

insert into public.reassessments (id, rental_id, reason, note, ai_result, requested_at) values
  ('00000000-0000-4000-8000-000000000b51', '00000000-0000-4000-8000-000000000302', 'wrong_part',
   'Scratch priced as a new panel; check the left side panel again.',
   '{"path": "B", "total_inr": 1850, "route_reasons": ["amount_over_threshold"], "items": [{"panel": "left side panel", "type": "scratch", "severity": 1, "confidence": 0.9, "photo_ref": "left"}], "lines": [{"part_code": "ACT-SIDE-PANEL-L", "source": "ai", "total_inr": 1850, "final_inr": null}]}',
   now() - interval '10 minutes');

insert into public.notifications (recipient_role, assessment_id, message, created_at) values
  ('counter', '00000000-0000-4000-8000-000000000751',
   'Honda Activa GA07M2212 sent back by the inspector: Wrong part — Scratch priced as a new panel; check the left side panel again.',
   now() - interval '10 minutes');

commit;
