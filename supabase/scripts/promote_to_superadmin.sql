-- Script to promote a user to Super Admin
-- Replace 'user@example.com' with the actual user's email address

-- Update the user's role to Super Admin
UPDATE public.dashboard_users
SET role = 'Super Admin'
WHERE email = 'user@example.com';

-- Verify the update
SELECT email, role, branch, full_name
FROM public.dashboard_users
WHERE email = 'user@example.com';

-- NOTES:
-- 1. Replace 'user@example.com' with the actual email of the user you want to promote
-- 2. The role can be any of these variations (all work):
--    - 'Super Admin'
--    - 'super admin'
--    - 'super_admin'
--    - 'superadmin'
--    - 'Super Administrator'
-- 3. Super Admins can:
--    - Access all branches (branch_id can be NULL or any value)
--    - See all data across the system
--    - Have full CRUD permissions on all modules
-- 4. Run this in your Supabase SQL Editor or via psql

-- Example for multiple users:
-- UPDATE public.dashboard_users
-- SET role = 'Super Admin'
-- WHERE email IN ('admin1@example.com', 'admin2@example.com');
