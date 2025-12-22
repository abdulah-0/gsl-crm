-- Info posts storage and access control
-- Creates info_posts table and RLS policies so only Admin/Super Admin can write; everyone can read.

-- Enable uuid generation if available
create extension if not exists pgcrypto;

create table if not exists public.info_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null check (type in ('image','video','text')),
  file_url text,
  text_content text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  created_by text
);

alter table public.info_posts enable row level security;

-- Everyone authenticated can read
create policy if not exists info_posts_select on public.info_posts
  for select
  using ( true );

-- Only Admin/Super Admin can insert
create policy if not exists info_posts_insert on public.info_posts
  for insert
  with check (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
  );

-- Only Admin/Super Admin can update
create policy if not exists info_posts_update on public.info_posts
  for update
  using (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
  )
  with check (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
  );

-- Only Admin/Super Admin can delete
create policy if not exists info_posts_delete on public.info_posts
  for delete
  using (
    exists (
      select 1 from public.dashboard_users du
      where du.email = auth.email()
        and lower(du.role) in (
          'admin','super admin','super_admin','super-admin','superadmin','superadministrator','super administrator'
        )
    )
  );

