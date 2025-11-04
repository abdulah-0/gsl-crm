-- Add notifications.recipient_role and dashboard_cases.stage if the tables exist
-- Idempotent and safe to re-run

-- Add recipient_role to notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='notifications'
  ) THEN
    ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS recipient_role text;
  END IF;
END $$;

-- Add stage to dashboard_cases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='dashboard_cases'
  ) THEN
    ALTER TABLE public.dashboard_cases
      ADD COLUMN IF NOT EXISTS stage text;
  END IF;
END $$;

