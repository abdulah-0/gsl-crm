-- Enhanced Accounts, Branches, Permissions, and Invoice Payments (2025-11-03)
-- Idempotent: uses IF NOT EXISTS and additive ALTERs only

begin;

-- Ensure extensions
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- 1) Invoices: add payment tracking fields
alter table if exists public.invoices
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists remaining_amount numeric(12,2) not null default 0,
  add column if not exists payment_status text not null default 'Unpaid' check (payment_status in ('Paid','Partially Paid','Unpaid')),
  add column if not exists due_date date;

create index if not exists idx_invoices_student on public.invoices(student_id);
create index if not exists idx_invoices_due_date on public.invoices(due_date);

-- 2) Branches master (universal branch list)
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  branch_code text unique not null,
  created_by text, -- email of creator
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;
-- Policies: everyone can read; only Super Admin can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='branches' AND policyname='branches_select_auth') THEN
    CREATE POLICY branches_select_auth ON public.branches FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='branches' AND policyname='branches_insert_super') THEN
    CREATE POLICY branches_insert_super ON public.branches FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.dashboard_users me
        WHERE me.email = auth.email() AND lower(me.role) like '%super%'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='branches' AND policyname='branches_update_super') THEN
    CREATE POLICY branches_update_super ON public.branches FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.dashboard_users me
        WHERE me.email = auth.email() AND lower(me.role) like '%super%'
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.dashboard_users me
        WHERE me.email = auth.email() AND lower(me.role) like '%super%'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='branches' AND policyname='branches_delete_super') THEN
    CREATE POLICY branches_delete_super ON public.branches FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM public.dashboard_users me
        WHERE me.email = auth.email() AND lower(me.role) like '%super%'
      )
    );
  END IF;
END $$;

-- 3) Permissions: add granular flags (keep legacy 'access' for compatibility)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_permissions' AND column_name='can_add'
  ) THEN
    ALTER TABLE public.user_permissions ADD COLUMN can_add boolean not null default false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_permissions' AND column_name='can_edit'
  ) THEN
    ALTER TABLE public.user_permissions ADD COLUMN can_edit boolean not null default false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_permissions' AND column_name='can_delete'
  ) THEN
    ALTER TABLE public.user_permissions ADD COLUMN can_delete boolean not null default false;
  END IF;
END $$;

create index if not exists idx_user_permissions_user on public.user_permissions(user_email);
create index if not exists idx_user_permissions_module on public.user_permissions(module);

-- 4) Due-date notifications for invoices
-- Existing notifications table: recipient_email, title, body, meta jsonb, read_at, created_at
-- Insert notifications on the due date for Unpaid/Partially Paid invoices
create or replace function public.notify_due_invoices()
returns void language plpgsql as $$
DECLARE
  rec record;
  st record;
BEGIN
  -- loop invoices due today that still need attention
  FOR rec IN
    SELECT i.id, i.student_id, i.total_amount, i.amount_paid, i.remaining_amount, i.due_date
    FROM public.invoices i
    WHERE i.due_date = current_date
      AND i.payment_status IN ('Unpaid','Partially Paid')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE (n.meta->>'event') = 'invoice_due'
          AND (n.meta->>'invoice_id') = i.id::text
      )
  LOOP
    -- fetch student info
    SELECT s.full_name, s.batch_no INTO st FROM public.dashboard_students s WHERE s.id = rec.student_id LIMIT 1;

    -- notify Admins + Supers + anyone with Accounts module permission
    FOR st IN
      (
        SELECT du.email AS email
        FROM public.dashboard_users du
        WHERE lower(du.role) like '%super%' OR lower(du.role) like '%admin%'
        UNION
        SELECT up.user_email AS email
        FROM public.user_permissions up
        WHERE up.module = 'accounts' AND (up.can_add OR up.can_edit OR up.can_delete OR coalesce(up.access,'VIEW') <> 'NONE')
      )
    LOOP
      INSERT INTO public.notifications(recipient_email, title, body, meta)
      VALUES (
        st.email,
        'Payment due',
        coalesce('Payment due for '||coalesce(st.full_name,'Student')||case when st.batch_no is not null then ' (Batch '||st.batch_no||')' else '' end||' on '||to_char(rec.due_date, 'YYYY-MM-DD'), 'Payment due') ,
        jsonb_build_object(
          'event','invoice_due',
          'invoice_id', rec.id,
          'student_id', rec.student_id,
          'due_date', rec.due_date,
          'remaining_amount', rec.remaining_amount
        )
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Schedule daily at 08:00 server time
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_due_invoices_daily') THEN
      PERFORM cron.schedule('notify_due_invoices_daily', '0 8 * * *', 'select public.notify_due_invoices();');
    END IF;
  END IF;
END $$;

commit;

