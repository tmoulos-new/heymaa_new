-- Soft delete for content tables. Run in Supabase SQL Editor.

ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_offers_is_deleted ON offers (is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_promotions_is_deleted ON promotions (is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_regions_is_deleted ON regions (is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_deleted ON invite_codes (is_deleted) WHERE is_deleted = false;
