-- YOLO V5: add class timetable, repeating tasks, focus sessions, and a private daily journal.
-- Non-destructive: does not drop old tables or replace any saved tasks/subjects.
-- Run in the same Supabase project used by YOLO V4.
BEGIN;

CREATE TABLE IF NOT EXISTS public.class_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text NOT NULL DEFAULT '' CHECK (length(room) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_meeting_times CHECK (start_time < end_time),
  CONSTRAINT class_meeting_subject_owner FOREIGN KEY (user_id, subject_id)
    REFERENCES public.subjects(user_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS class_meetings_owner_day_idx ON public.class_meetings(user_id, weekday, start_time);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 150),
  content text NOT NULL DEFAULT '' CHECK (length(content) <= 20000),
  mood text NOT NULL DEFAULT 'neutral'
    CHECK (mood IN ('great','good','neutral','low','rough')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);
CREATE INDEX IF NOT EXISTS journal_entries_owner_date_idx ON public.journal_entries(user_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  focus_minutes integer NOT NULL CHECK (focus_minutes BETWEEN 1 AND 240),
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS focus_sessions_owner_date_idx ON public.focus_sessions(user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.task_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  subject_id uuid,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  links text[] NOT NULL DEFAULT '{}'::text[],
  priority text NOT NULL DEFAULT 'none' CHECK (priority IN ('none','low','medium','high')),
  start_date date NOT NULL,
  due_time time,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  weekdays integer[] NOT NULL DEFAULT '{}'::integer[],
  end_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurrence_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT recurrence_weekdays CHECK (
    array_length(weekdays,1) IS NULL OR weekdays <@ ARRAY[0,1,2,3,4,5,6]
  ),
  CONSTRAINT recurrence_subject_owner FOREIGN KEY (user_id, subject_id)
    REFERENCES public.subjects(user_id, id) ON DELETE SET NULL (subject_id)
);
CREATE INDEX IF NOT EXISTS task_recurrences_owner_idx ON public.task_recurrences(user_id, active);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_id uuid REFERENCES public.task_recurrences(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS occurrence_date date;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurrence_occurrence_unique
  ON public.tasks (recurrence_id, occurrence_date) WHERE recurrence_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.recurrence_skips (
  user_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  recurrence_id uuid NOT NULL REFERENCES public.task_recurrences(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  PRIMARY KEY (recurrence_id, occurrence_date)
);

-- Generates a rolling window. Each occurrence is a normal YOLO task with its own status.
-- Deleted instances are recorded in recurrence_skips and will not reappear.
CREATE OR REPLACE FUNCTION public.generate_yolo_occurrences(
  p_user_id uuid, p_from date, p_through date
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE inserted_count integer := 0;
BEGIN
  IF p_from IS NULL OR p_through IS NULL OR p_through < p_from
    OR p_through > CURRENT_DATE + 185 OR p_from < CURRENT_DATE - 45 THEN
    RAISE EXCEPTION 'Invalid generation window';
  END IF;

  INSERT INTO public.tasks (
    user_id, subject_id, title, notes, links, status, priority,
    due_date, due_time, recurrence_id, occurrence_date
  )
  SELECT r.user_id, r.subject_id, r.title, r.notes, r.links, 'todo', r.priority,
         day_series.day::date, r.due_time, r.id, day_series.day::date
  FROM public.task_recurrences AS r
  CROSS JOIN LATERAL generate_series(
    GREATEST(r.start_date, p_from)::timestamp,
    LEAST(COALESCE(r.end_date, p_through), p_through)::timestamp,
    INTERVAL '1 day'
  ) AS day_series(day)
  WHERE r.user_id = p_user_id AND r.active
    AND (
      r.frequency = 'daily'
      OR (r.frequency = 'weekly' AND EXTRACT(DOW FROM day_series.day)::int = ANY(r.weekdays))
      OR (r.frequency = 'monthly' AND EXTRACT(DAY FROM day_series.day)::int = EXTRACT(DAY FROM r.start_date)::int)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.recurrence_skips AS skips
      WHERE skips.recurrence_id = r.id AND skips.occurrence_date = day_series.day::date
    )
  ON CONFLICT (recurrence_id, occurrence_date) WHERE recurrence_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

DO $$ DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['class_meetings','journal_entries','focus_sessions','task_recurrences','recurrence_skips'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', tbl);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.generate_yolo_occurrences(uuid,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_yolo_occurrences(uuid,date,date) TO service_role;
COMMIT;
