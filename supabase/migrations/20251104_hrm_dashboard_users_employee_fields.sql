-- HRM Employees compatibility: add employee-profile columns on dashboard_users
-- and notifications safety columns if the table exists.
-- Idempotent and safe to re-run.

-- 1) dashboard_users: add department, designation, joining_date, branch (if missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='dashboard_users'
  ) THEN
    -- department
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='dashboard_users' AND column_name='department'
    ) THEN
      ALTER TABLE public.dashboard_users ADD COLUMN department text;
    END IF;

    -- designation
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='dashboard_users' AND column_name='designation'
    ) THEN
      ALTER TABLE public.dashboard_users ADD COLUMN designation text;
    END IF;

    -- joining_date (date)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='dashboard_users' AND column_name='joining_date'
    ) THEN
      ALTER TABLE public.dashboard_users ADD COLUMN joining_date date;
    END IF;

    -- branch (safety; also handled by 20251007_branch_core)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='dashboard_users' AND column_name='branch'
    ) THEN
      ALTER TABLE public.dashboard_users ADD COLUMN branch text;
    END IF;
  END IF;
END $$;

-- 2) notifications: add read_at and recipient_role if table exists (Header.tsx selects these)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='notifications'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='notifications' AND column_name='read_at'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN read_at timestamptz;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='notifications' AND column_name='recipient_role'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN recipient_role text;
    END IF;
  END IF;
END $$;

