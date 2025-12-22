-- Add JSONB column to store Student Information Form data per case
begin;

alter table if exists public.dashboard_cases
  add column if not exists student_info jsonb not null default '{}'::jsonb;

-- Optional: add a generated column for quick search of student's name (if needed later)
-- alter table public.dashboard_cases add column if not exists student_name text;
-- create index if not exists idx_dashboard_cases_student_name on public.dashboard_cases (lower(student_name));

commit;

