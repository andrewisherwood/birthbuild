-- Add advanced design configuration column to site_specs.
-- When populated, overrides base style/palette/typography fields for site generation.
-- Null = use base fields (backward compatible).

ALTER TABLE public.site_specs ADD COLUMN IF NOT EXISTS design jsonb;

COMMENT ON COLUMN public.site_specs.design IS
  'Advanced design config (colours, typography, spacing, borderRadius). Overrides base style/palette/typography when present.';
