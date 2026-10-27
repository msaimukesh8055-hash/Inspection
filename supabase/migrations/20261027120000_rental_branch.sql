-- supabase/migrations/20261027120000_rental_branch.sql
-- The Bangalore branch a rental was picked up from, chosen on the New pickup form, so the dashboard can
-- show returns by branch. Nullable: eval rentals and rentals saved before this column have no branch.

alter table public.rentals
  add column branch text check (branch in ('Malleshwaram', 'Indiranagar', 'Bellandur', 'Koramangala', 'HSR Layout', 'Whitefield'));

update public.rentals set branch = 'Bellandur' where id = '00000000-0000-4000-8000-000000000301';
update public.rentals set branch = 'Koramangala' where id = '00000000-0000-4000-8000-000000000302';
update public.rentals set branch = 'Indiranagar' where id = '00000000-0000-4000-8000-000000000303';
