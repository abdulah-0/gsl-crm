-- Create and configure the 'info' storage bucket for info posts
-- This fixes the storage upload errors

BEGIN;

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('info', 'info', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload to info bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to info bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files in info bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files in info bucket" ON storage.objects;

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload to info bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'info');

-- Allow public read access
CREATE POLICY "Allow public read access to info bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'info');

-- Allow users to update their own files
CREATE POLICY "Allow users to update their own files in info bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'info' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files in info bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'info' AND auth.uid()::text = (storage.foldername(name))[1]);

COMMIT;
