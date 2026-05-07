-- Block public LIST on avatars and empresa-assets buckets while keeping public file access via direct URL
-- Public buckets serve files via CDN regardless of storage.objects RLS, so removing public SELECT policies
-- eliminates listing/enumeration without breaking embedded logos/avatars in PDFs, emails, or app UI.

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for empresa-assets" ON storage.objects;

-- Allow authenticated users to view (needed for any code path that uses the storage API list/get,
-- e.g. removing old files before upload). Public CDN access via getPublicUrl continues to work.
CREATE POLICY "Authenticated can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated can view empresa-assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'empresa-assets');