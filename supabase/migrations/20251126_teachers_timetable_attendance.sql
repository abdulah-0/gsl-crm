-- Teachers Tab Restructure: Timetable and Attendance
-- Add timetable management and update attendance structure

SET search_path TO public;

BEGIN;

-- 1) Create teacher_timetable table
CREATE TABLE IF NOT EXISTS teacher_timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  uploaded_by text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Create index for active timetable lookup
CREATE INDEX IF NOT EXISTS idx_teacher_timetable_active 
  ON teacher_timetable(is_active, uploaded_at DESC);

-- 2) Verify teacher_attendance table exists and has correct structure
-- If it doesn't exist, create it
CREATE TABLE IF NOT EXISTS teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text NOT NULL,
  student_id text NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Present', 'Absent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, student_id, attendance_date)
);

-- Create indexes for teacher_attendance
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher 
  ON teacher_attendance(teacher_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_student 
  ON teacher_attendance(student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date 
  ON teacher_attendance(attendance_date DESC);

-- 3) Enable RLS on teacher_timetable
ALTER TABLE teacher_timetable ENABLE ROW LEVEL SECURITY;

-- 4) Create RLS policies for teacher_timetable
DO $$ 
BEGIN
  -- All authenticated users can view active timetables
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_timetable' 
      AND policyname = 'timetable_select_auth'
  ) THEN
    CREATE POLICY timetable_select_auth 
      ON teacher_timetable 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  -- Only authenticated users can insert (admin check done in app)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_timetable' 
      AND policyname = 'timetable_insert_auth'
  ) THEN
    CREATE POLICY timetable_insert_auth 
      ON teacher_timetable 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
  END IF;

  -- Only authenticated users can update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_timetable' 
      AND policyname = 'timetable_update_auth'
  ) THEN
    CREATE POLICY timetable_update_auth 
      ON teacher_timetable 
      FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

-- 5) Enable RLS on teacher_attendance if not already enabled
ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;

-- 6) Create RLS policies for teacher_attendance
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_attendance' 
      AND policyname = 'attendance_select_auth'
  ) THEN
    CREATE POLICY attendance_select_auth 
      ON teacher_attendance 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_attendance' 
      AND policyname = 'attendance_insert_auth'
  ) THEN
    CREATE POLICY attendance_insert_auth 
      ON teacher_attendance 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_attendance' 
      AND policyname = 'attendance_update_auth'
  ) THEN
    CREATE POLICY attendance_update_auth 
      ON teacher_attendance 
      FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_attendance' 
      AND policyname = 'attendance_delete_auth'
  ) THEN
    CREATE POLICY attendance_delete_auth 
      ON teacher_attendance 
      FOR DELETE 
      TO authenticated 
      USING (true);
  END IF;
END $$;

COMMIT;
