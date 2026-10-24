-- supabase/migrations/20261024181000_line_item_reasoning.sql
-- The estimate agent returns a one-line reason per part choice (docs/SPEC.md); keep it with the line.
alter table public.line_items add column reasoning text;
