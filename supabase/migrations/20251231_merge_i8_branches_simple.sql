-- Simplified Branch Merge Script
-- Merges I8 Branch and I8 Head Office into single "i8" branch
-- Run this if the full script failed

BEGIN;

-- Update all users to use "i8" branch
UPDATE public.dashboard_users
SET branch = 'i8'
WHERE branch IN ('I8 Branch', 'I8 Head Office', 'i8 Head Office', 'i8 - Head Office');

-- Update all data tables to use "i8"
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

COMMIT;

-- Verify the merge
SELECT 'Users by branch:' as info;
SELECT branch, COUNT(*) as count
FROM dashboard_users
WHERE branch IS NOT NULL
GROUP BY branch
ORDER BY branch;

SELECT 'Students by branch:' as info;
SELECT branch, COUNT(*) as count
FROM dashboard_students
WHERE branch IS NOT NULL
GROUP BY branch
ORDER BY branch;
