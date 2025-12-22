-- Align dashboard_cases.status with the new 11-stage case pipeline
BEGIN;

-- 1) Drop any existing CHECK constraint attached to the status column
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

-- 2) Normalise all existing status values into the 11 allowed stages
--    so that adding the CHECK constraint cannot fail on old rows.
DO $$
DECLARE
  has_stage boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'dashboard_cases'
      AND column_name  = 'stage'
  ) INTO has_stage;

  IF has_stage THEN
    UPDATE public.dashboard_cases
    SET status = CASE
      WHEN stage IN (
        'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
        'CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected'
      ) THEN stage
      WHEN status IN (
        'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
        'CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected'
      ) THEN status
      ELSE 'Initial Stage'
    END;
  ELSE
    UPDATE public.dashboard_cases
    SET status = CASE
      WHEN status IN (
        'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
        'CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected'
      ) THEN status
      ELSE 'Initial Stage'
    END;
  END IF;
END
$$;

-- 3) Set default and add new CHECK constraint for the 11 stages
ALTER TABLE public.dashboard_cases
  ALTER COLUMN status SET DEFAULT 'Initial Stage';

ALTER TABLE public.dashboard_cases
  ADD CONSTRAINT dashboard_cases_status_11stage_chk CHECK (
    status IN (
      'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
      'CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected'
    )
  );

COMMIT;

