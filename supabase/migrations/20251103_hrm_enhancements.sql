-- HRM Enhancements Migration (2025-11-03)
-- Adds: batch number generator, invoices table, vouchers.uploaded_bill, dashboard_cases.student_id, optional user_permissions table

begin;

-- 1) Batch number sequence per year: BATCH-YYYY-XXX
create table if not exists public.batch_counters (
  yr int primary key,
  last_serial int not null default 0
);

create or replace function public.next_batch_number()
returns text language plpgsql as $$
declare
  y int := extract(year from now())::int;
  s int;
begin
  insert into public.batch_counters(yr, last_serial) values (y, 1)
  on conflict (yr) do update set last_serial = public.batch_counters.last_serial + 1
  returning last_serial into s;
  return 'BATCH-' || y::text || '-' || lpad(s::text, 3, '0');
end; $$;

-- Apply default on students.batch_no so it auto-generates when not provided
alter table if exists public.dashboard_students
  alter column batch_no set default public.next_batch_number();

-- 2) Invoices table (linked to students)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_code text unique,
  student_id text not null references public.dashboard_students(id) on delete cascade,
  registration_fee numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  discount_type text not null default 'flat' check (discount_type in ('flat','percent')),
  total_amount numeric(12,2) not null default 0,
  service_items jsonb not null default '[]'::jsonb,
  status text not null default 'Pending' check (status in ('Pending','Paid','Cancelled')),
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='inv_sel_auth') THEN
    CREATE POLICY inv_sel_auth ON public.invoices FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='inv_ins_auth') THEN
    CREATE POLICY inv_ins_auth ON public.invoices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='inv_upd_auth') THEN
    CREATE POLICY inv_upd_auth ON public.invoices FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 3) Vouchers: uploaded bill path (for Cash Out attachments)
alter table if exists public.vouchers
  add column if not exists uploaded_bill text;
create index if not exists idx_vouchers_uploaded_bill on public.vouchers((uploaded_bill is not null));

-- 4) Cases: link to student (optional)
alter table if exists public.dashboard_cases
  add column if not exists student_id text references public.dashboard_students(id) on delete set null;
create index if not exists idx_dashboard_cases_student on public.dashboard_cases(student_id);

-- 5) Optional: granular module access (VIEW vs CRUD)
create table if not exists public.user_permissions (
  user_email text not null,
  module text not null,
  access text not null check (access in ('VIEW','CRUD')),
  created_at timestamptz not null default now(),
  primary key (user_email, module)
);

alter table public.user_permissions enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions' AND policyname='up_sel_auth') THEN
    CREATE POLICY up_sel_auth ON public.user_permissions FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions' AND policyname='up_ins_auth') THEN
    CREATE POLICY up_ins_auth ON public.user_permissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions' AND policyname='up_upd_auth') THEN
    CREATE POLICY up_upd_auth ON public.user_permissions FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions' AND policyname='up_del_auth') THEN
    CREATE POLICY up_del_auth ON public.user_permissions FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

commit;

