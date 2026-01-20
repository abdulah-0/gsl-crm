-- Final Verification: Test Branch Access for Specific Users
-- Run this to verify that users can now access their branch data

-- ============================================================================
-- Test 1: Check if F8 users can see F8 data
-- ============================================================================

-- Simulate F8 user query (what the RLS policy checks)
SELECT 'F8 User Access Test' as test;

SELECT 
    'Cases visible to F8 users' as data_type,
    COUNT(*) as count
FROM public.dashboard_cases
WHERE branch = 'F8' 
   OR EXISTS (
       SELECT 1 FROM public.dashboard_users 
       WHERE email = 'directorf8@thegateway.pk' 
       AND (LOWER(role) LIKE '%super%' OR branch = 'i8')
   );

-- ============================================================================
-- Test 2: Check if PWD users can see PWD data
-- ============================================================================

SELECT 'PWD User Access Test' as test;

SELECT 
    'Cases visible to PWD users' as data_type,
    COUNT(*) as count
FROM public.dashboard_cases
WHERE branch = 'PWD'
   OR EXISTS (
       SELECT 1 FROM public.dashboard_users 
       WHERE email = 'directorpwd@thegateway.pk' 
       AND (LOWER(role) LIKE '%super%' OR branch = 'i8')
   );

-- ============================================================================
-- Test 3: Verify RLS function works correctly
-- ============================================================================

-- Test the can_access_all_branches function
SELECT 
    email,
    branch,
    role,
    public.can_access_all_branches() as can_see_all
FROM public.dashboard_users
WHERE email IN (
    'directorf8@thegateway.pk',
    'directorpwd@thegateway.pk', 
    'md@thegateway.pk'
)
ORDER BY email;

-- ============================================================================
-- Test 4: Summary of what each user should see
-- ============================================================================

SELECT 
    u.email,
    u.branch as user_branch,
    u.role,
    CASE 
        WHEN LOWER(u.role) LIKE '%super%' THEN 'ALL branches'
        WHEN u.branch = 'i8' THEN 'ALL branches'
        ELSE u.branch
    END as can_see_data_from,
    (SELECT COUNT(*) FROM dashboard_students WHERE branch = u.branch OR u.branch = 'i8' OR LOWER(u.role) LIKE '%super%') as students_visible,
    (SELECT COUNT(*) FROM dashboard_cases WHERE branch = u.branch OR u.branch = 'i8' OR LOWER(u.role) LIKE '%super%') as cases_visible,
    (SELECT COUNT(*) FROM leads WHERE branch = u.branch OR u.branch = 'i8' OR LOWER(u.role) LIKE '%super%') as leads_visible
FROM public.dashboard_users u
WHERE u.email IN (
    'directorf8@thegateway.pk',
    'directorpwd@thegateway.pk',
    'directorpew@thegateway.pk',
    'md@thegateway.pk'
)
ORDER BY u.branch, u.email;
