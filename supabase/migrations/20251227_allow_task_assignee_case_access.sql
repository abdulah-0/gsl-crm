-- Allow staff members to view cases they are assigned to via tasks
-- This extends the existing branch-based RLS policy

BEGIN;

-- Drop and recreate the cases_select_branch policy to include task assignees
DROP POLICY IF EXISTS cases_select_branch ON public.dashboard_cases;

CREATE POLICY cases_select_branch ON public.dashboard_cases
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    -- Super admin or same branch access
    public.can_access_all_branches()
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users me
      WHERE me.email = auth.email()
        AND me.branch = branch
    )
    -- OR assigned to a task for this case
    OR EXISTS (
      SELECT 1 FROM public.dashboard_tasks t
      JOIN public.dashboard_users me ON me.id = t.assignee_id
      WHERE t.case_number = case_number
        AND me.email = auth.email()
    )
  )
);

COMMIT;
