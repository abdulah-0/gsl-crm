-- dashboard_services schema for Products & Services
-- Creates table, trigger for updated_at, indexes, and basic RLS policies.

begin;

create table if not exists public.dashboard_services (
  id text primary key,
  name text not null,
  type text,
  description text,
  price numeric(12,2), -- Rs
  duration_weeks integer check (duration_weeks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dashboard_services is 'Product & service offerings (e.g., IELTS, TOEFL, courses).';
comment on column public.dashboard_services.id is 'App-generated like SVXXXXXXXX';
comment on column public.dashboard_services.price is 'Price in Rs';
comment on column public.dashboard_services.duration_weeks is 'Duration in weeks';

-- Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_dashboard_services on public.dashboard_services;
create trigger set_updated_at_dashboard_services
before update on public.dashboard_services
for each row execute function public.set_updated_at();

-- Helpful indexes for filtering
create index if not exists idx_dashboard_services_type on public.dashboard_services(type);
create index if not exists idx_dashboard_services_price on public.dashboard_services(price);
create index if not exists idx_dashboard_services_duration on public.dashboard_services(duration_weeks);
-- Optional uniqueness on name (case-insensitive). Comment out if duplicates are allowed.
create unique index if not exists uq_dashboard_services_name on public.dashboard_services (lower(name));

-- Row Level Security: allow authenticated users to read and manage.
-- Tighten these policies later if you implement admin-only editing.
alter table public.dashboard_services enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='dashboard_services' and policyname='services_read_authenticated'
  ) then
    create policy services_read_authenticated on public.dashboard_services
      for select to authenticated using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='dashboard_services' and policyname='services_write_authenticated'
  ) then
    create policy services_write_authenticated on public.dashboard_services
      for insert to authenticated with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='dashboard_services' and policyname='services_update_authenticated'
  ) then
    create policy services_update_authenticated on public.dashboard_services
      for update to authenticated using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='dashboard_services' and policyname='services_delete_authenticated'
  ) then
    create policy services_delete_authenticated on public.dashboard_services
      for delete to authenticated using (true);
  end if;
end $$;

commit;

-- Optional seed examples (uncomment to insert initial services)
-- insert into public.dashboard_services (id, name, type, description, price, duration_weeks)
-- values
--   ('SV00000001','IELTS','Test Prep','International English Language Testing System', 45000, 8),
--   ('SV00000002','TOEFL','Test Prep','Test of English as a Foreign Language', 42000, 8),
--   ('SV00000003','Spoken English','Course','Improve speaking and communication skills', 30000, 6);

