-- Branch-Specific Data Access Implementation (2025-12-22)
-- Makes i8 the main branch with access to all data
-- Other branches can only access their own data
-- Idempotent: safe to run multiple times

BEGIN;

-- ============================================================================
-- PART 1: Branch Configuration
-- ============================================================================

-- Detect which schema is in use and handle accordingly
DO $$
DECLARE
  has_branch_code boolean;
  has_code_column boolean;
  has_name_column boolean;
  has_branch_name_column boolean;
BEGIN
  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_code'
  ) INTO has_branch_code;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='code'
  ) INTO has_code_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='name'
  ) INTO has_name_column;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_name'
  ) INTO has_branch_name_column;

  -- Add is_main_branch flag if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='is_main_branch'
  ) THEN
    ALTER TABLE public.branches ADD COLUMN is_main_branch boolean NOT NULL DEFAULT false;
  END IF;

  -- Handle based on schema - check old schema first (code column)
  IF has_code_column THEN
    -- Old schema or hybrid: use code column
    -- Mark i8 as main branch
    UPDATE public.branches SET is_main_branch = true WHERE code = 'i8';
    
    -- Create i8 if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE code = 'i8') THEN
      -- Insert using ALL available columns (hybrid schema support)
      IF has_name_column AND has_branch_name_column AND has_branch_code THEN
        -- Hybrid schema: populate both old and new columns
        INSERT INTO public.branches (code, name, branch_code, branch_name, is_main_branch)
        VALUES ('i8', 'i8 - Head Office', 'i8', 'i8 - Head Office', true);
      ELSIF has_name_column THEN
        -- Old schema only
        INSERT INTO public.branches (code, name, is_main_branch)
        VALUES ('i8', 'i8 - Head Office', true);
      ELSE
        -- Minimal old schema
        INSERT INTO public.branches (code, is_main_branch)
        VALUES ('i8', true);
      END IF;
    END IF;
    
  ELSIF has_branch_code THEN
    -- Pure new schema: use branch_code
    -- Mark i8 as main branch
    UPDATE public.branches SET is_main_branch = true WHERE branch_code = 'i8';
    
    -- Create i8 if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE branch_code = 'i8') THEN
      INSERT INTO public.branches (branch_name, branch_code, is_main_branch, created_by)
      VALUES ('i8 - Head Office', 'i8', true, 'system');
    END IF;
  END IF;
END$$;

-- ============================================================================
-- PART 2: Add Branch Columns to Core Tables
-- ============================================================================

-- dashboard_students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_students' AND column_name='branch'
  ) THEN
    ALTER TABLE public.dashboard_students ADD COLUMN branch text;
  END IF;
END$$;

-- leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='branch'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN branch text;
  END IF;
END$$;

-- invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='branch'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN branch text;
  END IF;
END$$;

-- dashboard_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_services' AND column_name='branch'
  ) THEN
    ALTER TABLE public.dashboard_services ADD COLUMN branch text;
  END IF;
END$$;

-- dashboard_teachers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_teachers' AND column_name='branch'
  ) THEN
    ALTER TABLE public.dashboard_teachers ADD COLUMN branch text;
  END IF;
END$$;

-- dashboard_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_tasks' AND column_name='branch'
  ) THEN
    ALTER TABLE public.dashboard_tasks ADD COLUMN branch text;
  END IF;
END$$;

-- universities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='universities' AND column_name='branch'
  ) THEN
    ALTER TABLE public.universities ADD COLUMN branch text;
  END IF;
END$$;

-- lead_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_documents' AND column_name='branch'
  ) THEN
    ALTER TABLE public.lead_documents ADD COLUMN branch text;
  END IF;
END$$;

-- lead_timeline
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lead_timeline' AND column_name='branch'
  ) THEN
    ALTER TABLE public.lead_timeline ADD COLUMN branch text;
  END IF;
END$$;

-- ============================================================================
-- PART 3: Backfill Existing Data with i8 Branch
-- ============================================================================

-- Backfill dashboard_students
UPDATE public.dashboard_students SET branch = 'i8' WHERE branch IS NULL;

-- Backfill dashboard_cases (already has branch column)
UPDATE public.dashboard_cases SET branch = 'i8' WHERE branch IS NULL;

-- Backfill leads
UPDATE public.leads SET branch = 'i8' WHERE branch IS NULL;

-- Backfill invoices
UPDATE public.invoices SET branch = 'i8' WHERE branch IS NULL;

-- Backfill vouchers (already has branch column)
UPDATE public.vouchers SET branch = 'i8' WHERE branch IS NULL;

-- Backfill dashboard_services
UPDATE public.dashboard_services SET branch = 'i8' WHERE branch IS NULL;

-- Backfill dashboard_teachers
UPDATE public.dashboard_teachers SET branch = 'i8' WHERE branch IS NULL;

-- Backfill dashboard_tasks
UPDATE public.dashboard_tasks SET branch = 'i8' WHERE branch IS NULL;

