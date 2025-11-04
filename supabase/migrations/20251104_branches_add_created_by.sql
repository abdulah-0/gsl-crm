-- Ensure branches table has created_by column for older databases
-- Idempotent safe migration
begin;

alter table if exists public.branches
  add column if not exists created_by text;

-- Optional: ensure created_at exists as well (harmless if present)
alter table if exists public.branches
  add column if not exists created_at timestamptz not null default now();

commit;

