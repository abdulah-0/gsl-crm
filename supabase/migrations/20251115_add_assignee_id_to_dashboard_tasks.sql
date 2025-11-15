-- Add assignee_id to dashboard_tasks linked to dashboard_users
begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dashboard_tasks'
      and column_name = 'assignee_id'
  ) then
    alter table public.dashboard_tasks
      add column assignee_id text references public.dashboard_users(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_dashboard_tasks_assignee_id
  on public.dashboard_tasks(assignee_id);

commit;

