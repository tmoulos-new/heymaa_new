-- App roles for dashboard access (null = regular user, 'admin' = admin UI).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT NULL;

COMMENT ON COLUMN public.users.role IS 'null = regular user; admin = HeyMaa admin dashboard access';
