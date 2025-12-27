-- Branch-Specific Implementation Verification Script
-- Run this after applying the main migration to verify everything works

-- ============================================================================
-- VERIFICATION QUERIESa
-- ============================================================================

-- 1. Verify i8 branch exists and is marked as main
SELECT 
  branch_code, 
  branch_name, 
  is_main_branch,
  created_at
FROM public.branches 
WHERE branch_code = 'i8';
-- Expected: 1 row with is_main_branch = true

-- 2. Verify branch columns exist in all tables
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name = 'branch'
  AND table_name IN (
    'dashboard_students', 'dashboard_cases', 'leads', 
    'invoices', 'vouchers', 'dashboard_services',
    'dashboard_teachers', 'dashboard_tasks', 'universities',
    'lead_documents', 'lead_timeline'
  )
ORDER BY table_name;
-- Expected: 11 rows

-- 3. Verify triggers exist
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname LIKE 'auto_set_branch%'
ORDER BY tgrelid::regclass::text;
-- Expected: 10+ triggers

-- 4. Verify RLS policies exist
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND policyname LIKE '%_branch'
ORDER BY tablename, cmd;
-- Expected: 40+ policies (SELECT, INSERT, UPDATE, DELETE for each table)

-- 5. Check data backfill - all records should have branch = 'i8'
SELECT 
  'dashboard_students' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE branch = 'i8') as i8_records,
  COUNT(*) FILTER (WHERE branch IS NULL) as null_records
FROM public.dashboard_students
UNION ALL
SELECT 
  'dashboard_cases',
  COUNT(*),
  COUNT(*) FILTER (WHERE branch = 'i8'),
  COUNT(*) FILTER (WHERE branch IS NULL)
FROM public.dashboard_cases
UNION ALL
SELECT 
  'leads',
  COUNT(*),
  COUNT(*) FILTER (WHERE branch = 'i8'),
  COUNT(*) FILTER (WHERE branch IS NULL)
FROM public.leads
UNION ALL
SELECT 
  'invoices',
  COUNT(*),
  COUNT(*) FILTER (WHERE branch = 'i8'),
  COUNT(*) FILTER (WHERE branch IS NULL)
FROM public.invoices
UNION ALL
SELECT 
  'vouchers',
  COUNT(*),
  COUNT(*) FILTER (WHERE branch = 'i8'),
  COUNT(*) FILTER (WHERE branch IS NULL)
FROM public.vouchers;
-- Expected: null_records should be 0 for all tables

-- 6. Verify indexes exist for performance
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_branch'
ORDER BY tablename;
-- Expected: 11 indexes

-- 7. Test helper function
SELECT public.can_access_all_branches() as can_access_all;
-- Expected: true if you're Super Admin or i8 branch, false otherwise

-- ============================================================================
-- SAMPLE DATA TESTS (Optional - only if you want to create test data)
-- ============================================================================

-- Create test branches
INSERT INTO public.branches (branch_name, branch_code, is_main_branch, created_by)
VALUES 
  ('Lahore Branch', 'lahore', false, 'system'),
  ('Karachi Branch', 'karachi', false, 'system')
ON CONFLICT (branch_code) DO NOTHING;

-- Create test users in different branches
-- Note: You'll need to create these users in Supabase Auth first
-- Then update their branch assignment here

-- Example:
-- UPDATE public.dashboard_users SET branch = 'lahore' WHERE email = 'lahore.user@example.com';
-- UPDATE public.dashboard_users SET branch = 'karachi' WHERE email = 'karachi.user@example.com';
-- UPDATE public.dashboard_users SET branch = 'i8' WHERE email = 'i8.user@example.com';

-- ============================================================================
-- ACCESS CONTROL TESTS
-- ============================================================================

-- Test 1: Create a student as i8 user (should auto-assign branch = 'i8')
-- Login as i8 user, then run:
-- INSERT INTO public.dashboard_students (id, full_name, status)
-- VALUES ('ST00001', 'Test Student i8', 'Active');

-- Verify branch was auto-assigned:
-- SELECT id, full_name, branch FROM public.dashboard_students WHERE id = 'ST00001';
-- Expected: branch = 'i8'

-- Test 2: Create a student as lahore user (should auto-assign branch = 'lahore')
-- Login as lahore user, then run:
-- INSERT INTO public.dashboard_students (id, full_name, status)
-- VALUES ('ST00002', 'Test Student Lahore', 'Active');

-- Verify branch was auto-assigned:
-- SELECT id, full_name, branch FROM public.dashboard_students WHERE id = 'ST00002';
-- Expected: branch = 'lahore'

-- Test 3: Verify i8 user can see all students
-- Login as i8 user, then run:
-- SELECT id, full_name, branch FROM public.dashboard_students ORDER BY id;
-- Expected: Should see students from ALL branches (i8, lahore, karachi, etc.)

-- Test 4: Verify lahore user can only see lahore students
-- Login as lahore user, then run:
-- SELECT id, full_name, branch FROM public.dashboard_students ORDER BY id;
-- Expected: Should ONLY see students where branch = 'lahore'

-- Test 5: Verify lahore user cannot update i8 student
-- Login as lahore user, then run:
-- UPDATE public.dashboard_students SET full_name = 'Hacked' WHERE id = 'ST00001';
-- Expected: 0 rows updated (RLS blocks access)

-- Test 6: Verify i8 user CAN update lahore student
-- Login as i8 user, then run:
-- UPDATE public.dashboard_students SET full_name = 'Updated by i8' WHERE id = 'ST00002';
-- Expected: 1 row updated (i8 has access to all branches)

-- ============================================================================
-- CLEANUP TEST DATA (Run after testing)
-- ============================================================================

-- Remove test students
-- DELETE FROM public.dashboard_students WHERE id IN ('ST00001', 'ST00002');

-- Remove test branches (optional)
-- DELETE FROM public.branches WHERE branch_code IN ('lahore', 'karachi');

-- ============================================================================
-- TROUBLESHOOTING QUERIES
-- ============================================================================

-- Check if user has branch assigned
SELECT email, branch, role FROM public.dashboard_users WHERE email = auth.email();

-- Check all users and their branches
SELECT email, branch, role, status FROM public.dashboard_users ORDER BY branch, email;

-- Find records without branch (should be none after migration)
SELECT 'dashboard_students' as table_name, COUNT(*) as records_without_branch
FROM public.dashboard_students WHERE branch IS NULL
UNION ALL
SELECT 'dashboard_cases', COUNT(*) FROM public.dashboard_cases WHERE branch IS NULL
UNION ALL
SELECT 'leads', COUNT(*) FROM public.leads WHERE branch IS NULL;

-- Check RLS policy details for a specific table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'dashboard_students';
