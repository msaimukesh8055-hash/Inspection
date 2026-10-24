-- supabase/migrations/20261024160000_assessment_photo_quality.sql
-- The damage agent reports photo_quality_ok per return; the router (Milestone 5) needs it.
-- Null until the damage step has run.
alter table public.assessments add column photo_quality_ok boolean;
