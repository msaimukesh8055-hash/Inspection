-- supabase/migrations/20261025150000_reset_eval_rental.sql
-- Lets the eval runner (anon key, also in CI) clear its own test data before each case. Re-running
-- assess-return is refused once a return is billed or with the inspector, so an eval Path B case could
-- otherwise never run twice. Only the 15 hidden eval rentals (…401 to …415) can be reset; any other
-- id is ignored. Deleting the assessment cascades to its items, lines, order and notices; agent_runs
-- rows stay (their assessment_id is set to null) so cost history is kept.

create or replace function public.reset_eval_rental(p_rental_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.assessments
  where rental_id = p_rental_id
    and p_rental_id between '00000000-0000-4000-8000-000000000401' and '00000000-0000-4000-8000-000000000415';
$$;

revoke all on function public.reset_eval_rental(uuid) from public;
grant execute on function public.reset_eval_rental(uuid) to anon, authenticated;
