-- Migration: Add calendar_events table and task deadline fields
-- Created: 2025-12-29

-- Create calendar_events table for database-backed calendar
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_mins INTEGER DEFAULT 60,
  category TEXT DEFAULT 'Work',
  notes TEXT,
  task_id TEXT, -- Reference to dashboard_tasks.id
  case_number TEXT, -- Reference to dashboard_cases.case_number
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_email ON public.calendar_events(user_email);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON public.calendar_events(task_id);

-- Add deadline fields to dashboard_tasks if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'dashboard_tasks' 
                 AND column_name = 'deadline_date') THEN
    ALTER TABLE public.dashboard_tasks ADD COLUMN deadline_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'dashboard_tasks' 
                 AND column_name = 'deadline_time') THEN
    ALTER TABLE public.dashboard_tasks ADD COLUMN deadline_time TIME;
  END IF;
END $$;

-- Enable RLS on calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own calendar events
CREATE POLICY calendar_events_select_own ON public.calendar_events
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = user_email
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users
      WHERE email = auth.jwt() ->> 'email'
      AND role ILIKE '%super%'
    )
  );

-- Policy: Users can insert their own calendar events
CREATE POLICY calendar_events_insert_own ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'email' = user_email
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users
      WHERE email = auth.jwt() ->> 'email'
      AND role ILIKE '%super%'
    )
  );

-- Policy: Users can update their own calendar events
CREATE POLICY calendar_events_update_own ON public.calendar_events
  FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = user_email
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users
      WHERE email = auth.jwt() ->> 'email'
      AND role ILIKE '%super%'
    )
  );

-- Policy: Users can delete their own calendar events
CREATE POLICY calendar_events_delete_own ON public.calendar_events
  FOR DELETE
  USING (
    auth.jwt() ->> 'email' = user_email
    OR EXISTS (
      SELECT 1 FROM public.dashboard_users
      WHERE email = auth.jwt() ->> 'email'
      AND role ILIKE '%super%'
    )
  );

-- Add comment
COMMENT ON TABLE public.calendar_events IS 'Calendar events for users, including task deadlines';
