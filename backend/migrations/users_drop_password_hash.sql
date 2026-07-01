-- Passwords live in auth.users (Supabase Auth). Drop legacy public.users.password_hash.
-- Run once in the Supabase SQL Editor after users_to_supabase_auth.sql.

ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
