-- Migration: Add id_type column to support CNIC/Passport selection
-- Created: 2025-12-30

-- Add id_type column to dashboard_students table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'dashboard_students' 
                 AND column_name = 'id_type') THEN
    ALTER TABLE public.dashboard_students ADD COLUMN id_type TEXT DEFAULT 'cnic';
  END IF;
END $$;

-- Add id_type column to leads table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'leads' 
                 AND column_name = 'id_type') THEN
    ALTER TABLE public.leads ADD COLUMN id_type TEXT DEFAULT 'cnic';
  END IF;
END $$;

-- Add check constraints to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dashboard_students_id_type_check'
  ) THEN
    ALTER TABLE public.dashboard_students 
    ADD CONSTRAINT dashboard_students_id_type_check 
    CHECK (id_type IN ('cnic', 'passport'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_id_type_check'
  ) THEN
    ALTER TABLE public.leads 
    ADD CONSTRAINT leads_id_type_check 
    CHECK (id_type IN ('cnic', 'passport'));
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.dashboard_students.id_type IS 'Type of identification: cnic or passport';
COMMENT ON COLUMN public.leads.id_type IS 'Type of identification: cnic or passport';
