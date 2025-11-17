-- Extend dashboard_cases pipeline to include new "Enrollment" stage
-- and add google_drive_link column for storing external Drive URLs.
-- Idempotent and safe to re-run.

BEGIN;

-- 1) Relax and recreate CHECK constraint on status to allow 12 stages
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class      rel ON rel.oid = con.conrelid
    JOIN pg_namespace  nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute  att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE rel.relname = 'dashboard_cases'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND att.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.dashboard_cases DROP CONSTRAINT %I', c.conname);
  END LOOP;
END
$$;

ALTER TABLE public.dashboard_cases
  ALTER COLUMN status SET DEFAULT 'Initial Stage';

ALTER TABLE public.dashboard_cases
  ADD CONSTRAINT dashboard_cases_status_12stage_chk CHECK (
    status IN (
      'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
      'CAS Applied','CAS Received','Visa Applied','Visa Received','Enrollment','Backout','Visa Rejected'
    )
  );

-- 2) Relax and recreate CHECK constraint on stage to allow the same 12 stages
DO $$
DECLARE c2 RECORD;
BEGIN
  FOR c2 IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class      rel ON rel.oid = con.conrelid
    JOIN pg_namespace  nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute  att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE rel.relname = 'dashboard_cases'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND att.attname = 'stage'
  LOOP
    EXECUTE format('ALTER TABLE public.dashboard_cases DROP CONSTRAINT %I', c2.conname);
  END LOOP;

  -- Recreate constraint if stage column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cases' AND column_name = 'stage'
  ) THEN
    ALTER TABLE public.dashboard_cases
      ADD CONSTRAINT dashboard_cases_stage_12stage_chk CHECK (
        stage IN (
          'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
          'CAS Applied','CAS Received','Visa Applied','Visa Received','Enrollment','Backout','Visa Rejected'
        )
      );
  END IF;
END
$$;

-- 3) Add google_drive_link column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dashboard_cases' AND column_name = 'google_drive_link'
  ) THEN
    ALTER TABLE public.dashboard_cases
      ADD COLUMN google_drive_link text;
  END IF;
END
$$;

COMMIT;

