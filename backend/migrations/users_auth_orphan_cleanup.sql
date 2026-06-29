-- Run BEFORE users_to_supabase_auth.sql FK step (or re-run after a failed migration).
-- Beta policy: no backfill — legacy public.users rows without auth.users are removed.

-- Preview orphans (public.users with no auth.users row)
SELECT u.id, u.email, u.created_at
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL;

-- Preview auth-only rows (failed invites / incomplete signup)
SELECT a.id, a.email, a.created_at
FROM auth.users a
LEFT JOIN public.users u ON u.id = a.id
WHERE u.id IS NULL;

-- Remove dependent rows for orphan app users
DELETE FROM public.user_data
WHERE user_id IN (
  SELECT u.id FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  WHERE a.id IS NULL
);

DELETE FROM public.profiles
WHERE user_id IN (
  SELECT u.id FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  WHERE a.id IS NULL
);

DELETE FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

-- Remove auth accounts with no app profile (failed tester invites, etc.)
DELETE FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id);
