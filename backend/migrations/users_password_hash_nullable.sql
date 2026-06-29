-- Passwords live in auth.users after Supabase Auth migration.
-- public.users.password_hash is legacy; invited users have no hash until they set a password.

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
