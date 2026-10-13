-- Private user media (chat Library + memory videos/photos).
-- Access is enforced by backend service-role APIs (path prefix = user_id).
-- RLS below is defense-in-depth if a user JWT hits Storage directly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media',
  false,
  16777216,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/octet-stream', 'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Users read own user-media" ON storage.objects;
CREATE POLICY "Users read own user-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users insert own user-media" ON storage.objects;
CREATE POLICY "Users insert own user-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own user-media" ON storage.objects;
CREATE POLICY "Users update own user-media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own user-media" ON storage.objects;
CREATE POLICY "Users delete own user-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
