-- Reports schema: unified reports table with JSON payload and role/type/status metadata
-- Safe to run multiple times (IF NOT EXISTS, policy guards)

begin;

-- Reuse shared trigger function if present; otherwise create
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

-- Main reports table
create table if not exists public.dashboard_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'class',                 -- Teacher: Class Report
    'student_performance',   -- Teacher: Student Performance Report
    'branch',                -- Admin: Branch/Department summary snapshot
    'employee_performance',  -- Admin: Employee performance snapshot
    'case_progress',         -- Counselor: Case progress update
    'custom'                 -- Super Admin: Custom/other
  )),
  role text not null,                              -- author role label (e.g., 'Teacher','Admin','Super Admin','Counselor')
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  author_email text not null,
  author_name text,
  author_uid uuid,                                 -- optional link to auth.users.id
  branch text,
  batch_no text,
  student_id text references public.dashboard_students(id) on delete set null,
  case_id uuid references public.dashboard_cases(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,      -- form fields, attachments, comments, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common filters
create index if not exists idx_reports_type on public.dashboard_reports(report_type);
create index if not exists idx_reports_role on public.dashboard_reports(role);
create index if not exists idx_reports_status on public.dashboard_reports(status);
create index if not exists idx_reports_author_email on public.dashboard_reports(lower(author_email));
create index if not exists idx_reports_created_at on public.dashboard_reports(created_at);
create index if not exists idx_reports_branch on public.dashboard_reports(branch);
create index if not exists idx_reports_batch on public.dashboard_reports(batch_no);

-- Trigger: maintain updated_at
drop trigger if exists set_updated_at_dashboard_reports on public.dashboard_reports;
create trigger set_updated_at_dashboard_reports before update on public.dashboard_reports
for each row execute function public.set_updated_at();

-- Row Level Security policies (broad to allow UI; can be tightened per org policy)
alter table public.dashboard_reports enable row level security;
-- Authenticated users can read all (so Admin/Super dashboards work)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='dashboard_reports' AND policyname='reports_select_auth'
  ) THEN
    CREATE POLICY reports_select_auth ON public.dashboard_reports FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  -- Anyone authenticated can insert (teachers/counselors/admins)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='dashboard_reports' AND policyname='reports_insert_auth'
  ) THEN
    CREATE POLICY reports_insert_auth ON public.dashboard_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  -- Allow updates by authenticated (UI will limit approving to Admin/Super)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='dashboard_reports' AND policyname='reports_update_auth'
  ) THEN
    CREATE POLICY reports_update_auth ON public.dashboard_reports FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  -- Optional: allow delete by authenticated (keep for cleanup/testing)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='dashboard_reports' AND policyname='reports_delete_auth'
  ) THEN
    CREATE POLICY reports_delete_auth ON public.dashboard_reports FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

commit;

