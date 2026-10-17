-- DayBloom v3 non-destructive migration.
-- In your existing Supabase project's SQL Editor, run ONCE before using DayBloom v3.
-- Does not delete accounts, subjects, tasks, or existing PINs.
BEGIN;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS links text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
-- Backfill unknown completion times conservatively: we cannot know when previous tasks were completed.
-- Existing done tasks without completed_at remain done but do not count toward a specific daily goal.
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_attachments_owner_idx
  ON public.task_attachments(user_id, task_id);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_attachments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO service_role;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('daybloom-attachments', 'daybloom-attachments', false, 5242880,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/plain',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'application/zip','application/x-zip-compressed'])
ON CONFLICT (id) DO UPDATE SET
  public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
COMMIT;
