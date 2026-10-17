-- ONLY run this if your subjects table does NOT already have a code column.
-- If you ran Step 5.2.1 in the conversation, do not run this script again.
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_user_code_unique
  ON public.subjects(user_id, code) WHERE code IS NOT NULL;
-- The previous step already created the subjects_code_format constraint.
-- This optional migration intentionally does not add a duplicate constraint.
