-- ============================================================
-- Make photos bucket public for permanent image URLs
--
-- Photos are embedded in publicly deployed websites. Signed URLs
-- expire after 1 hour, breaking images on live sites. Making the
-- bucket public lets us use permanent getPublicUrl() links with
-- Supabase Image Transforms (resize, quality, WebP auto-convert).
--
-- Upload/delete policies remain scoped to authenticated users
-- and their own user_id prefix (SEC-013 unchanged).
-- ============================================================

-- 1. Set the bucket to public
update storage.buckets
  set public = true
  where id = 'photos';

-- 2. Add a public SELECT policy so anyone can read photos
--    (existing authenticated-only SELECT policy is kept for
--     dashboard previews; this adds anonymous/public access)
create policy "public_read_photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'photos');
