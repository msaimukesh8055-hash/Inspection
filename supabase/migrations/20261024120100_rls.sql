-- supabase/migrations/20261024120100_rls.sql
-- Row-level security. The demo has no login, so the app runs as the anon role.
-- The app may read what the screens show, add photo rows and mark notifications read.
-- Every other write goes through Edge Functions using the service role, which bypasses RLS.

alter table public.vehicles enable row level security;
alter table public.riders enable row level security;
alter table public.rentals enable row level security;
alter table public.photos enable row level security;
alter table public.parts_catalog enable row level security;
alter table public.assessments enable row level security;
alter table public.damage_items enable row level security;
alter table public.line_items enable row level security;
alter table public.diagnostic_orders enable row level security;
alter table public.status_events enable row level security;
alter table public.overrides enable row level security;
alter table public.agent_runs enable row level security;
alter table public.config enable row level security;
alter table public.notifications enable row level security;

-- Read access for the screens. agent_runs has no policy: cost data is read server-side only.
create policy "demo read" on public.vehicles for select to anon, authenticated using (true);
create policy "demo read" on public.riders for select to anon, authenticated using (true);
create policy "demo read" on public.rentals for select to anon, authenticated using (true);
create policy "demo read" on public.photos for select to anon, authenticated using (true);
create policy "demo read" on public.parts_catalog for select to anon, authenticated using (true);
create policy "demo read" on public.assessments for select to anon, authenticated using (true);
create policy "demo read" on public.damage_items for select to anon, authenticated using (true);
create policy "demo read" on public.line_items for select to anon, authenticated using (true);
create policy "demo read" on public.diagnostic_orders for select to anon, authenticated using (true);
create policy "demo read" on public.status_events for select to anon, authenticated using (true);
create policy "demo read" on public.overrides for select to anon, authenticated using (true);
create policy "demo read" on public.config for select to anon, authenticated using (true);
create policy "demo read" on public.notifications for select to anon, authenticated using (true);

-- Return capture adds photo rows and may retake an angle (same row, same path).
create policy "demo capture insert" on public.photos for insert to anon, authenticated with check (true);
create policy "demo capture update" on public.photos for update to anon, authenticated using (true) with check (true);

-- Opening a notification sets read_at. Column grants stop the app changing anything else.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to anon, authenticated;
create policy "demo mark read" on public.notifications for update to anon, authenticated using (true) with check (true);
