-- Leaves table for employee leave requests and tracking
create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  type text not null check (type in ('Sick','Remote','Vacation')),
  start_date date not null,
  end_date date not null,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  reason text,
  created_at timestamptz not null default now(),
  created_by text
);

alter table public.leaves enable row level security;

-- Everyone authenticated can read
create policy if not exists leaves_select on public.leaves
  for select
  using ( auth.role() = 'authenticated' );

-- Insert: Admin/Super can insert for anyone; Others can only insert for themselves
create policy if not exists leaves_insert_admin on public.leaves
  for insert
  with check (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
    or employee_email = auth.email()
  );

-- Update/Delete: Only Admin/Super
create policy if not exists leaves_update_admin on public.leaves
  for update
  using (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
  );

create policy if not exists leaves_delete_admin on public.leaves
  for delete
  using (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
  );

