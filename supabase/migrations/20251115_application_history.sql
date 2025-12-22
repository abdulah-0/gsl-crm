-- Application history for dashboard cases
-- Tracks status/comment timeline per case and keeps dashboard_cases in sync.

begin;

create table if not exists public.application_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.dashboard_cases(id) on delete cascade,
  case_number text not null,
  details_timestamp timestamptz,
  comment text,
  status text not null,
  comment_by text,
  comment_by_name text,
  created_at timestamptz
);

-- Ensure status matches the 11-stage pipeline
do $$
begin
  begin
    alter table public.application_history
      drop constraint if exists application_history_status_chk;
  exception when undefined_object then
    null;
  end;

  alter table public.application_history
    add constraint application_history_status_chk
    check (status in (
      'Initial Stage','Offer Applied','Offer Received','Fee Paid','Interview',
      'CAS Applied','CAS Received','Visa Applied','Visa Received','Backout','Visa Rejected'
    ));
end$$;

create index if not exists idx_application_history_case_time
  on public.application_history(case_number, details_timestamp desc);

-- Defaults + backfill case_id/case_number + actor fields
create or replace function public.application_history_set_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.details_timestamp is null then
    new.details_timestamp := now();
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;

  if new.case_id is null and new.case_number is not null then
    select id into new.case_id
    from public.dashboard_cases
    where case_number = new.case_number
    limit 1;
  elsif new.case_number is null and new.case_id is not null then
    select case_number into new.case_number
    from public.dashboard_cases
    where id = new.case_id
    limit 1;
  end if;

  if (new.comment_by is null or new.comment_by = '') then
    new.comment_by := public.jwt_email();
  end if;

  if (new.comment_by_name is null or new.comment_by_name = '') then
    select full_name into new.comment_by_name
    from public.dashboard_users
    where email = new.comment_by
    limit 1;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'application_history_set_defaults_trg') then
    create trigger application_history_set_defaults_trg
      before insert on public.application_history
      for each row execute function public.application_history_set_defaults();
  end if;
end$$;

-- After insert: update dashboard_cases + notify Super Admins
create or replace function public.application_history_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_number text;
  v_branch text;
  v_actor_email text;
  v_actor_id text;
  rec record;
begin
  v_case_number := new.case_number;
  if v_case_number is null and new.case_id is not null then
    select case_number into v_case_number from public.dashboard_cases where id = new.case_id limit 1;
  end if;

  if v_case_number is not null then
    update public.dashboard_cases
      set stage = new.status,
          status = new.status
      where case_number = v_case_number;

    select branch into v_branch from public.dashboard_cases where case_number = v_case_number limit 1;
  end if;

  v_actor_email := coalesce(new.comment_by, public.jwt_email());
  select id into v_actor_id from public.dashboard_users where email = v_actor_email limit 1;
  if v_actor_id is null then
    v_actor_id := v_actor_email;
  end if;

  for rec in
    select id, email from public.dashboard_users where lower(role) like '%super%'
  loop
    insert into public.notifications(recipient_email, title, body, meta, branch)
    values (
      rec.email,
      'Application status updated',
      coalesce(v_case_number, 'Case') || ' updated to ' || new.status,
      jsonb_build_object(
        'notification_type', 'application_history',
        'event', 'application_update_added',
        'reference_id', new.id,
        'case_number', v_case_number,
        'status', new.status,
        'comment', new.comment,
        'sender_id', v_actor_id,
        'receiver_id', rec.id
      ),
      v_branch
    );
  end loop;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'application_history_after_insert_trg') then
    create trigger application_history_after_insert_trg
      after insert on public.application_history
      for each row execute function public.application_history_after_insert();
  end if;
end$$;

alter table public.application_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='application_history' and policyname='application_history_select') then
    create policy application_history_select on public.application_history
      for select using (
        auth.role() = 'authenticated' and (
          public.is_super() or public.is_admin() or
          comment_by = public.jwt_email() or
          exists (
            select 1 from public.dashboard_cases c
            where c.case_number = application_history.case_number
              and c.employee = public.jwt_email()
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename='application_history' and policyname='application_history_insert') then
    create policy application_history_insert on public.application_history
      for insert with check (
        auth.role() = 'authenticated' and (
          public.is_super() or public.is_admin() or comment_by = public.jwt_email()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename='application_history' and policyname='application_history_update') then
    create policy application_history_update on public.application_history
      for update using (
        auth.role() = 'authenticated' and (
          public.is_super() or public.is_admin() or comment_by = public.jwt_email()
        )
      ) with check (
        auth.role() = 'authenticated' and (
          public.is_super() or public.is_admin() or comment_by = public.jwt_email()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename='application_history' and policyname='application_history_delete') then
    create policy application_history_delete on public.application_history
      for delete using (
        auth.role() = 'authenticated' and (
          public.is_super() or public.is_admin() or comment_by = public.jwt_email()
        )
      );
  end if;
end$$;

commit;

