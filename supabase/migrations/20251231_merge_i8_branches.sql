-- Merge I8 Branch and I8 Head Office (2025-12-31)
-- Consolidates duplicate I8 branches into a single "i8" branch
-- Ensures branch-specific data access works correctly

BEGIN;

-- ============================================================================
-- PART 1: Merge Duplicate I8 Branches
-- ============================================================================

-- Update all users assigned to "I8 Branch" to "i8"
UPDATE public.dashboard_users
SET branch = 'i8'
WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');

-- Update all data tables to use "i8" consistently
UPDATE public.dashboard_students SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.dashboard_cases SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.leads SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.invoices SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.vouchers SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.dashboard_services SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.dashboard_teachers SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.dashboard_tasks SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.universities SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.lead_documents SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.lead_timeline SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');
UPDATE public.leaves SET branch = 'i8' WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');

-- ============================================================================
-- PART 2: Clean Up Branches Table
-- ============================================================================

-- Detect which column name is used (branch_code or code)
DO $$
DECLARE
  has_branch_code boolean;
  has_code_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_code'
  ) INTO has_branch_code;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='code'
  ) INTO has_code_column;

  -- Delete duplicate I8 branches based on schema
  IF has_branch_code THEN
    -- New schema: use branch_code
    DELETE FROM public.branches 
    WHERE branch_code IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office')
      AND branch_code != 'i8';
    
    -- Ensure main i8 branch exists and is marked as main
    INSERT INTO public.branches (branch_name, branch_code, is_main_branch, created_by)
    VALUES ('I8 Head Office', 'i8', true, 'system')
    ON CONFLICT (branch_code) DO UPDATE
    SET branch_name = 'I8 Head Office',
        is_main_branch = true;
        
  ELSIF has_code_column THEN
    -- Old schema: use code
    DELETE FROM public.branches 
    WHERE code IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office')
      AND code != 'i8';
    
    -- Ensure main i8 branch exists and is marked as main
    INSERT INTO public.branches (name, code, is_main_branch)
    VALUES ('I8 Head Office', 'i8', true)
    ON CONFLICT (code) DO UPDATE
    SET name = 'I8 Head Office',
        is_main_branch = true;
  END IF;
END$$;

-- ============================================================================
-- PART 3: Verify Branch-Specific RLS Policies Are Active
-- ============================================================================

-- The branch-specific RLS policies were already created in 20251222_branch_specific_implementation.sql
-- This section just verifies they exist

DO $$
DECLARE
  policy_count int;
BEGIN
  -- Check if branch-specific policies exist
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('dashboard_students', 'dashboard_cases', 'leads', 'invoices', 'dashboard_services')
    AND policyname LIKE '%_branch';
  
  IF policy_count = 0 THEN
    RAISE NOTICE 'WARNING: Branch-specific RLS policies not found. Run 20251222_branch_specific_implementation.sql first.';
  ELSE
    RAISE NOTICE 'Branch-specific RLS policies are active (% policies found)', policy_count;
  END IF;
END$$;

COMMIT;

-- ============================================================================
-- Verification Query (Run this after migration to verify)
-- ============================================================================

-- Check branches
SELECT 'Branches:' as info;
SELECT 
  COALESCE(branch_code, code) as branch,
  COALESCE(branch_name, name) as name,
  is_main_branch,
  created_at
FROM branches
ORDER BY is_main_branch DESC NULLS LAST, COALESCE(branch_code, code);

-- Check users by branch
SELECT 'Users by Branch:' as info;
SELECT branch, role, COUNT(*) as user_count
FROM dashboard_users
WHERE branch IS NOT NULL
GROUP BY branch, role
ORDER BY branch, role;

-- Check data distribution
SELECT 'Data Distribution:' as info;
SELECT 
  'students' as table_name,
  branch,
  COUNT(*) as count
FROM dashboard_students
WHERE branch IS NOT NULL
GROUP BY branch

UNION ALL

SELECT 
  'leads' as table_name,
  branch,
  COUNT(*) as count
FROM leads
WHERE branch IS NOT NULL
GROUP BY branch

UNION ALL

SELECT 
  'cases' as table_name,
  branch,
  COUNT(*) as count
FROM dashboard_cases
WHERE branch IS NOT NULL
GROUP BY branch

ORDER BY table_name, branch;
