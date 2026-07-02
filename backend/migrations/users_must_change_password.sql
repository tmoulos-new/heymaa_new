-- Require user to pick a new password after admin-assigned temporary password.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.must_change_password IS 'When true, user must set a new password before using the app.';
