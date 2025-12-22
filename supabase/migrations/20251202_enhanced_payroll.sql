-- Enhanced Payroll System with detailed salary components
-- Adds employees_master_payroll table for storing salary breakdown
-- Updates payroll_items to store complete details

BEGIN;

-- 1) Create employees_master_payroll table for salary components
CREATE TABLE IF NOT EXISTS public.employees_master_payroll (
  employee_email TEXT PRIMARY KEY REFERENCES public.dashboard_users(email) ON DELETE CASCADE,
  
  -- Allowances
  std_basic NUMERIC DEFAULT 0,
  std_allowance NUMERIC DEFAULT 0,
  medical_10pct NUMERIC DEFAULT 0,
  house_rent_20pct NUMERIC DEFAULT 0,
  std_transportation_10pct NUMERIC DEFAULT 0,
  std_at_work NUMERIC DEFAULT 0,
  std_others NUMERIC DEFAULT 0,
  arrears NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  
  -- Deductions
  income_tax NUMERIC DEFAULT 0,
  life_insurance NUMERIC DEFAULT 0,
  health_insurance NUMERIC DEFAULT 0,
  employee_loan NUMERIC DEFAULT 0,
  fin_pn NUMERIC DEFAULT 0,
  advance_salary NUMERIC DEFAULT 0,
  esb NUMERIC DEFAULT 0,
  other_deduction NUMERIC DEFAULT 0,
  
  -- Metadata
  branch TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-set branch from dashboard_users if NULL
CREATE OR REPLACE FUNCTION public.emp_payroll_set_branch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch IS NULL THEN
    SELECT du.branch INTO NEW.branch
    FROM public.dashboard_users du
    WHERE du.email = NEW.employee_email
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='emp_payroll_set_branch_trg' 
      AND n.nspname='public' 
      AND c.relname='employees_master_payroll'
  ) THEN
    CREATE TRIGGER emp_payroll_set_branch_trg
    BEFORE INSERT OR UPDATE ON public.employees_master_payroll
    FOR EACH ROW EXECUTE FUNCTION public.emp_payroll_set_branch();
  END IF;
END
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.emp_payroll_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='emp_payroll_update_timestamp_trg' 
      AND n.nspname='public' 
      AND c.relname='employees_master_payroll'
  ) THEN
    CREATE TRIGGER emp_payroll_update_timestamp_trg
    BEFORE UPDATE ON public.employees_master_payroll
    FOR EACH ROW EXECUTE FUNCTION public.emp_payroll_update_timestamp();
  END IF;
END
$$;

-- 2) Enable RLS on employees_master_payroll
ALTER TABLE public.employees_master_payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emp_payroll_select ON public.employees_master_payroll;
DROP POLICY IF EXISTS emp_payroll_insert ON public.employees_master_payroll;
DROP POLICY IF EXISTS emp_payroll_update ON public.employees_master_payroll;
DROP POLICY IF EXISTS emp_payroll_delete ON public.employees_master_payroll;

-- SELECT: super all; admin same branch; employees can view their own
CREATE POLICY emp_payroll_select ON public.employees_master_payroll
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch) OR
    employee_email = auth.email()
  )
);

-- INSERT/UPDATE/DELETE: only super or admin of same branch
CREATE POLICY emp_payroll_insert ON public.employees_master_payroll
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = COALESCE(branch, me.branch))
);

CREATE POLICY emp_payroll_update ON public.employees_master_payroll
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
);

CREATE POLICY emp_payroll_delete ON public.employees_master_payroll
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
);

COMMIT;
