-- Create storage bucket for permanent dream images
INSERT INTO storage.buckets (id, name, public)
VALUES ('dream-images', 'dream-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload dream images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dream-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access (bucket is public)
CREATE POLICY "Public read access for dream images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dream-images');

-- Users can overwrite/update their own images
CREATE POLICY "Users can update own dream images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'dream-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own images
CREATE POLICY "Users can delete own dream images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'dream-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
