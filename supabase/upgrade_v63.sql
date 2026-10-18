-- YOLO V6.3: Make the subject code optional.
-- Safe to rerun. Existing names, codes, colors, tasks and classes are preserved.
-- Requires the existing public.subjects table.
BEGIN;
ALTER TABLE public.subjects
  ALTER COLUMN code DROP NOT NULL;
COMMIT;

-- PostgreSQL UNIQUE indexes already allow multiple NULL codes.
-- The existing code-format CHECK also permits NULL (SQL CHECK semantics).
