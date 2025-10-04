-- GSL CRM - One-time idempotent setup script for Supabase (creates missing objects only)
-- Safe to run multiple times. Uses IF NOT EXISTS and additive ALTERs.

begin;

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Utility: updated_at trigger function (shared)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

-- 2) RBAC: Application Users
create table if not exists public.dashboard_users (
  id text primary key,
  full_name text not null,
  email text not null unique,
  role text not null,
  status text not null default 'Active',
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.dashboard_users is 'RBAC user registry with per-user sidebar/tab permissions';

create index if not exists idx_dashboard_users_email on public.dashboard_users (lower(email));
create index if not exists idx_dashboard_users_role on public.dashboard_users (role);
create index if not exists idx_dashboard_users_status on public.dashboard_users (status);

drop trigger if exists set_updated_at_dashboard_users on public.dashboard_users;
create trigger set_updated_at_dashboard_users before update on public.dashboard_users
for each row execute function public.set_updated_at();

alter table public.dashboard_users enable row level security;
-- Allow authenticated read/write (tighten later if needed)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_select_auth') then
    create policy rbac_users_select_auth on public.dashboard_users for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_insert_auth') then
    create policy rbac_users_insert_auth on public.dashboard_users for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_update_auth') then
    create policy rbac_users_update_auth on public.dashboard_users for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_users' and policyname='rbac_users_delete_auth') then
    create policy rbac_users_delete_auth on public.dashboard_users for delete to authenticated using (true);
  end if;
end $$;

-- 3) Products & Services
create table if not exists public.dashboard_services (
  id text primary key,
  name text not null,
  type text,
  description text,
  price numeric(12,2),
  duration_weeks integer check (duration_weeks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_dashboard_services_name on public.dashboard_services (lower(name));
create index if not exists idx_dashboard_services_type on public.dashboard_services(type);
create index if not exists idx_dashboard_services_price on public.dashboard_services(price);
create index if not exists idx_dashboard_services_duration on public.dashboard_services(duration_weeks);

drop trigger if exists set_updated_at_dashboard_services on public.dashboard_services;
create trigger set_updated_at_dashboard_services before update on public.dashboard_services
for each row execute function public.set_updated_at();

alter table public.dashboard_services enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_services' and policyname='services_select_auth') then
    create policy services_select_auth on public.dashboard_services for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_services' and policyname='services_write_auth') then
    create policy services_write_auth on public.dashboard_services for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 4) Students (dashboard)
create table if not exists public.dashboard_students (
  id text primary key,                -- e.g., STxxxxxxxx
  program_title text,                 -- course/service name
  batch_no text,
  full_name text not null,
  father_name text,
  phone text,
  email text,
  cnic text,
  dob text,
  city text,
  reference text,
  status text not null default 'Active' check (status in ('Active','Completed','Withdrawn')),
  photo_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_dashboard_students_program on public.dashboard_students(program_title);
create index if not exists idx_dashboard_students_batch on public.dashboard_students(batch_no);
create index if not exists idx_dashboard_students_status on public.dashboard_students(status);
create index if not exists idx_dashboard_students_archived on public.dashboard_students(archived);

drop trigger if exists set_updated_at_dashboard_students on public.dashboard_students;
create trigger set_updated_at_dashboard_students before update on public.dashboard_students
for each row execute function public.set_updated_at();

alter table public.dashboard_students enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_students' and policyname='students_select_auth') then
    create policy students_select_auth on public.dashboard_students for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_students' and policyname='students_write_auth') then
    create policy students_write_auth on public.dashboard_students for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 4a) Student academics
create table if not exists public.dashboard_student_academics (
  id bigint generated by default as identity primary key,
  student_id text not null references public.dashboard_students(id) on delete cascade,
  serial integer not null,
  degree_name text,
  grade text,
  year text,
  institute text
);
create index if not exists idx_student_academics_student on public.dashboard_student_academics(student_id);

alter table public.dashboard_student_academics enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_student_academics' and policyname='acad_select_auth') then
    create policy acad_select_auth on public.dashboard_student_academics for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_student_academics' and policyname='acad_write_auth') then
    create policy acad_write_auth on public.dashboard_student_academics for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 4b) Student experiences
