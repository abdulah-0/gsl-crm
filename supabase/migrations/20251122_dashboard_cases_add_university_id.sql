-- Link dashboard_cases to universities via university_id
-- Idempotent and safe to re-run.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'dashboard_cases'
      AND column_name  = 'university_id'
  ) THEN
    ALTER TABLE public.dashboard_cases
      ADD COLUMN university_id bigint REFERENCES public.universities(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_dashboard_cases_university
  ON public.dashboard_cases(university_id);

COMMIT;

