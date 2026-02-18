-- 006: LLM-powered site generation
-- Adds site_checkpoints table, retention trigger, feature flag, and RLS policies.

-- ---------------------------------------------------------------------------
-- Checkpoints: versioned HTML snapshots of generated sites
-- ---------------------------------------------------------------------------

create table public.site_checkpoints (
  id              uuid primary key default gen_random_uuid(),
  site_spec_id    uuid not null references public.site_specs(id) on delete cascade,
  version         int not null,
  html_pages      jsonb not null,         -- { pages: [{ filename, html }] }
  design_system   jsonb,                  -- { css, nav_html, footer_html } cached for edits
  label           text,
  created_at      timestamptz not null default now(),

  constraint unique_checkpoint_version unique (site_spec_id, version)
);

alter table public.site_checkpoints enable row level security;

-- Index for fast version lookups
create index idx_checkpoints_site_version
  on public.site_checkpoints(site_spec_id, version desc);

-- ---------------------------------------------------------------------------
-- Retention: prune to last 10 checkpoints per site on insert
-- ---------------------------------------------------------------------------

create or replace function public.prune_old_checkpoints()
returns trigger as $$
begin
  delete from public.site_checkpoints
  where site_spec_id = NEW.site_spec_id
    and id not in (
      select id from public.site_checkpoints
      where site_spec_id = NEW.site_spec_id
      order by version desc
      limit 10
    );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_prune_checkpoints
  after insert on public.site_checkpoints
  for each row execute function public.prune_old_checkpoints();

-- ---------------------------------------------------------------------------
-- RLS: students own their checkpoints via site_spec ownership
-- ---------------------------------------------------------------------------

create policy "students_own_checkpoints" on public.site_checkpoints
  for all using (
    site_spec_id in (select id from public.site_specs where user_id = auth.uid())
  ) with check (
    site_spec_id in (select id from public.site_specs where user_id = auth.uid())
  );

-- Instructors: read-only within their tenant
create policy "instructors_read_tenant_checkpoints" on public.site_checkpoints
  for select using (
    site_spec_id in (
      select id from public.site_specs
      where tenant_id in (select public.get_owned_tenant_ids(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Feature flag + latest checkpoint reference on site_specs
-- ---------------------------------------------------------------------------

alter table public.site_specs
  add column use_llm_generation boolean not null default false,
  add column latest_checkpoint_id uuid references public.site_checkpoints(id);