create table if not exists public.dashboard_student_experiences (
  id bigint generated by default as identity primary key,
  student_id text not null references public.dashboard_students(id) on delete cascade,
  serial integer not null,
  org text,
  designation text,
  period text
);
create index if not exists idx_student_experiences_student on public.dashboard_student_experiences(student_id);

alter table public.dashboard_student_experiences enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_student_experiences' and policyname='exp_select_auth') then
    create policy exp_select_auth on public.dashboard_student_experiences for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_student_experiences' and policyname='exp_write_auth') then
    create policy exp_write_auth on public.dashboard_student_experiences for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 5) Teachers & Assignments
create table if not exists public.dashboard_teachers (
  id text primary key,
  full_name text not null,
  email text not null unique,
  phone text,
  cnic text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_dashboard_teachers on public.dashboard_teachers;
create trigger set_updated_at_dashboard_teachers before update on public.dashboard_teachers
for each row execute function public.set_updated_at();

create table if not exists public.dashboard_teacher_assignments (
  id bigint generated by default as identity primary key,
  teacher_id text not null references public.dashboard_teachers(id) on delete cascade,
  service_id text references public.dashboard_services(id) on delete set null,
  service_name text,
  batch_no text,
  created_at timestamptz not null default now()
);
create index if not exists idx_teacher_assignments_teacher on public.dashboard_teacher_assignments(teacher_id);
create index if not exists idx_teacher_assignments_service on public.dashboard_teacher_assignments(service_id);

alter table public.dashboard_teachers enable row level security;
alter table public.dashboard_teacher_assignments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_teachers' and policyname='teachers_select_auth') then
    create policy teachers_select_auth on public.dashboard_teachers for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_teachers' and policyname='teachers_write_auth') then
    create policy teachers_write_auth on public.dashboard_teachers for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_teacher_assignments' and policyname='teacher_assign_select_auth') then
    create policy teacher_assign_select_auth on public.dashboard_teacher_assignments for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_teacher_assignments' and policyname='teacher_assign_write_auth') then
    create policy teacher_assign_write_auth on public.dashboard_teacher_assignments for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 5a) Attendance (per student per day)
create table if not exists public.dashboard_attendance (
  id bigint generated by default as identity primary key,
  teacher_id text not null references public.dashboard_teachers(id) on delete cascade,
  student_id text not null references public.dashboard_students(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Late')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(teacher_id, student_id, attendance_date)
);
create index if not exists idx_attendance_teacher_date on public.dashboard_attendance(teacher_id, attendance_date);
create index if not exists idx_attendance_student_date on public.dashboard_attendance(student_id, attendance_date);

drop trigger if exists set_updated_at_dashboard_attendance on public.dashboard_attendance;
create trigger set_updated_at_dashboard_attendance before update on public.dashboard_attendance
for each row execute function public.set_updated_at();

alter table public.dashboard_attendance enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_attendance' and policyname='attendance_select_auth') then
    create policy attendance_select_auth on public.dashboard_attendance for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_attendance' and policyname='attendance_write_auth') then
    create policy attendance_write_auth on public.dashboard_attendance for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 5b) Remarks
