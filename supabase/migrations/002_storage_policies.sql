-- ============================================================
-- Storage Policies for photos bucket
-- SEC-013: Restrict storage access to user-scoped paths
-- ============================================================

-- 1. Create the photos bucket (private, not public)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- 2. INSERT policy: users can only upload to photos/{their_user_id}/ prefix
create policy "users_upload_own_photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 3. SELECT policy: users can only read files under photos/{their_user_id}/ prefix
create policy "users_read_own_photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 4. DELETE policy: users can only delete files under photos/{their_user_id}/ prefix
create policy "users_delete_own_photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
