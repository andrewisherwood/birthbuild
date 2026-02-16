-- Migration: Add preview/publish support
-- Adds "preview" status to site_specs and a preview_url column.
-- Build now deploys to a preview URL first; a separate publish action adds the custom domain.

-- 1. Expand allowed statuses to include "preview"
ALTER TABLE public.site_specs DROP CONSTRAINT IF EXISTS valid_site_spec_status;
ALTER TABLE public.site_specs ADD CONSTRAINT valid_site_spec_status
  CHECK (status IN ('draft', 'building', 'preview', 'live', 'error'));

-- 2. Add preview_url column (always populated after first build)
ALTER TABLE public.site_specs ADD COLUMN IF NOT EXISTS preview_url text;

-- 3. Backfill existing live sites with a preview_url
UPDATE public.site_specs
  SET preview_url = 'https://birthbuild-' || subdomain_slug || '.netlify.app'
  WHERE subdomain_slug IS NOT NULL AND preview_url IS NULL;
