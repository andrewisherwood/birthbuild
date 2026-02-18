-- 009_spec_density_fields.sql
-- Add specification density fields for the elicitation engine.
-- philosophy already exists (001_initial_schema.sql).
-- services/testimonials depth fields live in JSONB structure — no DDL needed.

alter table public.site_specs add column if not exists primary_location text;
alter table public.site_specs add column if not exists bio_previous_career text;
alter table public.site_specs add column if not exists bio_origin_story text;
alter table public.site_specs add column if not exists training_year text;
alter table public.site_specs add column if not exists additional_training text[] default '{}';
alter table public.site_specs add column if not exists client_perception text;
alter table public.site_specs add column if not exists signature_story text;
alter table public.site_specs add column if not exists brand_feeling text;
alter table public.site_specs add column if not exists style_inspiration_url text;
