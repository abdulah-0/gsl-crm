-- Storage policies for vouchers bucket (for voucher PDFs)
-- Idempotent and safe to re-run

-- 1) Ensure vouchers bucket exists (non-public by default)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vouchers') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('vouchers', 'vouchers', false);
  END IF;
END $$;

-- 2) Policies on storage.objects for vouchers bucket
-- RLS is enabled by default for storage.objects in Supabase

-- Authenticated users can read voucher objects (needed for createSignedUrl/download)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vouchers_read_auth'
  ) THEN
    CREATE POLICY vouchers_read_auth ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'vouchers');
  END IF;
END $$;

-- Authenticated users can upload voucher PDFs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vouchers_insert_auth'
  ) THEN
    CREATE POLICY vouchers_insert_auth ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'vouchers');
  END IF;
END $$;

-- Authenticated users can update their own voucher objects (for upsert semantics)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vouchers_update_own'
  ) THEN
    CREATE POLICY vouchers_update_own ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'vouchers' AND owner = auth.uid())
      WITH CHECK (bucket_id = 'vouchers' AND owner = auth.uid());
  END IF;
END $$;

-- Optional: allow authenticated users to delete their own voucher objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vouchers_delete_own'
  ) THEN
    CREATE POLICY vouchers_delete_own ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'vouchers' AND owner = auth.uid());
  END IF;
END $$;

