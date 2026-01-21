-- Fix info_posts RLS policies to allow authorized users to create posts
-- This migration creates the table if needed and updates the RLS policies to be more robust

BEGIN;

-- Enable uuid generation if available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.info_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('image','video','text')),
  file_url text,
  text_content text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

-- Enable RLS
ALTER TABLE public.info_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS info_posts_select ON public.info_posts;
DROP POLICY IF EXISTS info_posts_insert ON public.info_posts;
DROP POLICY IF EXISTS info_posts_update ON public.info_posts;
DROP POLICY IF EXISTS info_posts_delete ON public.info_posts;

-- Everyone authenticated can read
CREATE POLICY info_posts_select ON public.info_posts
  FOR SELECT
  USING (true);

-- Admin/Super Admin can insert (using auth.jwt() for better compatibility)
CREATE POLICY info_posts_insert ON public.info_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = (SELECT auth.jwt()->>'email')
        AND du.status = 'Active'
        AND (
          lower(du.role) LIKE '%admin%'
          OR lower(du.role) LIKE '%super%'
        )
    )
  );

-- Admin/Super Admin can update
CREATE POLICY info_posts_update ON public.info_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = (SELECT auth.jwt()->>'email')
        AND du.status = 'Active'
        AND (
          lower(du.role) LIKE '%admin%'
          OR lower(du.role) LIKE '%super%'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = (SELECT auth.jwt()->>'email')
        AND du.status = 'Active'
        AND (
          lower(du.role) LIKE '%admin%'
          OR lower(du.role) LIKE '%super%'
        )
    )
  );

-- Admin/Super Admin can delete
CREATE POLICY info_posts_delete ON public.info_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = (SELECT auth.jwt()->>'email')
        AND du.status = 'Active'
        AND (
          lower(du.role) LIKE '%admin%'
          OR lower(du.role) LIKE '%super%'
        )
    )
  );

COMMIT;

