-- supabase/migrations/20261027150000_goa_branches.sql
-- The demo fleet carries Goa plates (GA 07), so the branches move from Bangalore to Goa. Each old branch
-- maps to one new branch, so existing rentals keep their place in the dashboard's chart.

alter table public.rentals drop constraint rentals_branch_check;

update public.rentals set branch = case branch
  when 'Malleshwaram' then 'Ponda'
  when 'Indiranagar' then 'Mapusa'
  when 'Bellandur' then 'Panaji'
  when 'Koramangala' then 'Calangute'
  when 'HSR Layout' then 'Margao'
  when 'Whitefield' then 'Vasco da Gama'
  else branch
end
where branch is not null;

alter table public.rentals
  add constraint rentals_branch_check check (branch in ('Ponda', 'Mapusa', 'Panaji', 'Calangute', 'Margao', 'Vasco da Gama'));
