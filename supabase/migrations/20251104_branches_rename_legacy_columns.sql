-- Harmonize branches table columns to branch_name/branch_code for legacy schemas
-- Idempotent: only rename when target does not already exist
BEGIN;

-- If legacy column "code" exists and "branch_code" does not, rename it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='code'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_code'
  ) THEN
    ALTER TABLE public.branches RENAME COLUMN code TO branch_code;
  END IF;
END$$;

-- If legacy column "name" exists and "branch_name" does not, rename it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_name'
  ) THEN
    ALTER TABLE public.branches RENAME COLUMN name TO branch_name;
  END IF;
END$$;

-- Ensure NOT NULL constraints on required fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_name'
  ) THEN
    ALTER TABLE public.branches ALTER COLUMN branch_name SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_code'
  ) THEN
    ALTER TABLE public.branches ALTER COLUMN branch_code SET NOT NULL;
  END IF;
END$$;

-- Ensure unique constraint on branch_code
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='branches' AND column_name='branch_code'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.branches'::regclass AND conname = 'branches_branch_code_key'
  ) THEN
    ALTER TABLE public.branches ADD CONSTRAINT branches_branch_code_key UNIQUE (branch_code);
  END IF;
END$$;

COMMIT;

