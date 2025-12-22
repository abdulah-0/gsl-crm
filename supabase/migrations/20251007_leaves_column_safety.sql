-- Safety patch: ensure core columns exist on public.leaves for app compatibility
DO $$
BEGIN
  -- type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN type text;
  END IF;

  -- start_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN start_date date;
  END IF;

  -- end_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN end_date date;
  END IF;

  -- status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN status text DEFAULT 'Pending';
  END IF;

  -- reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'reason'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN reason text;
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.leaves ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END$$;
