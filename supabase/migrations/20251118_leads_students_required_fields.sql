-- Enforce required fields on leads and dashboard_students, and add lead → student linkage
begin;

-- 1) Extend leads table with detailed fields
alter table if exists public.leads
  add column if not exists full_name text,
  add column if not exists father_name text,
  add column if not exists cnic text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists dob date,
  add column if not exists service_name text,
  add column if not exists branch text,
  add column if not exists lead_date date,
  add column if not exists converted_to_student_id text;

-- Backfill/normalize leads data for NOT NULL columns
update public.leads
  set full_name = coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
    'UNKNOWN LEAD'
  )
where full_name is null or trim(full_name) = '';

update public.leads set father_name = coalesce(father_name, '') where father_name is null;
update public.leads set cnic = coalesce(cnic, '') where cnic is null;
update public.leads set phone = coalesce(phone, '') where phone is null;
update public.leads set email = coalesce(email, '') where email is null;

update public.leads set lead_date = coalesce(lead_date, now()::date) where lead_date is null;

-- Lead → dashboard_students linkage (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'leads'
      AND constraint_name = 'leads_converted_to_student_fk'
  ) THEN
    ALTER TABLE IF EXISTS public.leads
      ADD CONSTRAINT leads_converted_to_student_fk
      FOREIGN KEY (converted_to_student_id) REFERENCES public.dashboard_students(id);
  END IF;
END $$;

-- Relax and recreate status check constraint to include "confirmed" (idempotent)
DO $$
BEGIN
  -- Drop existing constraint by name if present (works whether it was auto-named or added previously)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND conname = 'leads_status_check'
  ) THEN
    ALTER TABLE public.leads DROP CONSTRAINT leads_status_check;
  END IF;

  -- Recreate with the expanded set including 'confirmed'
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_status_check
    CHECK (status IN ('new','documentation','university','visa','enrolled','rejected','confirmed'));
END $$;

-- Apply NOT NULL constraints on leads core identity fields
alter table public.leads
  alter column full_name set not null,
  alter column father_name set not null,
  alter column cnic set not null,
  alter column phone set not null,
  alter column email set not null;

-- 2) Enforce required fields on dashboard_students
alter table if exists public.dashboard_students
  alter column father_name set default '',
  alter column phone set default '',
  alter column email set default '',
  alter column cnic set default '';

update public.dashboard_students
  set father_name = coalesce(father_name, ''),
      phone = coalesce(phone, ''),
      email = coalesce(email, ''),
      cnic = coalesce(cnic, '')
  where father_name is null
     or phone is null
     or email is null
     or cnic is null;

alter table if exists public.dashboard_students
  alter column father_name set not null,
  alter column phone set not null,
  alter column email set not null,
  alter column cnic set not null;

commit;

