-- Add profile fields to dashboard_users for richer Profile page
begin;

-- Add columns if not exists
alter table if exists public.dashboard_users
  add column if not exists avatar_url text,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists job_title text,
  add column if not exists about text;

-- Helpful indexes
create index if not exists idx_dashboard_users_city on public.dashboard_users (city);
create index if not exists idx_dashboard_users_job_title on public.dashboard_users (job_title);

commit;

