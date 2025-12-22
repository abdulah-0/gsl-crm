-- Leave notifications: auto-notify HR/Admin on request and employee on approval/rejection
-- Idempotent, branch-aware, compatible with existing notifications table

-- Helper functions is_super(), is_admin(), is_hr(), jwt_email() are defined in earlier migrations.

create or replace function public.notify_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email text;
  v_sender_id text;
  rec record;
begin
  -- Determine sender email (prefer leave.employee_email, fallback to jwt_email())
  v_sender_email := new.employee_email;
  if v_sender_email is null or v_sender_email = '' then
    v_sender_email := public.jwt_email();
  end if;

  -- Best-effort sender id from dashboard_users; fallback to email
  select id into v_sender_id
  from public.dashboard_users
  where email = v_sender_email
  limit 1;
  if v_sender_id is null then
    v_sender_id := v_sender_email;
  end if;

  -- Notify all Admin/HR/Super in same branch (or all branches for Super)
  for rec in
    select id, email, role, branch
    from public.dashboard_users
    where (lower(role) like '%admin%' or lower(role) like '%hr%' or lower(role) like '%super%')
      and (
        new.branch is null
        or branch is null
        or lower(branch) = lower(new.branch)
        or lower(role) like '%super%'
      )
  loop
    insert into public.notifications(recipient_email, title, body, meta, branch)
    values (
      rec.email,
      'New leave request',
      coalesce(v_sender_email, 'An employee') || ' requested leave from ' || coalesce(new.start_date::text, '?') || ' to ' || coalesce(new.end_date::text, '?'),
      jsonb_build_object(
        'notification_type', 'leave_request',
        'event', 'leave_requested',
        'reference_id', new.id,
        'sender_id', v_sender_id,
        'receiver_id', rec.id,
        'employee_email', v_sender_email,
        'branch', new.branch,
        'status', new.status
      ),
      new.branch
    );
  end loop;

  return new;
end;
$$;


create or replace function public.notify_leave_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text;
  v_actor_id text;
  v_receiver_id text;
  v_title text;
  v_body text;
begin
  -- Only act when status actually changes
  if coalesce(new.status, '') = coalesce(old.status, '') then
    return new;
  end if;

  -- Only notify on final decisions (case-insensitive, supports legacy lowercase statuses)
  if lower(new.status) not in ('approved', 'rejected') then
    return new;
  end if;

  v_actor_email := public.jwt_email();
  select id into v_actor_id from public.dashboard_users where email = v_actor_email limit 1;
  if v_actor_id is null then
    v_actor_id := v_actor_email;
  end if;

  select id into v_receiver_id from public.dashboard_users where email = new.employee_email limit 1;
  if v_receiver_id is null then
    v_receiver_id := new.employee_email;
  end if;

  if new.status = 'Approved' then
    v_title := 'Leave approved';
  else
    v_title := 'Leave rejected';
  end if;

  v_body := coalesce('Your leave request from ' || coalesce(new.start_date::text, '?') || ' to ' || coalesce(new.end_date::text, '?') || ' has been ' || lower(new.status), v_title);

  insert into public.notifications(recipient_email, title, body, meta, branch)
  values (
    new.employee_email,
    v_title,
    v_body,
    jsonb_build_object(
      'notification_type', 'leave_request',
      'event', case when new.status = 'Approved' then 'leave_approved' else 'leave_rejected' end,
      'reference_id', new.id,
      'sender_id', v_actor_id,
      'receiver_id', v_receiver_id,
      'employee_email', new.employee_email,
      'branch', new.branch,
      'old_status', old.status,
      'new_status', new.status
    ),
    new.branch
  );

  return new;
end;
$$;


do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'leaves_after_insert_notify_trg') then
    create trigger leaves_after_insert_notify_trg
    after insert on public.leaves
    for each row execute function public.notify_leave_request();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'leaves_after_update_notify_trg') then
    create trigger leaves_after_update_notify_trg
    after update on public.leaves
    for each row execute function public.notify_leave_status_change();
  end if;
end$$;

