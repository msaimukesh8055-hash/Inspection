-- supabase/migrations/20261026100000_send_back.sql
-- The inspector can send a return back to the counter for reassessment instead of confirming it.
-- 'sent_back' joins the assessment statuses, and each send-back is kept in reassessments with a copy of
-- what the AI said: re-running assess-return deletes the old assessment, so the copy is the only record
-- of the AI's first answer (the dashboard compares it with the inspector's reason).

alter table public.assessments drop constraint assessments_status_check;
alter table public.assessments add constraint assessments_status_check check (status in (
  'returned', 'assessing', 'billed', 'paid',
  'order_raised', 'at_refurb', 'inspected', 'counter_notified', 'settled', 'sent_back'
));

alter table public.status_events drop constraint status_events_status_check;
alter table public.status_events add constraint status_events_status_check check (status in (
  'returned', 'assessing', 'billed', 'paid',
  'order_raised', 'at_refurb', 'inspected', 'counter_notified', 'settled', 'sent_back'
));

create table public.reassessments (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  reason text not null check (reason in ('missed_damage', 'wrong_part', 'wrong_severity', 'photos_unclear', 'other')),
  note text check (note is null or length(note) <= 300),
  -- The AI's answer when it was sent back: path, total, route reasons, damage items and lines.
  ai_result jsonb not null,
  requested_at timestamptz not null default now(),
  -- Set by assess-return once the return has been assessed again.
  resolved_at timestamptz,
  check (reason <> 'other' or length(trim(coalesce(note, ''))) > 0)
);
-- At most one open send-back per rental.
create unique index reassessments_open_rental_idx on public.reassessments (rental_id) where resolved_at is null;

alter table public.reassessments enable row level security;
create policy "demo read" on public.reassessments for select to anon, authenticated using (true);
