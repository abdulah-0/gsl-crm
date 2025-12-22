-- Fix RLS policy for application_history inserts so trigger can set comment_by
-- and allow super/admin/assigned handlers to insert

begin;

-- Drop old insert policy if it exists
drop policy if exists application_history_insert on public.application_history;

-- New insert policy: allow
--  - super admins
--  - admins
--  - assigned case handler (matched via dashboard_cases.case_number & employee email)
create policy application_history_insert on public.application_history
  for insert
  with check (
    auth.role() = 'authenticated'
    and (
      public.is_super()
      or public.is_admin()
      or exists (
        select 1
        from public.dashboard_cases c
        where c.case_number = new.case_number
          and coalesce(c.employee, '') = public.jwt_email()
      )
    )
  );

commit;

