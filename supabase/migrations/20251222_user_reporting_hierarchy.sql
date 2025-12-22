-- Add reporting hierarchy feature
-- Allows users to report to one or more supervisors

BEGIN;

-- Create user_reporting_hierarchy table
CREATE TABLE IF NOT EXISTS public.user_reporting_hierarchy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  reports_to_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  UNIQUE(user_email, reports_to_email)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_reporting_user_email ON public.user_reporting_hierarchy(user_email);
CREATE INDEX IF NOT EXISTS idx_user_reporting_reports_to ON public.user_reporting_hierarchy(reports_to_email);

-- Enable RLS
ALTER TABLE public.user_reporting_hierarchy ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only Super Admin can manage reporting hierarchy
DROP POLICY IF EXISTS user_reporting_select ON public.user_reporting_hierarchy;
DROP POLICY IF EXISTS user_reporting_insert ON public.user_reporting_hierarchy;
DROP POLICY IF EXISTS user_reporting_update ON public.user_reporting_hierarchy;
DROP POLICY IF EXISTS user_reporting_delete ON public.user_reporting_hierarchy;

CREATE POLICY user_reporting_select ON public.user_reporting_hierarchy
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    -- Super Admin can see all
    EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND lower(me.role) LIKE '%super%'
    )
    OR
    -- Users can see their own reporting relationships
    user_email = auth.email()
    OR
    -- Users can see who reports to them
    reports_to_email = auth.email()
  )
);

CREATE POLICY user_reporting_insert ON public.user_reporting_hierarchy
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%super%'
  )
);

CREATE POLICY user_reporting_update ON public.user_reporting_hierarchy
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%super%'
  )
);

CREATE POLICY user_reporting_delete ON public.user_reporting_hierarchy
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE me.email = auth.email()
      AND lower(me.role) LIKE '%super%'
  )
);

COMMIT;
