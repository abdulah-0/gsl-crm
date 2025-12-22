-- Safety patch: add created_by column to public.leaves if missing (to match app insert payload)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN created_by text;
  END IF;
END$$;
