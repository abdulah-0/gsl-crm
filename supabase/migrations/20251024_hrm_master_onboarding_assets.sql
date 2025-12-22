-- HRM Master: employees_master, employee_onboardings, employee_assets, employee_leave_balances
-- Extend leaves for approvals chain. Idempotent migration.

-- helper: ensure is_super() and jwt_email() exist (created earlier in 20251014_tasks_messenger_notifications.sql)
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((current_setting('request.jwt.claims', true)::jsonb->>'role') ilike '%admin%', false)
$$;

create or replace function public.is_hr()
returns boolean language sql stable as $$
  select coalesce((current_setting('request.jwt.claims', true)::jsonb->>'role') ilike '%hr%', false)
$$;


-- define missing helpers to make this migration self-contained
create or replace function public.is_super()
returns boolean language sql stable as $$
  select coalesce((current_setting('request.jwt.claims', true)::jsonb->>'role') ilike '%super%', false)
$$;

create or replace function public.jwt_email()
returns text language sql stable as $$
  select (current_setting('request.jwt.claims', true)::jsonb->>'email')::text
$$;

-- employees_master (final master record after approval)
create table if not exists public.employees_master (
  id bigserial primary key,
  employee_code text unique,
  email text unique not null,
  full_name text,
  father_name text,
  cnic_no text,
  personal_contact text,
  current_address text,
  gender text,
  marital_status text,
  date_of_birth date,
  blood_group text,
  qualification text,
  emergency_contact_name text,
  emergency_contact_no text,
  emergency_relationship text,
  bank_name text,
  account_title text,
  account_number text,
  -- Placement & Work
  designation text,
  branch text,
  reporting_manager_email text,
  work_email text,
  official_contact text,
  date_of_joining date,
  date_of_confirmation date,
  contract_end_date date,
  probation_end_date date,
  employment_type text,
  work_mode text,
  work_time_start time,
  work_time_end time,
  weekly_off_day text,
  job_description text,
  employment_status text default 'Active',
  -- Payroll & Financial
  basic_salary numeric,
  medical_allowance numeric,
  work_transportation numeric,
  other_allowances numeric,
  arrears numeric,
  bonus numeric,
  income_tax numeric,
  life_insurance numeric,
  health_insurance numeric,
  employee_loan numeric,
  lunch_deduction numeric,
  fin_pin text,
  advance_salary numeric,
  esb numeric,
  other_deductions numeric,
  payment_mode text,
  attachments jsonb, -- optional: CNIC, Photo, Resume, Certificates (urls)
  created_by text,
  created_at timestamptz default now(),
  updated_by text,
  updated_at timestamptz default now()
);

create index if not exists idx_employees_master_branch_email on public.employees_master(branch, email);

-- employee_code auto-fill after insert
create or replace function public.employees_master_set_code()
returns trigger language plpgsql as $$
begin
  if new.employee_code is null then
    update public.employees_master set employee_code = 'EMP-' || to_char(now(),'YYYY') || '-' || lpad(new.id::text, 5, '0') where id = new.id;
  end if;
  return new;
end;$$;

-- set branch from dashboard_users if null
create or replace function public.set_branch_from_email(p_email text)
returns text language sql stable as $$
  select (select branch from public.dashboard_users where email = p_email limit 1)
$$;

create or replace function public.employees_master_set_branch()
returns trigger language plpgsql as $$
begin
  if new.branch is null then
    new.branch := public.set_branch_from_email(new.email);
  end if;
  new.updated_at := now();
  return new;
end;$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'employees_master_set_code_trg') then
    create trigger employees_master_set_code_trg after insert on public.employees_master for each row execute function public.employees_master_set_code();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'employees_master_set_branch_trg') then
    create trigger employees_master_set_branch_trg before insert or update on public.employees_master for each row execute function public.employees_master_set_branch();
  end if;
end $$;

