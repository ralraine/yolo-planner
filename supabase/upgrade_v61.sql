-- YOLO V6.1 - additive database-backed IP throttling for public PIN endpoints.
-- Keep your earlier V5.3 lockout function. Does not delete or change existing user data.
-- This migration should be run before deploying the corresponding V6.1 API routes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.yolo_auth_throttle (
  hashed_identity text PRIMARY KEY CHECK (hashed_identity ~ '^[0-9a-f]{64}$'),
  period_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  blocked_until timestamptz,
  last_seen timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.yolo_auth_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.yolo_auth_throttle FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.yolo_auth_throttle TO service_role;

CREATE OR REPLACE FUNCTION public.yolo_auth_request_allowed(
  p_key text, p_limit integer, p_window_seconds integer, p_block_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  curr record;
  now_time timestamptz := clock_timestamp();
  new_hits integer;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[0-9a-f]{64}$' OR
     p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR
     p_window_seconds IS NULL OR p_window_seconds < 60 OR p_window_seconds > 86400 OR
     p_block_seconds IS NULL OR p_block_seconds < 60 OR p_block_seconds > 86400 THEN
    RETURN false;
  END IF;
  INSERT INTO public.yolo_auth_throttle(hashed_identity,period_start,hits,last_seen)
    VALUES (p_key,now_time,0,now_time)
    ON CONFLICT (hashed_identity) DO NOTHING;
  SELECT period_start,hits,blocked_until INTO curr
    FROM public.yolo_auth_throttle WHERE hashed_identity = p_key FOR UPDATE;
  IF curr.blocked_until IS NOT NULL AND curr.blocked_until > now_time THEN
    RETURN false;
  END IF;
  IF curr.period_start + make_interval(secs => p_window_seconds) <= now_time THEN
    new_hits := 1;
    UPDATE public.yolo_auth_throttle SET period_start = now_time, hits = new_hits,
      blocked_until = NULL, last_seen = now_time WHERE hashed_identity = p_key;
    RETURN true;
  END IF;
  new_hits := curr.hits + 1;
  UPDATE public.yolo_auth_throttle SET hits = new_hits,
    blocked_until = CASE WHEN new_hits > p_limit THEN now_time + make_interval(secs => p_block_seconds) ELSE NULL END,
    last_seen = now_time WHERE hashed_identity = p_key;
  RETURN new_hits <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.yolo_auth_request_allowed(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.yolo_auth_request_allowed(text, integer, integer, integer) TO service_role;
COMMIT;
-- Optional later maintenance: DELETE FROM public.yolo_auth_throttle WHERE last_seen < now() - interval '30 days';
