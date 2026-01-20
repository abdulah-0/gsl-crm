-- Diagnostic Script: Check Branch Data Consistency
-- This script helps identify why users cannot see their branch data

-- ============================================================================
-- PART 1: Check User Branch Assignments
-- ============================================================================

-- View all users and their assigned branches
SELECT 
    email,
    full_name,
    role,
    branch,
    CASE 
        WHEN LOWER(role) LIKE '%super%' THEN 'Super Admin - Can see all'
        WHEN branch = 'i8' THEN 'i8 Branch - Can see all'
        WHEN branch IS NULL THEN 'NO BRANCH ASSIGNED - Cannot see data!'
        ELSE 'Regular user - Should see only: ' || branch
    END as access_level
FROM public.dashboard_users
ORDER BY role, branch;

-- ============================================================================
-- PART 2: Check Branch Values in Data Tables
-- ============================================================================

-- Check unique branch values in each table
SELECT 'dashboard_students' as table_name, branch, COUNT(*) as record_count
FROM public.dashboard_students
WHERE branch IS NOT NULL
GROUP BY branch
UNION ALL
SELECT 'dashboard_cases', branch, COUNT(*)
FROM public.dashboard_cases
WHERE branch IS NOT NULL
GROUP BY branch
UNION ALL
SELECT 'leads', branch, COUNT(*)
FROM public.leads
WHERE branch IS NOT NULL
GROUP BY branch
UNION ALL
SELECT 'invoices', branch, COUNT(*)
FROM public.invoices
WHERE branch IS NOT NULL
GROUP BY branch
UNION ALL
SELECT 'vouchers', branch, COUNT(*)
FROM public.vouchers
WHERE branch IS NOT NULL
GROUP BY branch
ORDER BY table_name, branch;

-- ============================================================================
-- PART 3: Check for Branch Mismatches
-- ============================================================================

-- Find branches in data tables that don't exist in dashboard_users
WITH user_branches AS (
    SELECT DISTINCT branch FROM public.dashboard_users WHERE branch IS NOT NULL
),
data_branches AS (
    SELECT DISTINCT branch FROM public.dashboard_students WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM public.dashboard_cases WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM public.leads WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM public.invoices WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM public.vouchers WHERE branch IS NOT NULL
)
SELECT 
    db.branch as branch_in_data,
    CASE 
        WHEN ub.branch IS NULL THEN '⚠️ NO USER ASSIGNED TO THIS BRANCH'
        ELSE '✓ Users exist for this branch'
    END as status
FROM data_branches db
LEFT JOIN user_branches ub ON db.branch = ub.branch
ORDER BY db.branch;

-- ============================================================================
-- PART 4: Test RLS Policy for a Specific User
-- ============================================================================

-- Replace 'user@example.com' with an actual user email to test
DO $$
DECLARE
    test_email text := 'user@example.com'; -- CHANGE THIS
    user_branch text;
    user_role text;
    can_access_all boolean;
BEGIN
    -- Get user info
    SELECT branch, role INTO user_branch, user_role
    FROM public.dashboard_users
    WHERE email = test_email;
    
    IF user_branch IS NULL THEN
        RAISE NOTICE 'User: % - NO BRANCH ASSIGNED!', test_email;
        RAISE NOTICE 'This user will NOT be able to see any data!';
        RETURN;
    END IF;
    
    -- Check access level
    can_access_all := (LOWER(user_role) LIKE '%super%' OR user_branch = 'i8');
    
    RAISE NOTICE 'User: %', test_email;
    RAISE NOTICE 'Branch: %', user_branch;
    RAISE NOTICE 'Role: %', user_role;
    RAISE NOTICE 'Can access all branches: %', can_access_all;
    
    IF can_access_all THEN
        RAISE NOTICE '✓ This user should see ALL data';
    ELSE
        RAISE NOTICE '✓ This user should see only branch: %', user_branch;
    END IF;
END $$;

-- ============================================================================
-- PART 5: Check for NULL Branches in Data
-- ============================================================================

-- Find records without branch assignment (these won't be visible to anyone except super admin/i8)
SELECT 
    'dashboard_students' as table_name,
    COUNT(*) as records_without_branch
FROM public.dashboard_students
WHERE branch IS NULL
UNION ALL
SELECT 'dashboard_cases', COUNT(*)
FROM public.dashboard_cases
WHERE branch IS NULL
UNION ALL
SELECT 'leads', COUNT(*)
FROM public.leads
WHERE branch IS NULL
UNION ALL
SELECT 'invoices', COUNT(*)
FROM public.invoices
WHERE branch IS NULL
UNION ALL
SELECT 'vouchers', COUNT(*)
FROM public.vouchers
WHERE branch IS NULL;

-- ============================================================================
-- RECOMMENDATIONS
-- ============================================================================

/*
COMMON ISSUES AND FIXES:

1. USER HAS NO BRANCH ASSIGNED:
   Fix: UPDATE public.dashboard_users SET branch = 'BRANCH_CODE' WHERE email = 'user@example.com';

2. DATA HAS NO BRANCH ASSIGNED:
   Fix: UPDATE public.dashboard_students SET branch = 'BRANCH_CODE' WHERE branch IS NULL;

3. BRANCH NAME MISMATCH (case sensitivity, spaces):
   Fix: Ensure branch values match exactly between dashboard_users and data tables
   
4. USER NEEDS ACCESS TO ALL BRANCHES:
   Fix: Either:
      - Set role to 'Super Admin': UPDATE public.dashboard_users SET role = 'Super Admin' WHERE email = 'user@example.com';
      - Set branch to 'i8': UPDATE public.dashboard_users SET branch = 'i8' WHERE email = 'user@example.com';
*/
