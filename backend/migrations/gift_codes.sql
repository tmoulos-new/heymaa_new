-- Redeemable marketing gifts: free plan days and/or bonus points.
-- Run in Supabase SQL editor.

create table if not exists public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  status text not null default 'active',
  gift_type text not null,
  plan_slot text,
  days int,
  points int,
  label text,
  notes text,
  max_claims int,
  claim_count int not null default 0,
  expires_at timestamptz,
  is_deleted boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_codes_code_unique unique (code),
  constraint gift_codes_status_check check (status in ('active', 'inactive', 'expired')),
  constraint gift_codes_type_check check (gift_type in ('free_plan_days', 'bonus_points', 'combo')),
  constraint gift_codes_plan_slot_check check (
    plan_slot is null or plan_slot in ('starter', 'premium')
  ),
  constraint gift_codes_days_check check (days is null or days > 0),
  constraint gift_codes_points_check check (points is null or points <> 0),
  constraint gift_codes_max_claims_check check (max_claims is null or max_claims > 0)
);

create index if not exists gift_codes_active_idx
  on public.gift_codes (is_deleted, status, expires_at);

create table if not exists public.gift_claims (
  id uuid primary key default gen_random_uuid(),
  gift_code_id uuid not null references public.gift_codes (id) on delete cascade,
  code text not null,
  user_id uuid not null,
  claimed_at timestamptz not null default now(),
  result jsonb,
  constraint gift_claims_unique_user unique (gift_code_id, user_id)
);

create index if not exists gift_claims_user_idx on public.gift_claims (user_id);
create index if not exists gift_claims_code_idx on public.gift_claims (code);
