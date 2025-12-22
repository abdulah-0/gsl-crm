
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


-- Ensure employee_email column exists even if table pre-existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'employee_email'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN employee_email text;
  END IF;
  -- Set NOT NULL only if no NULLs present to avoid migration failure
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'employee_email'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.leaves WHERE employee_email IS NULL
  ) THEN
    ALTER TABLE public.leaves ALTER COLUMN employee_email SET NOT NULL;
  END IF;
END$$;

-- Everyone authenticated can read
drop policy if exists leaves_select on public.leaves;
create policy leaves_select on public.leaves
  for select
  using ( auth.role() = 'authenticated' );

-- Insert: Admin/Super can insert for anyone; Others can only insert for themselves
drop policy if exists leaves_insert_admin on public.leaves;
create policy leaves_insert_admin on public.leaves
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
drop policy if exists leaves_update_admin on public.leaves;
create policy leaves_update_admin on public.leaves
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

drop policy if exists leaves_delete_admin on public.leaves;
create policy leaves_delete_admin on public.leaves
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


