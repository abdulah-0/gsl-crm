-- Fix info_posts RLS policies to allow authorized users to create posts
-- This migration updates the RLS policies to be more robust

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS info_posts_insert ON public.info_posts;
DROP POLICY IF EXISTS info_posts_update ON public.info_posts;
DROP POLICY IF EXISTS info_posts_delete ON public.info_posts;

-- Recreate INSERT policy with better email matching
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

-- Recreate UPDATE policy
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

-- Recreate DELETE policy
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
