-- Re-enable Branch-Specific Data Access with Proper RLS (2026-01-02)
-- This migration re-enables branch isolation that was previously disabled
-- Ensures Super Admins can see all branches while other users see only their branch

BEGIN;

-- ============================================================================
-- PART 1: Verify Branch Columns Exist (should already exist from previous migration)
-- ============================================================================

-- Note: accounts table doesn't exist in this schema
-- Finance data is tracked through invoices and vouchers tables

-- ============================================================================
-- PART 2: Create Indexes for Performance
-- ============================================================================

-- Create indexes on branch columns for better query performance
CREATE INDEX IF NOT EXISTS idx_students_branch ON public.dashboard_students(branch);
CREATE INDEX IF NOT EXISTS idx_cases_branch ON public.dashboard_cases(branch);
CREATE INDEX IF NOT EXISTS idx_leads_branch ON public.leads(branch);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON public.invoices(branch);
CREATE INDEX IF NOT EXISTS idx_vouchers_branch ON public.vouchers(branch);
CREATE INDEX IF NOT EXISTS idx_services_branch ON public.dashboard_services(branch);
CREATE INDEX IF NOT EXISTS idx_teachers_branch ON public.dashboard_teachers(branch);
CREATE INDEX IF NOT EXISTS idx_tasks_branch ON public.dashboard_tasks(branch);

-- ============================================================================
-- PART 3: Update Helper Function for Branch Access
-- ============================================================================

-- Improved function to check if user can access all branches
CREATE OR REPLACE FUNCTION public.can_access_all_branches()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  user_email text;
  user_branch text;
  user_role text;
BEGIN
  -- Get current user email
  user_email := auth.email();
  
  IF user_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's branch and role
  SELECT me.branch, me.role INTO user_branch, user_role
  FROM public.dashboard_users me
  WHERE me.email = user_email
  LIMIT 1;
  
  -- Super admin has access to all (check role contains 'super' case-insensitive)
  IF user_role IS NOT NULL AND LOWER(user_role) LIKE '%super%' THEN
    RETURN true;
  END IF;
  
  -- i8 branch is the main branch/head office with access to all
  IF user_branch = 'i8' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- ============================================================================
-- PART 4: Re-enable Branch-Specific RLS Policies
-- ============================================================================

-- Drop the overly permissive policies from the fix migration
-- These allowed all authenticated users to access everything

-- DASHBOARD_STUDENTS
DROP POLICY IF EXISTS students_auth_select ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_insert ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_update ON public.dashboard_students;
DROP POLICY IF EXISTS students_auth_delete ON public.dashboard_students;

-- Re-create branch-specific policies
DROP POLICY IF EXISTS students_select_branch ON public.dashboard_students;
DROP POLICY IF EXISTS students_insert_branch ON public.dashboard_students;
DROP POLICY IF EXISTS students_update_branch ON public.dashboard_students;
DROP POLICY IF EXISTS students_delete_branch ON public.dashboard_students;

CREATE POLICY students_select_branch ON public.dashboard_students
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_students.branch
  )
);

CREATE POLICY students_insert_branch ON public.dashboard_students
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(dashboard_students.branch, me.branch)
  )
);

CREATE POLICY students_update_branch ON public.dashboard_students
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_students.branch
  )
);

CREATE POLICY students_delete_branch ON public.dashboard_students
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_students.branch
  )
);

-- DASHBOARD_CASES
DROP POLICY IF EXISTS cases_auth_select ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_select_branch ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_insert_branch ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_update_branch ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_delete_branch ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_insert ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_update ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_auth_delete ON public.dashboard_cases;

CREATE POLICY cases_select_branch ON public.dashboard_cases
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_cases.branch
  )
);

CREATE POLICY cases_insert_branch ON public.dashboard_cases
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(dashboard_cases.branch, me.branch)
  )
);

