-- YOLO V5.4: differentiated deadline vs duration tasks (non-destructive).
-- IMPORTANT: Run once in your existing V5.3 Supabase project before replacing app files.
-- The existing due_date/due_time columns are PRESERVED.
-- For duration tasks they represent the START date/time; end_date/end_time represent the END.
-- Class meetings remain in their separate timetable.
BEGIN;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'deadline';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time time;
-- Existing tasks become deadline-type tasks; no date/status/task is rewritten.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'yolo_tasks_schedule_type_chk') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT yolo_tasks_schedule_type_chk
    CHECK (schedule_type IN ('deadline','duration','none'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'yolo_tasks_schedule_fields_chk') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT yolo_tasks_schedule_fields_chk CHECK (
       (schedule_type = 'none' AND due_date IS NULL AND due_time IS NULL AND end_date IS NULL AND end_time IS NULL)
       OR (schedule_type = 'deadline' AND end_date IS NULL AND end_time IS NULL)
       OR (schedule_type = 'duration' AND due_date IS NOT NULL AND due_time IS NOT NULL
         AND end_date IS NOT NULL AND end_time IS NOT NULL
         AND ((end_date + end_time) > (due_date + due_time))
         AND ((end_date + end_time) <= (due_date + due_time + interval '48 hours')))
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS tasks_owner_duration_idx ON public.tasks(user_id, end_date)
WHERE schedule_type = 'duration';
COMMIT;
