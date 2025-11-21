-- Extend universities table with additional CRM fields
BEGIN;

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS affiliation_type text,
  ADD COLUMN IF NOT EXISTS created_by text;

COMMIT;

