-- supabase/migrations/20261024120200_storage_realtime.sql
-- Private photo bucket and Realtime for the counter notification badge and rider timeline.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- The app uploads and reads (via signed URLs) only inside vehicle-photos. No deletes.
create policy "vehicle-photos read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'vehicle-photos');
create policy "vehicle-photos upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'vehicle-photos');
create policy "vehicle-photos retake" on storage.objects
  for update to anon, authenticated using (bucket_id = 'vehicle-photos') with check (bucket_id = 'vehicle-photos');

alter publication supabase_realtime add table public.notifications, public.status_events;
