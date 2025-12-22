-- Drop legacy universities_*_superadmin policies that rely on is_superadmin()
-- and can cause recursive RLS evaluation ("stack depth limit exceeded").
-- Keep the simpler universities_auth policy for authenticated users.
--
-- This migration is idempotent and safe to re-run.

begin;

-- 1) Drop old superadmin-only RLS policies on public.universities (if they exist)
DROP POLICY IF EXISTS universities_sel_superadmin ON public.universities;
DROP POLICY IF EXISTS universities_ins_superadmin ON public.universities;
DROP POLICY IF EXISTS universities_upd_superadmin ON public.universities;
DROP POLICY IF EXISTS universities_del_superadmin ON public.universities;

-- 2) Ensure the broad authenticated policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'universities'
      AND policyname = 'universities_auth'
  ) THEN
    CREATE POLICY universities_auth ON public.universities
      FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

commit;

