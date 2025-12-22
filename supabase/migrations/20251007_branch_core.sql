-- Multi-branch core: add branch columns and branch-aware RLS for leaves

-- 1) Ensure dashboard_users has branch column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dashboard_users' AND column_name='branch'
  ) THEN
    ALTER TABLE public.dashboard_users ADD COLUMN branch text;
  END IF;
END$$;

-- 2) Ensure leaves has branch column and backfill from employee's branch
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leaves' AND column_name='branch'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN branch text;
  END IF;

  -- Backfill leaves.branch from dashboard_users.branch
  UPDATE public.leaves l
  SET branch = du.branch
  FROM public.dashboard_users du
  WHERE du.email = l.employee_email
    AND l.branch IS NULL;
END$$;

-- 3) Trigger to auto-set branch on insert if not provided
CREATE OR REPLACE FUNCTION public.leaves_set_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
    WHERE t.tgname = 'leaves_set_branch_trg' AND n.nspname='public' AND c.relname='leaves'
  ) THEN
    CREATE TRIGGER leaves_set_branch_trg
    BEFORE INSERT ON public.leaves
    FOR EACH ROW EXECUTE FUNCTION public.leaves_set_branch();
  END IF;
END$$;

-- 4) RLS: branch-aware policies for leaves
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS leaves_select ON public.leaves;
DROP POLICY IF EXISTS leaves_insert_admin ON public.leaves;
DROP POLICY IF EXISTS leaves_update_admin ON public.leaves;
DROP POLICY IF EXISTS leaves_delete_admin ON public.leaves;

-- Select: authenticated can read if:
--  - Super* role: all
--  - Admin* role: only rows where row.branch = admin.branch
--  - Others: only rows where employee_email = auth.email()
CREATE POLICY leaves_select ON public.leaves
FOR SELECT
USING (
  auth.role() = 'authenticated' AND (
    EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND lower(me.role) LIKE '%super%'
    )
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND lower(me.role) LIKE '%admin%'
        AND me.branch = branch
    )
    OR employee_email = auth.email()
  )
);

-- Insert: allow if employee self (branch auto-set) OR admin in same branch OR super
CREATE POLICY leaves_insert ON public.leaves
FOR INSERT
WITH CHECK (
  (
    employee_email = auth.email()
  )
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%super%'
  )
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%admin%'
      AND me.branch = COALESCE(branch, me.branch)
  )
);

-- Update/Delete: only super OR admin in same branch
CREATE POLICY leaves_update ON public.leaves
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%super%'
  )
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%admin%'
      AND me.branch = branch
  )
);

CREATE POLICY leaves_delete ON public.leaves
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%super%'
  )
  OR EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%admin%'
      AND me.branch = branch
  )
);

