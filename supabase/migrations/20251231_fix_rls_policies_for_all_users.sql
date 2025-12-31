-- COMPLETE FIX: RLS Policies for All Tables
-- Run this in Supabase SQL Editor to allow all authenticated users to access all tables
-- This fixes the 403 Forbidden errors

BEGIN;

-- ============================================
-- DASHBOARD_SERVICES (Fixing the 403 error)
-- ============================================
DROP POLICY IF EXISTS services_read_authenticated ON public.dashboard_services;
DROP POLICY IF EXISTS services_write_authenticated ON public.dashboard_services;
DROP POLICY IF EXISTS services_update_authenticated ON public.dashboard_services;
DROP POLICY IF EXISTS services_delete_authenticated ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_select ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_insert ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_update ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_delete ON public.dashboard_services;

CREATE POLICY services_auth_select ON public.dashboard_services
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY services_auth_insert ON public.dashboard_services
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY services_auth_update ON public.dashboard_services
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY services_auth_delete ON public.dashboard_services
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- LEADS TABLE
-- ============================================
DROP POLICY IF EXISTS leads_auth ON public.leads;
DROP POLICY IF EXISTS leads_auth_select ON public.leads;
DROP POLICY IF EXISTS leads_auth_insert ON public.leads;
DROP POLICY IF EXISTS leads_auth_update ON public.leads;
DROP POLICY IF EXISTS leads_auth_delete ON public.leads;

CREATE POLICY leads_auth_select ON public.leads
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY leads_auth_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY leads_auth_update ON public.leads
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY leads_auth_delete ON public.leads
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- DASHBOARD_CASES TABLE
-- ============================================
DROP POLICY IF EXISTS cases_auth ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_select ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_insert ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_update ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_delete ON public.dashboard_cases;

CREATE POLICY cases_auth_select ON public.dashboard_cases
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cases_auth_insert ON public.dashboard_cases
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY cases_auth_update ON public.dashboard_cases
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY cases_auth_delete ON public.dashboard_cases
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- DASHBOARD_STUDENTS TABLE
-- ============================================
DROP POLICY IF EXISTS students_auth ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_select ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_insert ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_update ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_delete ON public.dashboard_students;

CREATE POLICY students_auth_select ON public.dashboard_students
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY students_auth_insert ON public.dashboard_students
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY students_auth_update ON public.dashboard_students
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY students_auth_delete ON public.dashboard_students
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- DASHBOARD_TASKS TABLE
-- ============================================
DROP POLICY IF EXISTS tasks_auth ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_select ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_insert ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_update ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_delete ON public.dashboard_tasks;

CREATE POLICY tasks_auth_select ON public.dashboard_tasks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY tasks_auth_insert ON public.dashboard_tasks
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY tasks_auth_update ON public.dashboard_tasks
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY tasks_auth_delete ON public.dashboard_tasks
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- UNIVERSITIES TABLE
-- ============================================
DROP POLICY IF EXISTS universities_auth ON public.universities;
DROP POLICY IF EXISTS universities_auth_select ON public.universities;
DROP POLICY IF EXISTS universities_auth_insert ON public.universities;
DROP POLICY IF EXISTS universities_auth_update ON public.universities;
DROP POLICY IF EXISTS universities_auth_delete ON public.universities;

CREATE POLICY universities_auth_select ON public.universities
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY universities_auth_insert ON public.universities
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY universities_auth_update ON public.universities
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY universities_auth_delete ON public.universities
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- DASHBOARD_TEACHERS TABLE
-- ============================================
DROP POLICY IF EXISTS teachers_select_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_insert_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_update_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_delete_auth ON public.dashboard_teachers;

CREATE POLICY teachers_select_auth ON public.dashboard_teachers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY teachers_insert_auth ON public.dashboard_teachers
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY teachers_update_auth ON public.dashboard_teachers
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY teachers_delete_auth ON public.dashboard_teachers
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- DASHBOARD_REPORTS TABLE
-- ============================================
DROP POLICY IF EXISTS reports_select_auth ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_insert_auth ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_update_auth ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_delete_auth ON public.dashboard_reports;

CREATE POLICY reports_select_auth ON public.dashboard_reports
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY reports_insert_auth ON public.dashboard_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY reports_update_auth ON public.dashboard_reports
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY reports_delete_auth ON public.dashboard_reports
  FOR DELETE TO authenticated
  USING (true);

COMMIT;

-- Verify the policies were created successfully
SELECT 
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'dashboard_services',
  'leads',
  'dashboard_cases',
  'dashboard_students',
  'dashboard_tasks',
  'universities',
  'dashboard_teachers',
  'dashboard_reports'
)
ORDER BY tablename, policyname;
