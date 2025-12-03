-- Fix RLS policy for employees_master to allow Admin users to insert
-- This is required for the HRM employee management features

BEGIN;

-- Drop existing insert policy
DROP POLICY IF EXISTS employees_master_insert ON public.employees_master;

-- Recreate insert policy to include is_admin()
CREATE POLICY employees_master_insert ON public.employees_master 
FOR INSERT 
WITH CHECK (
  public.is_super() OR public.is_admin() OR public.is_hr()
);

-- Also update the update policy to include is_admin()
DROP POLICY IF EXISTS employees_master_update ON public.employees_master;

CREATE POLICY employees_master_update ON public.employees_master 
FOR UPDATE 
USING (
  public.is_super() OR public.is_admin() OR public.is_hr()
) 
WITH CHECK (
  public.is_super() OR public.is_admin() OR public.is_hr()
);

COMMIT;