-- Backfill universities (can be shared, set to i8 for now)
UPDATE public.universities SET branch = 'i8' WHERE branch IS NULL;

-- Backfill lead_documents
UPDATE public.lead_documents SET branch = 'i8' WHERE branch IS NULL;

-- Backfill lead_timeline
UPDATE public.lead_timeline SET branch = 'i8' WHERE branch IS NULL;

-- ============================================================================
-- PART 4: Auto-Branch Assignment Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_set_branch_from_user()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch IS NULL THEN
    SELECT du.branch INTO NEW.branch
    FROM public.dashboard_users du
    WHERE du.email = auth.email()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 5: Apply Triggers to Tables
-- ============================================================================

-- dashboard_students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_students' AND n.nspname='public' AND c.relname='dashboard_students'
  ) THEN
    CREATE TRIGGER auto_set_branch_students
    BEFORE INSERT ON public.dashboard_students
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- dashboard_cases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_cases' AND n.nspname='public' AND c.relname='dashboard_cases'
  ) THEN
    CREATE TRIGGER auto_set_branch_cases
    BEFORE INSERT ON public.dashboard_cases
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_leads' AND n.nspname='public' AND c.relname='leads'
  ) THEN
    CREATE TRIGGER auto_set_branch_leads
    BEFORE INSERT ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_invoices' AND n.nspname='public' AND c.relname='invoices'
  ) THEN
    CREATE TRIGGER auto_set_branch_invoices
    BEFORE INSERT ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- vouchers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_vouchers' AND n.nspname='public' AND c.relname='vouchers'
  ) THEN
    CREATE TRIGGER auto_set_branch_vouchers
    BEFORE INSERT ON public.vouchers
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- dashboard_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_services' AND n.nspname='public' AND c.relname='dashboard_services'
  ) THEN
    CREATE TRIGGER auto_set_branch_services
    BEFORE INSERT ON public.dashboard_services
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- dashboard_teachers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_teachers' AND n.nspname='public' AND c.relname='dashboard_teachers'
  ) THEN
    CREATE TRIGGER auto_set_branch_teachers
    BEFORE INSERT ON public.dashboard_teachers
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- dashboard_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_tasks' AND n.nspname='public' AND c.relname='dashboard_tasks'
  ) THEN
    CREATE TRIGGER auto_set_branch_tasks
    BEFORE INSERT ON public.dashboard_tasks
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- lead_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_lead_docs' AND n.nspname='public' AND c.relname='lead_documents'
  ) THEN
    CREATE TRIGGER auto_set_branch_lead_docs
    BEFORE INSERT ON public.lead_documents
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- lead_timeline
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='auto_set_branch_lead_timeline' AND n.nspname='public' AND c.relname='lead_timeline'
  ) THEN
    CREATE TRIGGER auto_set_branch_lead_timeline
    BEFORE INSERT ON public.lead_timeline
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_branch_from_user();
  END IF;
END$$;

-- ============================================================================
-- PART 6: Branch-Aware RLS Policies
-- ============================================================================

-- Helper function to check if user is in main branch or super admin
CREATE OR REPLACE FUNCTION public.can_access_all_branches()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  user_branch text;
  user_role text;
BEGIN
  -- Get user's branch and role
  SELECT me.branch, me.role INTO user_branch, user_role
  FROM public.dashboard_users me
  WHERE me.email = auth.email()
  LIMIT 1;
  
  -- Super admin has access to all
  IF user_role IS NOT NULL AND lower(user_role) LIKE '%super%' THEN
    RETURN true;
  END IF;
  
  -- i8 branch has access to all (main branch/head office)
  IF user_branch = 'i8' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- ============================================================================
-- dashboard_students RLS
-- ============================================================================

DROP POLICY IF EXISTS students_select_auth ON public.dashboard_students;
DROP POLICY IF EXISTS students_write_auth ON public.dashboard_students;

CREATE POLICY students_select_branch ON public.dashboard_students
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY students_insert_branch ON public.dashboard_students
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY students_update_branch ON public.dashboard_students
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY students_delete_branch ON public.dashboard_students
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- dashboard_cases RLS
-- ============================================================================

DROP POLICY IF EXISTS cases_select_auth ON public.dashboard_cases;
DROP POLICY IF EXISTS cases_write_auth ON public.dashboard_cases;

CREATE POLICY cases_select_branch ON public.dashboard_cases
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY cases_insert_branch ON public.dashboard_cases
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY cases_update_branch ON public.dashboard_cases
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY cases_delete_branch ON public.dashboard_cases
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- leads RLS
-- ============================================================================

DROP POLICY IF EXISTS leads_auth ON public.leads;
DROP POLICY IF EXISTS leads_public_insert ON public.leads;

-- Keep public insert for lead forms
CREATE POLICY leads_public_insert ON public.leads
FOR INSERT WITH CHECK (true);

CREATE POLICY leads_select_branch ON public.leads
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY leads_update_branch ON public.leads
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY leads_delete_branch ON public.leads
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- invoices RLS
-- ============================================================================

