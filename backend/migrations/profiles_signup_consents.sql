-- Signup consent flags on profiles (run in Supabase SQL Editor).
-- Stores the three auth checkboxes from /app/auth registration.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS want_child boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_privacy boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_privacy_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_terms boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_terms_at timestamptz;
-- pregnancy_active, consent_marketing, consent_date may already exist on older installs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pregnancy_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_marketing boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_date timestamptz;

COMMENT ON COLUMN public.profiles.want_child IS 'User wants to have a child (signup checkbox)';
COMMENT ON COLUMN public.profiles.pregnancy_active IS 'User is pregnant or already a mom (signup checkbox)';
COMMENT ON COLUMN public.profiles.consent_marketing IS 'Newsletter / motherhood tips opt-in';
COMMENT ON COLUMN public.profiles.consent_privacy IS 'Accepted privacy policy at signup';
COMMENT ON COLUMN public.profiles.consent_terms IS 'Accepted terms and conditions at signup';
