-- University Application Tracking System
-- Add support for tracking university applications per case

SET search_path TO public;

BEGIN;

-- 1) Create case_university_applications table
CREATE TABLE IF NOT EXISTS case_university_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL,
  university_id text NOT NULL,
  course_applied text NOT NULL,
  application_date date NOT NULL DEFAULT CURRENT_DATE,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  CONSTRAINT fk_case FOREIGN KEY (case_id) REFERENCES dashboard_cases(case_number) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_case_university_applications_case_id 
  ON case_university_applications(case_id);
CREATE INDEX IF NOT EXISTS idx_case_university_applications_university_id 
  ON case_university_applications(university_id);
CREATE INDEX IF NOT EXISTS idx_case_university_applications_created_at 
  ON case_university_applications(created_at DESC);

-- 2) Add university_ids array column to dashboard_cases if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dashboard_cases'
      AND column_name = 'university_ids'
  ) THEN
    ALTER TABLE dashboard_cases ADD COLUMN university_ids text[];
  END IF;
END $$;

-- 3) Migrate existing university_id to university_ids array
UPDATE dashboard_cases
SET university_ids = ARRAY[university_id::text]
WHERE university_id IS NOT NULL
  AND (university_ids IS NULL OR array_length(university_ids, 1) IS NULL);

-- 4) Enable RLS on case_university_applications
ALTER TABLE case_university_applications ENABLE ROW LEVEL SECURITY;

-- 5) Create RLS policies for authenticated users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'case_university_applications' 
      AND policyname = 'case_uni_apps_select_auth'
  ) THEN
    CREATE POLICY case_uni_apps_select_auth 
      ON case_university_applications 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'case_university_applications' 
      AND policyname = 'case_uni_apps_insert_auth'
  ) THEN
    CREATE POLICY case_uni_apps_insert_auth 
      ON case_university_applications 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'case_university_applications' 
      AND policyname = 'case_uni_apps_update_auth'
  ) THEN
    CREATE POLICY case_uni_apps_update_auth 
      ON case_university_applications 
      FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'case_university_applications' 
      AND policyname = 'case_uni_apps_delete_auth'
  ) THEN
    CREATE POLICY case_uni_apps_delete_auth 
      ON case_university_applications 
      FOR DELETE 
      TO authenticated 
      USING (true);
  END IF;
END $$;

COMMIT;
