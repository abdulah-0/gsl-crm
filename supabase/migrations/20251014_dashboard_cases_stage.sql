-- Add "stage" column to dashboard_cases and seed basic values for new Case Pipeline
-- Idempotent and safe to re-run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_cases' AND column_name='stage'
  ) THEN
    ALTER TABLE public.dashboard_cases ADD COLUMN stage text;
  END IF;
END$$;

-- Optional: backfill a rough stage from existing type/status if stage is NULL
UPDATE public.dashboard_cases
SET stage = CASE
  WHEN coalesce(status,'') ILIKE '%completed%' THEN 'Visa Received'
  WHEN coalesce(type,'') ILIKE '%visa%' THEN 'Visa Applied'
  WHEN coalesce(type,'') ILIKE '%cas%' THEN 'CAS Applied'
  WHEN coalesce(type,'') ILIKE '%offer%' AND coalesce(status,'') ILIKE '%appl%' THEN 'Offer Applied'
  ELSE 'Initial Stage'
END
WHERE stage IS NULL;

-- Simple check constraint (optional) to keep known stages; comment out if too restrictive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='dashboard_cases' AND constraint_name='dashboard_cases_stage_chk'
  ) THEN
    ALTER TABLE public.dashboard_cases
    ADD CONSTRAINT dashboard_cases_stage_chk CHECK (
      stage IN (
        'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
        'CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected'
      )
    );
  END IF;
END$$;

