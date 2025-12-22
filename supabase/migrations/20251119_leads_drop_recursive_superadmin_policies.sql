-- Drop legacy leads_*_superadmin policies that rely on is_superadmin() and
-- cause recursive RLS evaluation. Keep the simpler leads_auth policy.
--
-- This migration is idempotent and safe to re-run.

begin;

-- 1) Drop old superadmin-only RLS policies on public.leads (if they exist)
DROP POLICY IF EXISTS leads_sel_superadmin ON public.leads;
DROP POLICY IF EXISTS leads_ins_superadmin ON public.leads;
DROP POLICY IF EXISTS leads_upd_superadmin ON public.leads;
DROP POLICY IF EXISTS leads_del_superadmin ON public.leads;

-- 2) Ensure the broad authenticated policy exists (should already be created
--    by 20251118_leads_and_universities.sql, but we guard it here too)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'leads'
      AND policyname = 'leads_auth'
  ) THEN
    CREATE POLICY leads_auth ON public.leads
      FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

commit;

