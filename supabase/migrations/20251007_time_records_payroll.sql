-- Branches, Time Records, and Payroll schema with branch-aware RLS

-- 0) branches reference (optional)
CREATE TABLE IF NOT EXISTS public.branches (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS branches_select ON public.branches;
CREATE POLICY branches_select ON public.branches FOR SELECT USING (auth.role() = 'authenticated');

-- 1) time_records
CREATE TABLE IF NOT EXISTS public.time_records (
  id bigserial PRIMARY KEY,
  employee_email text NOT NULL,
  work_date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  hours numeric,
  overtime numeric,
  branch text,
  created_at timestamptz DEFAULT now()
);

-- auto set branch from dashboard_users if NULL
CREATE OR REPLACE FUNCTION public.time_records_set_branch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch IS NULL THEN
    SELECT du.branch INTO NEW.branch
    FROM public.dashboard_users du
    WHERE du.email = NEW.employee_email
    LIMIT 1;
  END IF;
  RETURN NEW;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname='time_records_set_branch_trg' AND n.nspname='public' AND c.relname='time_records'
  ) THEN
    CREATE TRIGGER time_records_set_branch_trg
    BEFORE INSERT ON public.time_records
    FOR EACH ROW EXECUTE FUNCTION public.time_records_set_branch();
  END IF;
END$$;

ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_records_select ON public.time_records;
DROP POLICY IF EXISTS time_records_insert ON public.time_records;
DROP POLICY IF EXISTS time_records_update ON public.time_records;
DROP POLICY IF EXISTS time_records_delete ON public.time_records;

-- SELECT: super all; admin same branch; others own records
CREATE POLICY time_records_select ON public.time_records
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch) OR
    employee_email = auth.email()
  )
);

-- INSERT/UPDATE/DELETE: only super or admin of same branch
CREATE POLICY time_records_insert ON public.time_records
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = COALESCE(branch, me.branch))
);

CREATE POLICY time_records_update ON public.time_records
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
);

CREATE POLICY time_records_delete ON public.time_records
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
);

-- 2) payroll tables
CREATE TABLE IF NOT EXISTS public.payroll_batches (
  id bigserial PRIMARY KEY,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  branch text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id bigserial PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES public.payroll_batches(id) ON DELETE CASCADE,
  employee_email text NOT NULL,
  base_salary numeric,
  working_days int,
  leave_days int,
  payable_amount numeric,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS payroll_batches_select ON public.payroll_batches;
DROP POLICY IF EXISTS payroll_batches_insert ON public.payroll_batches;
DROP POLICY IF EXISTS payroll_batches_update ON public.payroll_batches;
DROP POLICY IF EXISTS payroll_batches_delete ON public.payroll_batches;

DROP POLICY IF EXISTS payroll_items_select ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_insert ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_update ON public.payroll_items;
DROP POLICY IF EXISTS payroll_items_delete ON public.payroll_items;

-- Batches: super all; admin own branch; others: no direct access
CREATE POLICY payroll_batches_select ON public.payroll_batches
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
  )
);

CREATE POLICY payroll_batches_insert ON public.payroll_batches
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = COALESCE(branch, me.branch))
);

CREATE POLICY payroll_batches_update ON public.payroll_batches
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
);

CREATE POLICY payroll_batches_delete ON public.payroll_batches
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch=branch)
);

-- Items: super all; admin own branch (via join); employees can view their own items
CREATE POLICY payroll_items_select ON public.payroll_items
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
    EXISTS (
      SELECT 1 FROM public.dashboard_users me
      JOIN public.payroll_batches b ON b.id = payroll_items.batch_id
      WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = b.branch
    ) OR
    employee_email = auth.email()
  )
);

CREATE POLICY payroll_items_insert ON public.payroll_items
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    JOIN public.payroll_batches b ON b.id = batch_id
    WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = COALESCE((SELECT branch FROM public.payroll_batches WHERE id = batch_id), me.branch)
  )
);

CREATE POLICY payroll_items_update ON public.payroll_items
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    JOIN public.payroll_batches b ON b.id = payroll_items.batch_id
    WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = b.branch
  )
);

CREATE POLICY payroll_items_delete ON public.payroll_items
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.dashboard_users me WHERE me.email=auth.email() AND lower(me.role) LIKE '%super%') OR
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    JOIN public.payroll_batches b ON b.id = payroll_items.batch_id
    WHERE me.email=auth.email() AND lower(me.role) LIKE '%admin%' AND me.branch = b.branch
  )
);

