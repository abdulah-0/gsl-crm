-- Fix branches RLS to be case-insensitive on email match for Super Admin checks
-- Idempotent-ish: drop/recreate policies safely
begin;

-- Ensure table exists
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  branch_code text unique not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;

-- Drop existing policies if they exist (we'll recreate with case-insensitive email check)
drop policy if exists branches_insert_super on public.branches;
drop policy if exists branches_update_super on public.branches;
drop policy if exists branches_delete_super on public.branches;

-- Keep or create select policy (harmless if it already exists under same name)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='branches' AND policyname='branches_select_auth'
  ) THEN
    CREATE POLICY branches_select_auth ON public.branches FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Recreate write policies with lower(email) comparison
CREATE POLICY branches_insert_super ON public.branches FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE lower(me.email) = lower(auth.email())
      AND lower(me.role) LIKE '%super%'
  )
);

CREATE POLICY branches_update_super ON public.branches FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE lower(me.email) = lower(auth.email())
      AND lower(me.role) LIKE '%super%'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE lower(me.email) = lower(auth.email())
      AND lower(me.role) LIKE '%super%'
  )
);

CREATE POLICY branches_delete_super ON public.branches FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.dashboard_users me
    WHERE lower(me.email) = lower(auth.email())
      AND lower(me.role) LIKE '%super%'
  )
);

commit;

