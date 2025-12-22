-- Add remarks column to leads table
-- Idempotent and safe to re-run

BEGIN;

-- Add remarks column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'remarks'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN remarks text;
  END IF;
END$$;

COMMIT;
