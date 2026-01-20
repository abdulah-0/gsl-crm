-- Fix NULL Branch Assignments - SIMPLIFIED VERSION
-- This script assigns the default 'i8' branch to all records without a branch

BEGIN;

-- ============================================================================
-- Assign NULL branches to 'i8' (Head Office / Default Branch)
-- ============================================================================

-- Fix students without branch
UPDATE public.dashboard_students 
SET branch = 'i8' 
WHERE branch IS NULL;

-- Fix leads without branch
UPDATE public.leads 
SET branch = 'i8' 
WHERE branch IS NULL;

-- ============================================================================
-- Verify the fix
-- ============================================================================

SELECT 
    'dashboard_students' as table_name,
    COUNT(*) FILTER (WHERE branch IS NULL) as null_branches,
    COUNT(*) FILTER (WHERE branch IS NOT NULL) as with_branches,
    COUNT(*) as total
FROM public.dashboard_students
UNION ALL
SELECT 
    'leads',
    COUNT(*) FILTER (WHERE branch IS NULL),
    COUNT(*) FILTER (WHERE branch IS NOT NULL),
    COUNT(*)
FROM public.leads;

COMMIT;

-- ============================================================================
-- NEXT STEP: Check user branch assignments
-- ============================================================================

-- Run this to see which users need branch assignments:
SELECT 
    email, 
    full_name, 
    role,
    branch,
    CASE 
        WHEN LOWER(role) LIKE '%super%' THEN '✓ Super Admin - Can see all'
        WHEN branch = 'i8' THEN '✓ i8 Branch - Can see all'
        WHEN branch IS NULL THEN '⚠️ NO BRANCH - User cannot see data!'
        ELSE '✓ Regular user - Should see: ' || branch
    END as access_level
FROM public.dashboard_users
WHERE LOWER(role) NOT LIKE '%super%'  -- Exclude super admins
ORDER BY branch NULLS FIRST, email;
