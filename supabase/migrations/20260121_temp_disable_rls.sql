-- TEMPORARY: Disable RLS on info_posts to test if that's the issue
-- This is just for testing - we'll re-enable it with proper policies once we confirm

BEGIN;

-- Temporarily disable RLS
ALTER TABLE public.info_posts DISABLE ROW LEVEL SECURITY;

COMMIT;

-- NOTE: After testing, you should re-enable RLS with:
-- ALTER TABLE public.info_posts ENABLE ROW LEVEL SECURITY;