DROP POLICY IF EXISTS inv_sel_auth ON public.invoices;
DROP POLICY IF EXISTS inv_ins_auth ON public.invoices;
DROP POLICY IF EXISTS inv_upd_auth ON public.invoices;
DROP POLICY IF EXISTS inv_del_auth ON public.invoices;

CREATE POLICY invoices_select_branch ON public.invoices
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY invoices_insert_branch ON public.invoices
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY invoices_update_branch ON public.invoices
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY invoices_delete_branch ON public.invoices
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- vouchers RLS
-- ============================================================================

DROP POLICY IF EXISTS vch_sel_auth ON public.vouchers;
DROP POLICY IF EXISTS vch_ins_auth ON public.vouchers;
DROP POLICY IF EXISTS vch_upd_auth ON public.vouchers;
DROP POLICY IF EXISTS vch_del_auth ON public.vouchers;

CREATE POLICY vouchers_select_branch ON public.vouchers
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY vouchers_insert_branch ON public.vouchers
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY vouchers_update_branch ON public.vouchers
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY vouchers_delete_branch ON public.vouchers
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- dashboard_services RLS
-- ============================================================================

DROP POLICY IF EXISTS services_select_auth ON public.dashboard_services;
DROP POLICY IF EXISTS services_write_auth ON public.dashboard_services;

CREATE POLICY services_select_branch ON public.dashboard_services
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY services_insert_branch ON public.dashboard_services
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY services_update_branch ON public.dashboard_services
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY services_delete_branch ON public.dashboard_services
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- dashboard_teachers RLS
-- ============================================================================

DROP POLICY IF EXISTS teachers_select_auth ON public.dashboard_teachers;
DROP POLICY IF EXISTS teachers_write_auth ON public.dashboard_teachers;

CREATE POLICY teachers_select_branch ON public.dashboard_teachers
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY teachers_insert_branch ON public.dashboard_teachers
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY teachers_update_branch ON public.dashboard_teachers
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY teachers_delete_branch ON public.dashboard_teachers
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- dashboard_tasks RLS
-- ============================================================================

DROP POLICY IF EXISTS tasks_select_auth ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_insert_auth ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_update_auth ON public.dashboard_tasks;
DROP POLICY IF EXISTS tasks_delete_auth ON public.dashboard_tasks;

CREATE POLICY tasks_select_branch ON public.dashboard_tasks
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY tasks_insert_branch ON public.dashboard_tasks
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY tasks_update_branch ON public.dashboard_tasks
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY tasks_delete_branch ON public.dashboard_tasks
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- universities RLS (shared resource, but branch-aware for tracking)
-- ============================================================================

DROP POLICY IF EXISTS universities_auth ON public.universities;

CREATE POLICY universities_select_branch ON public.universities
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY universities_insert_branch ON public.universities
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY universities_update_branch ON public.universities
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY universities_delete_branch ON public.universities
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- lead_documents RLS
-- ============================================================================

DROP POLICY IF EXISTS lead_docs_auth ON public.lead_documents;

CREATE POLICY lead_docs_select_branch ON public.lead_documents
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY lead_docs_insert_branch ON public.lead_documents
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY lead_docs_update_branch ON public.lead_documents
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY lead_docs_delete_branch ON public.lead_documents
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- lead_timeline RLS
-- ============================================================================

DROP POLICY IF EXISTS lead_timeline_auth ON public.lead_timeline;

CREATE POLICY lead_timeline_select_branch ON public.lead_timeline
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY lead_timeline_insert_branch ON public.lead_timeline
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = COALESCE(branch, me.branch)
    )
  )
);

CREATE POLICY lead_timeline_update_branch ON public.lead_timeline
FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

CREATE POLICY lead_timeline_delete_branch ON public.lead_timeline
FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
  )
);

-- ============================================================================
-- PART 7: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dashboard_students_branch ON public.dashboard_students(branch);
CREATE INDEX IF NOT EXISTS idx_dashboard_cases_branch ON public.dashboard_cases(branch);
CREATE INDEX IF NOT EXISTS idx_leads_branch ON public.leads(branch);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON public.invoices(branch);
CREATE INDEX IF NOT EXISTS idx_vouchers_branch ON public.vouchers(branch);
CREATE INDEX IF NOT EXISTS idx_dashboard_services_branch ON public.dashboard_services(branch);
CREATE INDEX IF NOT EXISTS idx_dashboard_teachers_branch ON public.dashboard_teachers(branch);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_branch ON public.dashboard_tasks(branch);
CREATE INDEX IF NOT EXISTS idx_universities_branch ON public.universities(branch);
CREATE INDEX IF NOT EXISTS idx_lead_documents_branch ON public.lead_documents(branch);
CREATE INDEX IF NOT EXISTS idx_lead_timeline_branch ON public.lead_timeline(branch);

COMMIT;