create table if not exists public.dashboard_student_remarks (
  id bigint generated by default as identity primary key,
  teacher_id text not null references public.dashboard_teachers(id) on delete cascade,
  student_id text not null references public.dashboard_students(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_dashboard_student_remarks on public.dashboard_student_remarks;
create trigger set_updated_at_dashboard_student_remarks before update on public.dashboard_student_remarks
for each row execute function public.set_updated_at();

alter table public.dashboard_student_remarks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_student_remarks' and policyname='remarks_select_auth') then
    create policy remarks_select_auth on public.dashboard_student_remarks for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_student_remarks' and policyname='remarks_write_auth') then
    create policy remarks_write_auth on public.dashboard_student_remarks for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 5c) Study Materials
create table if not exists public.dashboard_study_materials (
  id bigint generated by default as identity primary key,
  teacher_id text not null references public.dashboard_teachers(id) on delete cascade,
  service_id text references public.dashboard_services(id) on delete set null,
  batch_no text,
  title text not null,
  description text,
  file_url text,
  link_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_materials_teacher on public.dashboard_study_materials(teacher_id);
create index if not exists idx_materials_service on public.dashboard_study_materials(service_id);

drop trigger if exists set_updated_at_dashboard_study_materials on public.dashboard_study_materials;
create trigger set_updated_at_dashboard_study_materials before update on public.dashboard_study_materials
for each row execute function public.set_updated_at();

alter table public.dashboard_study_materials enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_study_materials' and policyname='materials_select_auth') then
    create policy materials_select_auth on public.dashboard_study_materials for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_study_materials' and policyname='materials_write_auth') then
    create policy materials_write_auth on public.dashboard_study_materials for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 6) Dashboard Cases (used across dashboards)
create table if not exists public.dashboard_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  title text not null,
  type text not null default 'Visa' check (type in ('Visa','Fee','CAS','Completed')),
  status text not null default 'Pending' check (status in ('Pending','In Progress','Completed')),
  branch text,
  employee text,
  all_tasks int not null default 0,
  active_tasks int not null default 0,
  assignees jsonb,
  created_at timestamptz not null default now()
);
-- Ensure student_info column exists
alter table if exists public.dashboard_cases
  add column if not exists student_info jsonb not null default '{}'::jsonb;

alter table public.dashboard_cases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_cases' and policyname='cases_select_auth') then
    create policy cases_select_auth on public.dashboard_cases for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='dashboard_cases' and policyname='cases_write_auth') then
    create policy cases_write_auth on public.dashboard_cases for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 7) Employees (used by Employees page)
create table if not exists public.employees (
  id bigserial primary key,
  user_id bigint unique,
  role_title text,
  joined_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at_employees on public.employees;
create trigger set_updated_at_employees before update on public.employees
for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees_select_auth') then
    create policy employees_select_auth on public.employees for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees_write_auth') then
    create policy employees_write_auth on public.employees for all to authenticated using (true) with check (true);
  end if;
end $$;

-- 8) Activity Log (generic)
create table if not exists public.activity_log (
  id bigserial primary key,
  actor_id uuid, -- optional link to auth.users.id; left free-form
  entity text not null,
  entity_id text,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_log' and policyname='activity_select_auth') then
    create policy activity_select_auth on public.activity_log for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_log' and policyname='activity_insert_auth') then
    create policy activity_insert_auth on public.activity_log for insert to authenticated with check (true);
  end if;
end $$;

-- 9) Finance: Vouchers
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  vtype text not null check (vtype in ('cash_in','cash_out','online','bank','transfer')),
  amount numeric(14,2) not null,
  branch text not null,
  occurred_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  description text,
  created_at timestamptz not null default now()
);

alter table public.vouchers enable row level security;
-- Broad policies so UI works; tighten later if needed
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vouchers' AND policyname='vch_sel_auth') THEN
    CREATE POLICY vch_sel_auth ON public.vouchers FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vouchers' AND policyname='vch_ins_auth') THEN
    CREATE POLICY vch_ins_auth ON public.vouchers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vouchers' AND policyname='vch_upd_auth') THEN
    CREATE POLICY vch_upd_auth ON public.vouchers FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vouchers' AND policyname='vch_del_auth') THEN
    CREATE POLICY vch_del_auth ON public.vouchers FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 10) Dashboard Tasks (small list for Dashboard page)
create table if not exists public.tasks (
  id bigserial primary key,
  title text not null,
  priority text,
  deadline timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='tasks_select_auth') then
    create policy tasks_select_auth on public.tasks for select to authenticated using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='tasks_write_auth') then
    create policy tasks_write_auth on public.tasks for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- 11) RPC stub used by Employees page (safe no-op; returns null id)
do $$
begin
  -- Create only if not exists; if exists with different signature/return type, keep it.
  begin
    create function public.app_create_user_local(
      p_name text,
      p_email text,
      p_password text,
      p_role text
    ) returns int language plpgsql as $fn$
    begin
      -- In production, implement in a secure backend/Edge Function.
      return null; -- keep employees.user_id nullable
    end;
    $fn$ security definer;
  exception when duplicate_function then
    -- leave existing implementation as-is
    null;
  end;
end $$;

commit;

