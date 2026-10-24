-- supabase/migrations/20261024180000_assessment_rider_message.sql
-- The order agent writes rider-facing text: the bill note (Path A) or the provisional-amount
-- message (Path B). The schema had nowhere to keep it.
alter table public.assessments add column rider_message text;
