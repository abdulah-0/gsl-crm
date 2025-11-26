-- Add stage column to leads table for tracking lead progression
-- Idempotent and safe to re-run

BEGIN;

-- Add stage column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'stage'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN stage text DEFAULT 'Entry stage';
  END IF;
END$$;

-- Create index for filtering performance
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);

-- Add check constraint for valid stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_stage_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_stage_check
      CHECK (stage IN ('Entry stage', 'Initial Stage', 'Follow up', 'Near to Confirm', 'Confirmed', 'Case lose'));
  END IF;
END$$;

COMMIT;
