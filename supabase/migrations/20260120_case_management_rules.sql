-- Case Management Rules Migration
-- Implements:
-- 1. One student can only have one active (ongoing) case at a time
-- 2. Cases cannot move backward to previously completed stages

BEGIN;

-- ============================================================================
-- 1. Create Case Stage History Table
-- ============================================================================
-- Tracks all stage changes for audit trail and validation
CREATE TABLE IF NOT EXISTS public.case_stage_history (
  id BIGSERIAL PRIMARY KEY,
  case_number TEXT NOT NULL,
  old_stage TEXT,
  new_stage TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT,
  CONSTRAINT fk_case_number FOREIGN KEY (case_number) 
    REFERENCES public.dashboard_cases(case_number) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_case_stage_history_case 
  ON public.case_stage_history(case_number, changed_at DESC);

-- ============================================================================
-- 2. Stage Progression Validation Function
-- ============================================================================
-- Validates if a stage transition is allowed (forward-only, except to terminal stages)
CREATE OR REPLACE FUNCTION public.validate_case_stage_progression(
  current_stage TEXT,
  new_stage TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  stage_order TEXT[] := ARRAY[
    'Initial Stage',
    'Offer Applied',
    'Offer Received',
    'Fee Paid',
    'Interview',
    'CAS Applied',
    'CAS Received',
    'Visa Applied',
    'Visa Received'
  ];
  terminal_stages TEXT[] := ARRAY['Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected'];
  current_index INT;
  new_index INT;
BEGIN
  -- If current stage is NULL or empty, allow any transition (new case)
  IF current_stage IS NULL OR current_stage = '' THEN
    RETURN TRUE;
  END IF;

  -- If new stage is the same as current, allow (no change)
  IF current_stage = new_stage THEN
    RETURN TRUE;
  END IF;

  -- If moving to a terminal stage, always allow
  IF new_stage = ANY(terminal_stages) THEN
    RETURN TRUE;
  END IF;

  -- If current stage is terminal, don't allow any changes
  IF current_stage = ANY(terminal_stages) THEN
    RETURN FALSE;
  END IF;

  -- Find positions in the stage order
  current_index := array_position(stage_order, current_stage);
  new_index := array_position(stage_order, new_stage);

  -- If either stage is not in the ordered list, reject
  IF current_index IS NULL OR new_index IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only allow forward movement (new_index > current_index)
  RETURN new_index > current_index;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. Check if Student Has Active Case Function
-- ============================================================================
-- Returns the case_number if student has an active case, NULL otherwise
CREATE OR REPLACE FUNCTION public.student_has_active_case(
  p_student_id TEXT
) RETURNS TEXT AS $$
DECLARE
  active_case_number TEXT;
  terminal_stages TEXT[] := ARRAY['Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected'];
BEGIN
  -- If no student_id provided, return NULL
  IF p_student_id IS NULL OR p_student_id = '' THEN
    RETURN NULL;
  END IF;

  -- Find any case for this student that is NOT in a terminal stage
  SELECT case_number INTO active_case_number
  FROM public.dashboard_cases
  WHERE student_id = p_student_id
    AND (stage IS NULL OR stage NOT IN ('Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected'))
    AND (status IS NULL OR status NOT IN ('Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected'))
  LIMIT 1;

  RETURN active_case_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. Handle Existing Duplicate Active Cases
-- ============================================================================
-- Before creating the unique constraint, we need to handle existing duplicates
-- This query identifies students with multiple active cases

DO $$
DECLARE
  duplicate_count INT;
  rec RECORD;
BEGIN
  -- Count how many students have duplicate active cases
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT student_id, COUNT(*) as case_count
    FROM public.dashboard_cases
    WHERE student_id IS NOT NULL 
      AND student_id != ''
      AND COALESCE(stage, status, 'Initial Stage') NOT IN ('Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected')
    GROUP BY student_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FOUND % STUDENTS WITH MULTIPLE ACTIVE CASES', duplicate_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'The following students have multiple active cases:';
    
    -- Show the duplicate cases
    FOR rec IN (
      SELECT 
        student_id,
        STRING_AGG(case_number || ' (' || COALESCE(stage, status, 'Initial Stage') || ')', ', ' ORDER BY created_at) as cases,
        COUNT(*) as case_count
      FROM public.dashboard_cases
      WHERE student_id IS NOT NULL 
        AND student_id != ''
        AND COALESCE(stage, status, 'Initial Stage') NOT IN ('Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected')
      GROUP BY student_id
      HAVING COUNT(*) > 1
    ) LOOP
      RAISE NOTICE 'Student %: % cases - %', rec.student_id, rec.case_count, rec.cases;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'AUTOMATIC FIX: Moving older cases to "Not Enrolled" status';
    RAISE NOTICE '========================================';
    
    -- Automatically move older duplicate cases to terminal stage
    -- Keep only the most recent case active for each student
    UPDATE public.dashboard_cases
    SET 
      stage = 'Not Enrolled',
      status = 'Not Enrolled'
    WHERE id IN (
      SELECT id
      FROM (
        SELECT 
          id,
          student_id,
          ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at DESC) as rn
        FROM public.dashboard_cases
        WHERE student_id IS NOT NULL 
          AND student_id != ''
          AND COALESCE(stage, status, 'Initial Stage') NOT IN ('Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected')
      ) ranked
      WHERE rn > 1
    );
    
    RAISE NOTICE 'Fixed % duplicate cases by moving them to "Not Enrolled" status', duplicate_count;
    RAISE NOTICE 'Only the most recent case for each student remains active';
  ELSE
    RAISE NOTICE 'No duplicate active cases found - proceeding with unique index creation';
  END IF;
END $$;

-- ============================================================================
-- 5. Partial Unique Index for One Active Case Per Student
-- ============================================================================
-- Ensures a student can only have one active case at database level
-- Only applies to cases NOT in terminal stages
DROP INDEX IF EXISTS public.idx_dashboard_cases_one_active_per_student;

CREATE UNIQUE INDEX idx_dashboard_cases_one_active_per_student 
  ON public.dashboard_cases(student_id)
  WHERE student_id IS NOT NULL 
    AND student_id != ''
    AND COALESCE(stage, status, 'Initial Stage') NOT IN ('Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected');

-- ============================================================================
-- 6. Trigger to Validate Stage Changes and Record History
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_and_record_case_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  old_stage_val TEXT;
  new_stage_val TEXT;
  user_email TEXT;
BEGIN
  -- Determine old and new stage values (prefer 'stage' column, fallback to 'status')
  old_stage_val := COALESCE(OLD.stage, OLD.status, 'Initial Stage');
  new_stage_val := COALESCE(NEW.stage, NEW.status, 'Initial Stage');

  -- Skip if no stage change
  IF old_stage_val = new_stage_val THEN
    RETURN NEW;
  END IF;

  -- Validate the stage progression
  IF NOT public.validate_case_stage_progression(old_stage_val, new_stage_val) THEN
    RAISE EXCEPTION 'Invalid stage transition: Cannot move from "%" to "%". Cases can only move forward or to terminal stages (Enrollment, Not Enrolled, Backout, Visa Rejected).', 
      old_stage_val, new_stage_val;
  END IF;

  -- Get current user email for audit trail
  BEGIN
    user_email := current_setting('request.jwt.claims', true)::json->>'email';
  EXCEPTION WHEN OTHERS THEN
    user_email := NULL;
  END;

  -- Record the stage change in history
  INSERT INTO public.case_stage_history (case_number, old_stage, new_stage, changed_by)
  VALUES (NEW.case_number, old_stage_val, new_stage_val, user_email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS before_update_dashboard_cases_stage ON public.dashboard_cases;

-- Create trigger to run before updates
CREATE TRIGGER before_update_dashboard_cases_stage
  BEFORE UPDATE OF stage, status ON public.dashboard_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_and_record_case_stage_change();

-- ============================================================================
-- 7. Enable RLS on case_stage_history (inherit from dashboard_cases)
-- ============================================================================
ALTER TABLE public.case_stage_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view history for cases they can view
DROP POLICY IF EXISTS case_stage_history_select ON public.case_stage_history;
CREATE POLICY case_stage_history_select ON public.case_stage_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_cases dc
      WHERE dc.case_number = case_stage_history.case_number
    )
  );

-- Allow inserts from the trigger (system context)
DROP POLICY IF EXISTS case_stage_history_insert ON public.case_stage_history;
CREATE POLICY case_stage_history_insert ON public.case_stage_history
  FOR INSERT
  WITH CHECK (true);

COMMIT;

-- ============================================================================
-- Verification Queries (commented out - for manual testing)
-- ============================================================================
-- Test stage progression validation:
-- SELECT validate_case_stage_progression('Initial Stage', 'Offer Applied'); -- Should return true
-- SELECT validate_case_stage_progression('Offer Received', 'Offer Applied'); -- Should return false
-- SELECT validate_case_stage_progression('CAS Applied', 'Backout'); -- Should return true (terminal)
-- SELECT validate_case_stage_progression('Enrollment', 'Initial Stage'); -- Should return false (from terminal)

-- Test active case check:
-- SELECT student_has_active_case('ST00000001'); -- Replace with actual student_id

-- View stage history:
-- SELECT * FROM case_stage_history ORDER BY changed_at DESC LIMIT 10;