CREATE POLICY cases_update_branch ON public.dashboard_cases
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_cases.branch
  )
);

CREATE POLICY cases_delete_branch ON public.dashboard_cases
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_cases.branch
  )
);

-- LEADS
DROP POLICY IF EXISTS leads_auth_select ON public.leads;
DROP POLICY IF EXISTS leads_select_branch ON public.leads;
DROP POLICY IF EXISTS leads_update_branch ON public.leads;
DROP POLICY IF EXISTS leads_delete_branch ON public.leads;
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
DROP POLICY IF EXISTS leads_auth_insert ON public.leads;
DROP POLICY IF EXISTS leads_auth_update ON public.leads;
DROP POLICY IF EXISTS leads_auth_delete ON public.leads;

-- Keep public insert for public lead forms
CREATE POLICY leads_public_insert ON public.leads
FOR INSERT WITH CHECK (true);

CREATE POLICY leads_select_branch ON public.leads
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = leads.branch
  )
);

CREATE POLICY leads_update_branch ON public.leads
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = leads.branch
  )
);

CREATE POLICY leads_delete_branch ON public.leads
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = leads.branch
  )
);

-- INVOICES
DROP POLICY IF EXISTS invoices_auth_select ON public.invoices;
DROP POLICY IF EXISTS invoices_auth_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_auth_update ON public.invoices;
DROP POLICY IF EXISTS invoices_auth_delete ON public.invoices;
DROP POLICY IF EXISTS invoices_select_branch ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_branch ON public.invoices;
DROP POLICY IF EXISTS invoices_update_branch ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_branch ON public.invoices;

CREATE POLICY invoices_select_branch ON public.invoices
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = invoices.branch
  )
);

CREATE POLICY invoices_insert_branch ON public.invoices
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(invoices.branch, me.branch)
  )
);

CREATE POLICY invoices_update_branch ON public.invoices
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = invoices.branch
  )
);

CREATE POLICY invoices_delete_branch ON public.invoices
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = invoices.branch
  )
);

-- VOUCHERS
DROP POLICY IF EXISTS vouchers_auth_select ON public.vouchers;
DROP POLICY IF EXISTS vouchers_auth_insert ON public.vouchers;
DROP POLICY IF EXISTS vouchers_auth_update ON public.vouchers;
DROP POLICY IF EXISTS vouchers_auth_delete ON public.vouchers;
DROP POLICY IF EXISTS vouchers_select_branch ON public.vouchers;
DROP POLICY IF EXISTS vouchers_insert_branch ON public.vouchers;
DROP POLICY IF EXISTS vouchers_update_branch ON public.vouchers;
DROP POLICY IF EXISTS vouchers_delete_branch ON public.vouchers;

CREATE POLICY vouchers_select_branch ON public.vouchers
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = vouchers.branch
  )
);

CREATE POLICY vouchers_insert_branch ON public.vouchers
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(vouchers.branch, me.branch)
  )
);

CREATE POLICY vouchers_update_branch ON public.vouchers
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = vouchers.branch
  )
);

CREATE POLICY vouchers_delete_branch ON public.vouchers
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = vouchers.branch
  )
);

-- DASHBOARD_SERVICES
DROP POLICY IF EXISTS services_auth_select ON public.dashboard_services;
DROP POLICY IF EXISTS services_select_branch ON public.dashboard_services;
DROP POLICY IF EXISTS services_insert_branch ON public.dashboard_services;
DROP POLICY IF EXISTS services_update_branch ON public.dashboard_services;
DROP POLICY IF EXISTS services_delete_branch ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_insert ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_update ON public.dashboard_services;
DROP POLICY IF EXISTS services_auth_delete ON public.dashboard_services;

CREATE POLICY services_select_branch ON public.dashboard_services
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_services.branch
  )
);

CREATE POLICY services_insert_branch ON public.dashboard_services
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(dashboard_services.branch, me.branch)
  )
);

