-- Student Mock Tests
-- Table for storing mock test scores recorded by teachers

SET search_path TO public;

BEGIN;

-- Create student_mock_tests table
CREATE TABLE IF NOT EXISTS student_mock_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  teacher_id text NOT NULL,
  test_name text NOT NULL,
  score text NOT NULL,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_student_mock_tests_student 
  ON student_mock_tests(student_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_mock_tests_teacher 
  ON student_mock_tests(teacher_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_mock_tests_date 
  ON student_mock_tests(test_date DESC);

-- Enable RLS
ALTER TABLE student_mock_tests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  -- All authenticated users can view test scores
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'student_mock_tests' 
      AND policyname = 'mock_tests_select_auth'
  ) THEN
    CREATE POLICY mock_tests_select_auth 
      ON student_mock_tests 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  -- Only authenticated users can insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'student_mock_tests' 
      AND policyname = 'mock_tests_insert_auth'
  ) THEN
    CREATE POLICY mock_tests_insert_auth 
      ON student_mock_tests 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
  END IF;

  -- Only authenticated users can update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'student_mock_tests' 
      AND policyname = 'mock_tests_update_auth'
  ) THEN
    CREATE POLICY mock_tests_update_auth 
      ON student_mock_tests 
      FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;

  -- Only authenticated users can delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'student_mock_tests' 
      AND policyname = 'mock_tests_delete_auth'
  ) THEN
    CREATE POLICY mock_tests_delete_auth 
      ON student_mock_tests 
      FOR DELETE 
      TO authenticated 
      USING (true);
  END IF;
END $$;

COMMIT;
