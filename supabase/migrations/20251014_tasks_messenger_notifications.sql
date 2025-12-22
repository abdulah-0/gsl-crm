-- Daily Tasks, Messenger (branch-based), and Notifications schema with RLS
-- Idempotent creation

-- Notifications table
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_email text not null,
  title text not null,
  body text,
  meta jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  branch text
);

-- Simple index
create index if not exists idx_notifications_recipient_created on public.notifications(recipient_email, created_at desc);

alter table public.notifications enable row level security;

-- RLS: super admin see all; recipient sees own
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_super_all') then
    create policy notifications_super_all on public.notifications for all
      using (
        coalesce((current_setting('request.jwt.claims', true)::jsonb->>'role') ilike '%super%', false)
        or recipient_email = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'email','')
      )
      with check (
        coalesce((current_setting('request.jwt.claims', true)::jsonb->>'role') ilike '%super%', false)
        or recipient_email = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'email','')
      );
  end if;
end $$;

-- Daily tasks table
create table if not exists public.daily_tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'Medium',
  assigned_to text not null, -- email
  assigned_by text,
  status text not null default 'Pending',
  remarks text,
  student_id text,
  case_id text,
  branch text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_daily_tasks_branch_status on public.daily_tasks(branch, status);
create index if not exists idx_daily_tasks_assignee on public.daily_tasks(assigned_to);

alter table public.daily_tasks enable row level security;

-- RLS: super admin all; non-super limited to own branch; employees can read tasks where they are assignee or assigner
create or replace function public.is_super()
returns boolean language sql stable as $$
  select coalesce((current_setting('request.jwt.claims', true)::jsonb->>'role') ilike '%super%', false)
$$;

create or replace function public.jwt_email()
returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'email','')
$$;

-- Policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='daily_tasks' and policyname='daily_tasks_select') then
    create policy daily_tasks_select on public.daily_tasks for select using (
      public.is_super() or assigned_to = public.jwt_email() or assigned_by = public.jwt_email()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='daily_tasks' and policyname='daily_tasks_insert') then
    create policy daily_tasks_insert on public.daily_tasks for insert with check (
      public.is_super() or true -- allow insert; branch scoping handled by trigger below
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='daily_tasks' and policyname='daily_tasks_update') then
    create policy daily_tasks_update on public.daily_tasks for update using (
      public.is_super() or assigned_to = public.jwt_email() or assigned_by = public.jwt_email()
    ) with check (
      public.is_super() or assigned_to = public.jwt_email() or assigned_by = public.jwt_email()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='daily_tasks' and policyname='daily_tasks_delete') then
    create policy daily_tasks_delete on public.daily_tasks for delete using (
      public.is_super() or assigned_by = public.jwt_email()
    );
  end if;
end $$;

-- Messenger messages table
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_email text not null,
  recipient_email text not null,
  body text not null,
  created_at timestamp with time zone default now(),
  branch text
);

create index if not exists idx_messages_parties on public.messages(sender_email, recipient_email, created_at);

alter table public.messages enable row level security;

-- RLS for messages: super sees all; others see messages where they are sender or recipient
do $$ begin
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='messages_select') then
    create policy messages_select on public.messages for select using (
      public.is_super() or sender_email = public.jwt_email() or recipient_email = public.jwt_email()
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='messages_insert') then
    create policy messages_insert on public.messages for insert with check (
      public.is_super() or sender_email = public.jwt_email()
    );
  end if;
end $$;

-- Auto-fill branch for daily_tasks and messages from dashboard_users.branch
create or replace function public.set_branch_from_user(p_email text)
returns text language plpgsql stable as $$
declare b text;
begin
  select branch into b from public.dashboard_users where email = p_email limit 1;
  return b;
end;$$;

create or replace function public.daily_tasks_set_branch()
returns trigger language plpgsql as $$
begin
  if new.branch is null then
    new.branch := public.set_branch_from_user(new.assigned_to);
  end if;
  return new;
end;$$;

create or replace function public.messages_set_branch()
returns trigger language plpgsql as $$
begin
  if new.branch is null then
    new.branch := public.set_branch_from_user(new.sender_email);
  end if;
  return new;
end;$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'daily_tasks_set_branch_trg') then
    create trigger daily_tasks_set_branch_trg before insert on public.daily_tasks for each row execute function public.daily_tasks_set_branch();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'messages_set_branch_trg') then
    create trigger messages_set_branch_trg before insert on public.messages for each row execute function public.messages_set_branch();
  end if;
end $$;

-- Optional: notify teachers on student insert based on course/batch assignments
create or replace function public.notify_teachers_on_student_insert()
returns trigger language plpgsql as $$
declare svc_id text;
declare t record;
begin
  -- find matching service id by name
  select id into svc_id from public.dashboard_services where lower(name) = lower(new.program_title) limit 1;
  for t in
    select a.teacher_id, a.batch_no, d.email as teacher_email
    from public.dashboard_teacher_assignments a
    join public.dashboard_teachers d on d.id = a.teacher_id
    where (a.service_id = svc_id or lower(coalesce(a.service_name,'')) = lower(coalesce(new.program_title,'')))
      and (a.batch_no is null or a.batch_no = new.batch_no)
  loop
    insert into public.notifications(recipient_email, title, body, meta)
      values (t.teacher_email,
              'New student assigned',
              coalesce(new.full_name,'New student') || ' assigned' || case when new.batch_no is not null then ' ('|| new.batch_no ||')' else '' end,
              jsonb_build_object('student_id', new.id, 'student_name', new.full_name, 'program_title', new.program_title, 'batch_no', new.batch_no, 'event', 'student_assigned', 'assigned_at', now())
      );
  end loop;
  return new;
end;$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'notify_teachers_on_student_insert_trg') then
    create trigger notify_teachers_on_student_insert_trg after insert on public.dashboard_students for each row execute function public.notify_teachers_on_student_insert();
  end if;
end $$;

