
create sequence if not exists public.dashboard_case_number_seq;
alter table if exists public.dashboard_cases
  alter column case_number set default ('PN' || lpad(nextval('public.dashboard_case_number_seq')::text, 8, '0'));

create sequence if not exists public.dashboard_student_id_seq;
alter table if exists public.dashboard_students
  alter column id set default ('ST' || lpad(nextval('public.dashboard_student_id_seq')::text, 8, '0'));



