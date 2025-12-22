-- Add 'Enrollment' and 'Not Enrolled' to dashboard_cases status and stage constraints
-- This migration updates the CHECK constraints to include the missing stages

-- Ensure we're working in the public schema
SET search_path TO public;

BEGIN;

-- 1) Drop the existing CHECK constraint on status column
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
    RAISE NOTICE 'Dropped constraint: %', c.conname;
  END LOOP;
END
$$;

-- 2) Drop the existing CHECK constraint on stage column
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
      AND att.attname = 'stage'
  LOOP
    EXECUTE format('ALTER TABLE public.dashboard_cases DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'Dropped constraint: %', c.conname;
  END LOOP;
END
$$;

-- 3) Add new CHECK constraint for status with all 13 stages (including Enrollment and Not Enrolled)
ALTER TABLE public.dashboard_cases
  ADD CONSTRAINT dashboard_cases_status_13stage_chk CHECK (
    status IN (
      'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
      'CAS Applied','CAS Received','Visa Applied','Visa Received','Enrollment',
      'Not Enrolled','Backout','Visa Rejected'
    )
  );

-- 4) Add new CHECK constraint for stage with all 13 stages
ALTER TABLE public.dashboard_cases
  ADD CONSTRAINT dashboard_cases_stage_13stage_chk CHECK (
    stage IN (
      'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
      'CAS Applied','CAS Received','Visa Applied','Visa Received','Enrollment',
      'Not Enrolled','Backout','Visa Rejected'
    )
  );

COMMIT;
