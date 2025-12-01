-- Enable public lead form submissions
-- Allows anonymous users to submit leads via the public form
begin;

-- Create policy to allow anonymous (anon) users to INSERT leads
-- This enables the public lead form to work without authentication
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='leads' AND policyname='leads_public_insert'
  ) THEN
    CREATE POLICY leads_public_insert ON public.leads
      FOR INSERT TO anon
      WITH CHECK (true);
  END IF;
END $$;

commit;
