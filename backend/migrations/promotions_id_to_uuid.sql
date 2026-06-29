-- Convert promotions.id from bigint (int8) to uuid.
-- Run in Supabase SQL Editor. Safe if table is empty or has existing rows.

ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_pkey;

ALTER TABLE public.promotions ADD COLUMN id_uuid uuid;

UPDATE public.promotions SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;

ALTER TABLE public.promotions ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE public.promotions ALTER COLUMN id_uuid SET DEFAULT gen_random_uuid();

ALTER TABLE public.promotions DROP COLUMN id;
ALTER TABLE public.promotions RENAME COLUMN id_uuid TO id;

ALTER TABLE public.promotions ADD PRIMARY KEY (id);

DROP SEQUENCE IF EXISTS public.promotions_id_seq;

NOTIFY pgrst, 'reload schema';