CREATE POLICY services_update_branch ON public.dashboard_services
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_services.branch
  )
);

CREATE POLICY services_delete_branch ON public.dashboard_services
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_services.branch
  )
);

-- DASHBOARD_TEACHERS
DROP POLICY IF EXISTS teachers_select_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_select_branch ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_insert_branch ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_update_branch ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_delete_branch ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_insert_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_update_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_delete_auth ON public.dashboard_teachers;

CREATE POLICY teachers_select_branch ON public.dashboard_teachers
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_teachers.branch
  )
);

CREATE POLICY teachers_insert_branch ON public.dashboard_teachers
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(dashboard_teachers.branch, me.branch)
  )
);

CREATE POLICY teachers_update_branch ON public.dashboard_teachers
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_teachers.branch
  )
);

CREATE POLICY teachers_delete_branch ON public.dashboard_teachers
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_teachers.branch
  )
);

-- DASHBOARD_TASKS
DROP POLICY IF EXISTS tasks_auth_select ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_select_branch ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_insert_branch ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_update_branch ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_delete_branch ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_insert ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_update ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_auth_delete ON public.dashboard_tasks;

CREATE POLICY tasks_select_branch ON public.dashboard_tasks
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_tasks.branch
  )
);

CREATE POLICY tasks_insert_branch ON public.dashboard_tasks
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(dashboard_tasks.branch, me.branch)
  )
);

CREATE POLICY tasks_update_branch ON public.dashboard_tasks
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_tasks.branch
  )
);

CREATE POLICY tasks_delete_branch ON public.dashboard_tasks
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_tasks.branch
  )
);

-- UNIVERSITIES (can be shared across branches, but still enforce branch access)
DROP POLICY IF EXISTS universities_auth_select ON public.universities;
DROP POLICY IF EXISTS universities_select_branch ON public.universities;
DROP POLICY IF EXISTS universities_insert_branch ON public.universities;
DROP POLICY IF EXISTS universities_update_branch ON public.universities;
DROP POLICY IF EXISTS universities_delete_branch ON public.universities;
DROP POLICY IF EXISTS universities_auth_insert ON public.universities;
DROP POLICY IF EXISTS universities_auth_update ON public.universities;
DROP POLICY IF EXISTS universities_auth_delete ON public.universities;

CREATE POLICY universities_select_branch ON public.universities
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = universities.branch
  )
);

CREATE POLICY universities_insert_branch ON public.universities
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(universities.branch, me.branch)
  )
);

CREATE POLICY universities_update_branch ON public.universities
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = universities.branch
  )
);

CREATE POLICY universities_delete_branch ON public.universities
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = universities.branch
  )
);

-- DASHBOARD_REPORTS
DROP POLICY IF EXISTS reports_select_auth ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_select_branch ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_insert_branch ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_update_branch ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_delete_branch ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_insert_auth ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_update_auth ON public.dashboard_reports;
DROP POLICY IF EXISTS reports_delete_auth ON public.dashboard_reports;

CREATE POLICY reports_select_branch ON public.dashboard_reports
FOR SELECT TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_reports.branch
  )
);

CREATE POLICY reports_insert_branch ON public.dashboard_reports
FOR INSERT TO authenticated WITH CHECK (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = COALESCE(dashboard_reports.branch, me.branch)
  )
);

CREATE POLICY reports_update_branch ON public.dashboard_reports
FOR UPDATE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_reports.branch
  )
);

CREATE POLICY reports_delete_branch ON public.dashboard_reports
FOR DELETE TO authenticated USING (
  public.can_access_all_branches()
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND me.branch = dashboard_reports.branch
  )
);

COMMIT;

-- Verification queries
SELECT 'Branch-specific RLS policies re-enabled successfully!' as status;

SELECT 
  'Policies created:' as info,
  COUNT(*) as policy_count
FROM pg_policies
WHERE policyname LIKE '%_branch';
