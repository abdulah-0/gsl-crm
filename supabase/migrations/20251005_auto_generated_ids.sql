-- Auto-generate IDs for cases and students
begin;

-- Sequence and default for dashboard_cases.case_number (e.g., PN00000001)
create sequence if not exists public.dashboard_case_number_seq;
alter table if exists public.dashboard_cases
  alter column case_number set default ('PN' || lpad(nextval('public.dashboard_case_number_seq')::text, 8, '0'));

-- Sequence and default for dashboard_students.id (e.g., ST00000001)
create sequence if not exists public.dashboard_student_id_seq;
alter table if exists public.dashboard_students
  alter column id set default ('ST' || lpad(nextval('public.dashboard_student_id_seq')::text, 8, '0'));

commit;

