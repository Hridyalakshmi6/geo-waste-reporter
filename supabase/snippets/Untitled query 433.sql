SELECT
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

  CREATE POLICY "Allow anonymous uploads to waste-images"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'waste-images'
);


SELECT
    policyname,
    roles,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';