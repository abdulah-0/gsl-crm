-- Storage policies for attachments bucket (public read, authenticated upload)
-- Idempotent and safe to re-run

-- 1) Ensure attachments bucket exists and is public
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);
  ELSE
    UPDATE storage.buckets SET public = true WHERE id = 'attachments' AND public IS DISTINCT FROM true;
  END IF;
END $$;

-- 2) Policies on storage.objects for attachments bucket
-- Enable RLS is on by default for storage.objects in Supabase

-- Public read for attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'attachments_read_public'
  ) THEN
    CREATE POLICY attachments_read_public ON storage.objects
      FOR SELECT
      USING (bucket_id = 'attachments');
  END IF;
END $$;

-- Authenticated users can upload to attachments (any path under the bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'attachments_insert_authenticated'
  ) THEN
    CREATE POLICY attachments_insert_authenticated ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'attachments');
  END IF;
END $$;

-- Authenticated users can update their own objects in attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'attachments_update_own'
  ) THEN
    CREATE POLICY attachments_update_own ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'attachments' AND owner = auth.uid())
      WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());
  END IF;
END $$;

-- Authenticated users can delete their own objects in attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'attachments_delete_own'
  ) THEN
    CREATE POLICY attachments_delete_own ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'attachments' AND owner = auth.uid());
  END IF;
END $$;

