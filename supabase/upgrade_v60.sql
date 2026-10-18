-- YOLO V6.0 - password authentication, preserving existing account IDs and data.
-- Back up your Supabase data first. Run ONCE in your existing YOLO project.
-- Does not delete existing PINs, tasks, journals, subjects, sessions, or accounts.
BEGIN;
ALTER TABLE public.pin_credentials ADD COLUMN IF NOT EXISTS password_hash text;
-- New friends can register without a legacy 4-digit PIN.
ALTER TABLE public.pin_credentials ALTER COLUMN pin_hash DROP NOT NULL;
-- Preserve the existing V5.3 per-user atomic failed-login lockout.
-- Do not grant client-side access to credential rows.
REVOKE ALL ON TABLE public.pin_credentials FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pin_credentials TO service_role;
COMMIT;
