-- Fix Branch Name Mismatches
-- This script standardizes branch names to match user assignments

BEGIN;

-- ============================================================================
-- STEP 1: Check current branch mismatches
-- ============================================================================

-- Show the mismatch
SELECT 'BEFORE FIX - Data branches vs User branches' as status;

SELECT 'Data Branches:' as type, branch FROM (
    SELECT DISTINCT branch FROM dashboard_students WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM dashboard_cases WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM leads WHERE branch IS NOT NULL
    UNION
    SELECT DISTINCT branch FROM vouchers WHERE branch IS NOT NULL
) t
UNION ALL
SELECT 'User Branches:', branch FROM (
    SELECT DISTINCT branch FROM dashboard_users WHERE branch IS NOT NULL
) u
ORDER BY type, branch;

-- ============================================================================
-- STEP 2: Fix the mismatches
-- ============================================================================

-- Fix "PWD Branch" to "PWD" (to match user branch)
UPDATE public.dashboard_cases SET branch = 'PWD' WHERE branch = 'PWD Branch';
UPDATE public.dashboard_students SET branch = 'PWD' WHERE branch = 'PWD Branch';
UPDATE public.leads SET branch = 'PWD' WHERE branch = 'PWD Branch';
UPDATE public.vouchers SET branch = 'PWD' WHERE branch = 'PWD Branch';

-- Fix "IG Branch" to "F8" (assuming IG Branch is F8 Islamabad)
-- If this is wrong, change 'F8' to the correct branch code
UPDATE public.dashboard_cases SET branch = 'F8' WHERE branch = 'IG Branch';
UPDATE public.dashboard_students SET branch = 'F8' WHERE branch = 'IG Branch';
UPDATE public.leads SET branch = 'F8' WHERE branch = 'IG Branch';
UPDATE public.vouchers SET branch = 'F8' WHERE branch = 'IG Branch';

-- ============================================================================
-- STEP 3: Verify the fix
-- ============================================================================

SELECT 'AFTER FIX - Branch distribution' as status;

SELECT 
    'Students' as table_name,
    branch,
    COUNT(*) as records,
    CASE 
        WHEN branch IN (SELECT DISTINCT branch FROM dashboard_users) THEN '✓ Matches user branch'
        ELSE '⚠️ No users assigned to this branch'
    END as user_match
FROM public.dashboard_students
WHERE branch IS NOT NULL
GROUP BY branch

UNION ALL

SELECT 
    'Cases',
    branch,
    COUNT(*),
    CASE 
        WHEN branch IN (SELECT DISTINCT branch FROM dashboard_users) THEN '✓ Matches user branch'
        ELSE '⚠️ No users assigned to this branch'
    END
FROM public.dashboard_cases
WHERE branch IS NOT NULL
GROUP BY branch

UNION ALL

SELECT 
    'Leads',
    branch,
    COUNT(*),
    CASE 
        WHEN branch IN (SELECT DISTINCT branch FROM dashboard_users) THEN '✓ Matches user branch'
        ELSE '⚠️ No users assigned to this branch'
    END
FROM public.leads
WHERE branch IS NOT NULL
GROUP BY branch

ORDER BY table_name, branch;

COMMIT;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

/*
BRANCH MAPPING APPLIED:
- "PWD Branch" → "PWD" (to match users: directorpwd@thegateway.pk, etc.)
- "IG Branch" → "F8" (assuming IG = Islamabad/F8 branch)

If "IG Branch" should map to a different branch code, run:
UPDATE public.dashboard_cases SET branch = 'CORRECT_CODE' WHERE branch = 'F8';
UPDATE public.dashboard_students SET branch = 'CORRECT_CODE' WHERE branch = 'F8';
UPDATE public.leads SET branch = 'CORRECT_CODE' WHERE branch = 'F8';
UPDATE public.vouchers SET branch = 'CORRECT_CODE' WHERE branch = 'F8';

AVAILABLE USER BRANCHES:
- F8 (3 users)
- i8 (11 users - can see all)
- PES (3 users)
- PWD (5 users)
*/
