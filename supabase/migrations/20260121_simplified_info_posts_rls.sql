-- Simplified info_posts RLS policy fix
-- This uses a more direct approach that should work reliably

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS info_posts_select ON public.info_posts;
DROP POLICY IF EXISTS info_posts_insert ON public.info_posts;
DROP POLICY IF EXISTS info_posts_update ON public.info_posts;
DROP POLICY IF EXISTS info_posts_delete ON public.info_posts;

-- Everyone authenticated can read
CREATE POLICY info_posts_select ON public.info_posts
  FOR SELECT
  USING (true);

-- More permissive INSERT policy - allow any authenticated active user
-- (You can tighten this later once it's working)
CREATE POLICY info_posts_insert ON public.info_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND du.status = 'Active'
    )
  );

-- More permissive UPDATE policy
CREATE POLICY info_posts_update ON public.info_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND du.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND du.status = 'Active'
    )
  );

-- More permissive DELETE policy
CREATE POLICY info_posts_delete ON public.info_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_users du
      WHERE du.email = current_setting('request.jwt.claims', true)::json->>'email'
        AND du.status = 'Active'
    )
  );

COMMIT;

-- DIAGNOSTIC QUERY (run this separately to check your user):
-- SELECT 
--   current_setting('request.jwt.claims', true)::json->>'email' as jwt_email,
--   du.email,
--   du.role,
--   du.status
-- FROM public.dashboard_users du
-- WHERE du.email = current_setting('request.jwt.claims', true)::json->>'email';
