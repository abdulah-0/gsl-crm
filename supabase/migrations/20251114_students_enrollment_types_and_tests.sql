-- Students enrollment types and Test enrollments (2025-11-14)
-- Idempotent, additive migration for dashboard_students, dashboard_cases, and test_enrollments

begin;

-- 1) Add enrollment_type to dashboard_students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'dashboard_students'
      AND column_name  = 'enrollment_type'
  ) THEN
    ALTER TABLE public.dashboard_students
      ADD COLUMN enrollment_type text NOT NULL DEFAULT 'course';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'dashboard_students'
      AND constraint_name = 'dashboard_students_enrollment_type_chk'
  ) THEN
    ALTER TABLE public.dashboard_students
      ADD CONSTRAINT dashboard_students_enrollment_type_chk
      CHECK (enrollment_type IN ('course','consultancy','test'));
  END IF;
END$$;

create index if not exists idx_dashboard_students_enrollment_type
  on public.dashboard_students(enrollment_type);


-- 2) Optional link: add student_id to dashboard_cases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'dashboard_cases'
      AND column_name  = 'student_id'
  ) THEN
    ALTER TABLE public.dashboard_cases
      ADD COLUMN student_id text references public.dashboard_students(id) on delete set null;
  END IF;
END$$;


-- 3) Test enrollments table
create table if not exists public.test_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.dashboard_students(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  mobile text,
  address text,
  date_of_birth date,
  test_type text not null check (test_type in ('IELTS','PTE','TOEFL')),
  branch text,
  created_at timestamptz not null default now()
);

create index if not exists idx_test_enrollments_student
  on public.test_enrollments(student_id);
create index if not exists idx_test_enrollments_test_type
  on public.test_enrollments(test_type);

alter table public.test_enrollments enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_enrollments' AND policyname = 'test_enrollments_select_auth'
  ) THEN
    CREATE POLICY test_enrollments_select_auth
      ON public.test_enrollments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_enrollments' AND policyname = 'test_enrollments_write_auth'
  ) THEN
    CREATE POLICY test_enrollments_write_auth
      ON public.test_enrollments
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;

commit;

