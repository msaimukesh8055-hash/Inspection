-- supabase/migrations/20261026120000_line_item_angle.sql
-- Which side of the scooter a repair line is for, so the dashboard can show damage by side.
-- AI lines take it from their damage item's photo; parts the inspector adds get it from a side picker.
-- Nullable: lines saved before this column have no side.

alter table public.line_items
  add column angle text check (angle in ('front', 'rear', 'left', 'right'));

update public.line_items l
set angle = d.photo_ref
from public.damage_items d
where l.damage_item_id = d.id and d.photo_ref in ('front', 'rear', 'left', 'right');
