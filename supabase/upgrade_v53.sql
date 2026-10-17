-- YOLO V5.3: additive-only, repeatable migration. Existing records are not deleted.
BEGIN;
ALTER TABLE public.pin_credentials ADD COLUMN IF NOT EXISTS recovery_hash text;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS session_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_owner_key_unique
  ON public.focus_sessions(user_id, session_key) WHERE session_key IS NOT NULL;

-- Atomic PIN-attempt accounting: protects against concurrent requests overwriting
-- the failed-attempt counter. This is still NOT sufficient for a publicly
-- exposed 4-digit PIN system. Keep the existing development-only guard.
CREATE OR REPLACE FUNCTION public.yolo_record_pin_attempt(p_user_id uuid, p_valid boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE c record; attempts integer; locked timestamptz;
BEGIN
  SELECT failed_attempts, locked_until INTO c
    FROM public.pin_credentials WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'locked', false); END IF;
  IF c.locked_until IS NOT NULL AND c.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'locked', true);
  END IF;
  IF p_valid THEN
    UPDATE public.pin_credentials SET failed_attempts = 0, locked_until = NULL
      WHERE user_id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'locked', false);
  END IF;
  attempts := CASE WHEN c.locked_until IS NOT NULL THEN 1 ELSE c.failed_attempts + 1 END;
  locked := CASE WHEN attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END;
  UPDATE public.pin_credentials SET failed_attempts = attempts, locked_until = locked
    WHERE user_id = p_user_id;
  RETURN jsonb_build_object('ok', false, 'locked', locked IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.yolo_record_pin_attempt(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.yolo_record_pin_attempt(uuid, boolean) TO service_role;
COMMIT;
