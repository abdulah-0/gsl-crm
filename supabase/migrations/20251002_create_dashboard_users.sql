-- Application-level users table for RBAC (separate from Supabase auth).
-- Stores name, email, role, status, and allowed tabs/features permissions.

begin;

create table if not exists public.dashboard_users (
  id text primary key,
  full_name text not null,
  email text not null unique,
  role text not null, -- e.g., 'Super Admin', 'Admin', 'Counsellor', 'Staff'
  status text not null default 'Active', -- 'Active' | 'Inactive'
  permissions jsonb not null default '[]'::jsonb, -- array of allowed tab ids: ['dashboard','students',...]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dashboard_users is 'RBAC user registry with per-user sidebar/tab permissions';

-- Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists set_updated_at_dashboard_users on public.dashboard_users;
create trigger set_updated_at_dashboard_users
before update on public.dashboard_users
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_dashboard_users_email on public.dashboard_users (lower(email));
create index if not exists idx_dashboard_users_role on public.dashboard_users (role);
create index if not exists idx_dashboard_users_status on public.dashboard_users (status);

-- RLS: allow authenticated users to read; writes currently open to authenticated (tighten later for super admin-only writes)
alter table public.dashboard_users enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_select_auth') then
    create policy rbac_users_select_auth on public.dashboard_users for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_insert_auth') then
    create policy rbac_users_insert_auth on public.dashboard_users for insert to authenticated with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_update_auth') then
    create policy rbac_users_update_auth on public.dashboard_users for update to authenticated using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_delete_auth') then
    create policy rbac_users_delete_auth on public.dashboard_users for delete to authenticated using (true);
  end if;
end $$;

commit;