alter table public.employees_master enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='employees_master' and policyname='employees_master_select') then
    create policy employees_master_select on public.employees_master for select using (
      public.is_super() or public.is_admin() or public.is_hr() or email = public.jwt_email()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='employees_master' and policyname='employees_master_insert') then
    create policy employees_master_insert on public.employees_master for insert with check (
      public.is_super() or public.is_hr()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='employees_master' and policyname='employees_master_update') then
    create policy employees_master_update on public.employees_master for update using (
      public.is_super() or public.is_hr()
    ) with check (
      public.is_super() or public.is_hr()
    );
  end if;
end $$;

-- employee_onboardings (initiation -> submission -> verification -> approval)
create table if not exists public.employee_onboardings (
  id bigserial primary key,
  secure_token text unique,
  status text default 'Initiated', -- Initiated, Submitted, Verified, Approved, Rejected
  candidate_email text not null,
  branch text,
  created_by text, -- HR initiator
  created_at timestamptz default now(),
  submitted_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  -- personal
  full_name text,
  father_name text,
  cnic_no text,
  personal_contact text,
  current_address text,
  gender text,
  marital_status text,
  date_of_birth date,
  blood_group text,
  qualification text,
  emergency_contact_name text,
  emergency_contact_no text,
  emergency_relationship text,
  -- bank
  bank_name text,
  account_title text,
  account_number text,
  -- work
  designation text,
  reporting_manager_email text,
  work_email text,
  official_contact text,
  date_of_joining date,
  employment_type text,
  work_mode text,
  work_time_start time,
  work_time_end time,
  weekly_off_day text,
  job_description text,
  attachments jsonb
);

create index if not exists idx_employee_onboardings_email on public.employee_onboardings(candidate_email, status);

create or replace function public.employee_onboardings_set_branch()
returns trigger language plpgsql as $$
begin
  if new.branch is null then
    new.branch := public.set_branch_from_email(coalesce(new.created_by, new.candidate_email));
  end if;
  return new;
end;$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='employee_onboardings_set_branch_trg') then
    create trigger employee_onboardings_set_branch_trg before insert on public.employee_onboardings for each row execute function public.employee_onboardings_set_branch();
  end if;
end $$;

alter table public.employee_onboardings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='employee_onboardings' and policyname='employee_onboardings_select') then
    create policy employee_onboardings_select on public.employee_onboardings for select using (
      public.is_super() or public.is_hr() or (candidate_email = public.jwt_email())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='employee_onboardings' and policyname='employee_onboardings_insert') then
    create policy employee_onboardings_insert on public.employee_onboardings for insert with check (
      public.is_super() or public.is_hr()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='employee_onboardings' and policyname='employee_onboardings_update') then
    create policy employee_onboardings_update on public.employee_onboardings for update using (
      public.is_super() or public.is_hr() or (candidate_email = public.jwt_email() and status in ('Initiated','Submitted'))
    ) with check (
      public.is_super() or public.is_hr() or (candidate_email = public.jwt_email() and status in ('Initiated','Submitted'))
    );
  end if;
end $$;

-- employee_assets
create table if not exists public.employee_assets (
  id bigserial primary key,
  asset_id text,
  employee_email text not null,
  asset_category text,
  asset_name text,
  brand_model text,
  serial_imei text,
  quantity int,
  issued_date date,
  issued_by text,
  condition_at_issuance text,
  return_status text,
  actual_return_date date,
  condition_on_return text,
  remarks text,
  approved_by text,
  acknowledgement boolean,
  branch text,
  created_at timestamptz default now()
);

create index if not exists idx_employee_assets_email on public.employee_assets(employee_email, branch);

create or replace function public.employee_assets_set_branch()
returns trigger language plpgsql as $$
begin
  if new.branch is null then
    new.branch := public.set_branch_from_email(new.employee_email);
  end if;
  return new;
