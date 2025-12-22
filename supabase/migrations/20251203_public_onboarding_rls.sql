-- Allow public access to employee_onboardings for form submissions
-- This enables the public onboarding form to work without authentication

BEGIN;

-- Allow public insert for onboarding submissions
DROP POLICY IF EXISTS employee_onboardings_public_insert ON public.employee_onboardings;

CREATE POLICY employee_onboardings_public_insert 
ON public.employee_onboardings 
FOR INSERT 
WITH CHECK (true);

-- Note: Existing select/update policies remain unchanged (authenticated users only)

COMMIT;