end;$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='employee_assets_set_branch_trg') then
    create trigger employee_assets_set_branch_trg before insert on public.employee_assets for each row execute function public.employee_assets_set_branch();
  end if;
end $$;

alter table public.employee_assets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='employee_assets' and policyname='employee_assets_select') then
    create policy employee_assets_select on public.employee_assets for select using (
      public.is_super() or public.is_hr() or public.is_admin() or employee_email = public.jwt_email()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='employee_assets' and policyname='employee_assets_insupd') then
    create policy employee_assets_insupd on public.employee_assets for all using (
      public.is_super() or public.is_hr() or public.is_admin()
    ) with check (
      public.is_super() or public.is_hr() or public.is_admin()
    );
  end if;
end $$;

-- employee_leave_balances
create table if not exists public.employee_leave_balances (
  id bigserial primary key,
  employee_email text unique not null,
  branch text,
  cl_entitlement int default 0,
  cl_availed int default 0,
  sl_entitlement int default 0,
  sl_availed int default 0,
  al_entitlement int default 0,
  al_availed int default 0,
  updated_at timestamptz default now()
);

create index if not exists idx_employee_leave_balances_branch on public.employee_leave_balances(branch);

alter table public.employee_leave_balances enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='employee_leave_balances' and policyname='elb_select') then
    create policy elb_select on public.employee_leave_balances for select using (
      public.is_super() or public.is_hr() or public.is_admin() or employee_email = public.jwt_email()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='employee_leave_balances' and policyname='elb_insupd') then
    create policy elb_insupd on public.employee_leave_balances for all using (
      public.is_super() or public.is_hr()
    ) with check (
      public.is_super() or public.is_hr()
    );
  end if;
end $$;

-- Extend leaves table for approvals & type alignment (CL/SL/AL)
-- add columns if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='leave_type') THEN
    ALTER TABLE public.leaves ADD COLUMN leave_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='manager_approved_by') THEN
    ALTER TABLE public.leaves ADD COLUMN manager_approved_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='manager_approved_at') THEN
    ALTER TABLE public.leaves ADD COLUMN manager_approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='hr_approved_by') THEN
    ALTER TABLE public.leaves ADD COLUMN hr_approved_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='hr_approved_at') THEN
    ALTER TABLE public.leaves ADD COLUMN hr_approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='ceo_approved_by') THEN
    ALTER TABLE public.leaves ADD COLUMN ceo_approved_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leaves' AND column_name='ceo_approved_at') THEN
    ALTER TABLE public.leaves ADD COLUMN ceo_approved_at timestamptz;
  END IF;
END $$;

-- Trigger: when a leave becomes Approved, update availed in balances
create or replace function public.leaves_after_update_update_balance()
returns trigger language plpgsql as $$
declare days int;
declare lt text;
begin
  if new.status = 'Approved' and (old.status is distinct from 'Approved') then
    lt := coalesce(new.leave_type, new.type);
    if new.start_date is not null and new.end_date is not null then
      days := 1 + (new.end_date::date - new.start_date::date);
    else
      days := 1;
    end if;
    insert into public.employee_leave_balances(employee_email, branch)
      values (new.employee_email, new.branch) on conflict (employee_email) do nothing;
    if lt ilike 'CL%' then
      update public.employee_leave_balances set cl_availed = cl_availed + greatest(days,0), updated_at = now() where employee_email = new.employee_email;
    elsif lt ilike 'SL%' then
      update public.employee_leave_balances set sl_availed = sl_availed + greatest(days,0), updated_at = now() where employee_email = new.employee_email;
    elsif lt ilike 'AL%' then
      update public.employee_leave_balances set al_availed = al_availed + greatest(days,0), updated_at = now() where employee_email = new.employee_email;
    end if;
  end if;
  return new;
end;$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='leaves_after_update_update_balance_trg') then
    create trigger leaves_after_update_update_balance_trg after update on public.leaves for each row execute function public.leaves_after_update_update_balance();
  end if;
end $$;

