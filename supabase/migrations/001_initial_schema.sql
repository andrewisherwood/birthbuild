-- ============================================================
-- BirthBuild Initial Schema
-- ============================================================

-- --------------------------------------------------------
-- 1. Tenants (instructors / organisations)
-- --------------------------------------------------------
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_id      uuid references auth.users(id),
  plan          text not null default 'free',
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.tenants enable row level security;

-- Tenant owners can do everything with their own tenant
create policy "tenant_owner_all" on public.tenants
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Members of a tenant can read tenant info (excludes secrets)
create policy "tenant_members_read" on public.tenants
  for select
  using (
    id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );

-- --------------------------------------------------------
-- 1b. Tenant Secrets (owner-only access to sensitive keys)
-- SEC-003: claude_api_key moved here from tenants table
-- --------------------------------------------------------
create table public.tenant_secrets (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  claude_api_key text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.tenant_secrets enable row level security;

-- Only the tenant owner can access secrets
create policy "owner_only" on public.tenant_secrets
  for all
  using (
    tenant_id in (select id from public.tenants where owner_id = auth.uid())
  )
  with check (
    tenant_id in (select id from public.tenants where owner_id = auth.uid())
  );

-- --------------------------------------------------------
-- 2. Sessions (workshop instances)
-- --------------------------------------------------------
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- NOTE-002: Constrain session status to valid values
alter table public.sessions add constraint valid_session_status check (status in ('active', 'archived', 'completed'));

alter table public.sessions enable row level security;

-- Instructors (tenant owners) manage sessions in their tenant
create policy "sessions_instructor_all" on public.sessions
  for all
  using (
    tenant_id in (
      select id from public.tenants where owner_id = auth.uid()
    )
  )
  with check (
    tenant_id in (
      select id from public.tenants where owner_id = auth.uid()
    )
  );

-- Students can read the session they belong to
create policy "sessions_student_read" on public.sessions
  for select
  using (
    id in (
      select session_id from public.profiles where id = auth.uid()
    )
  );

-- --------------------------------------------------------
-- 3. Profiles (users — students and instructors)
-- --------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id),
  email         text not null,
  display_name  text,
  role          text not null default 'student',
  tenant_id     uuid references public.tenants(id),
  session_id    uuid references public.sessions(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- SEC-001: Constrain role to valid values
alter table public.profiles add constraint valid_role check (role in ('student', 'instructor', 'admin'));

alter table public.profiles enable row level security;

-- SEC-001/SEC-002: Separate SELECT and UPDATE policies (no INSERT/DELETE via RLS for own profile)
-- Users can read their own profile
create policy "profiles_own_select" on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update their own profile (trigger enforces immutable fields)
create policy "profiles_own_update" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- SEC-001/SEC-002: Prevent users from modifying role, tenant_id, or session_id
create or replace function public.prevent_profile_field_changes()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Cannot modify role field';
  end if;
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Cannot modify tenant_id field';
  end if;
  if new.session_id is distinct from old.session_id then
    raise exception 'Cannot modify session_id field';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger enforce_profile_immutable_fields
  before update on public.profiles
  for each row execute function public.prevent_profile_field_changes();

-- Instructors can read profiles in their tenant
create policy "profiles_instructor_read" on public.profiles
  for select
  using (
    tenant_id in (
      select id from public.tenants where owner_id = auth.uid()
    )
  );

-- --------------------------------------------------------
-- 4. Site Specs (the core data object)
-- --------------------------------------------------------
create table public.site_specs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tenant_id       uuid references public.tenants(id),
  session_id      uuid references public.sessions(id),
  status          text not null default 'draft'
    constraint valid_site_spec_status check (status in ('draft', 'building', 'live', 'error')),

  -- Business info
  business_name   text,
  doula_name      text,
  tagline         text,
  service_area    text,
  services        jsonb not null default '[]',

  -- Contact
  email           text,
  phone           text,
  booking_url     text,
  social_links    jsonb not null default '{}',

  -- Content
  bio             text,
  philosophy      text,
  testimonials    jsonb not null default '[]',
  faq_enabled     boolean not null default true,
  blog_enabled    boolean not null default false,

  -- Design
  style           text not null default 'modern',
  palette         text not null default 'sage_sand',
  custom_colours  jsonb,
  typography      text not null default 'modern',
  font_heading    text,
  font_body       text,

  -- Accreditation
  doula_uk        boolean not null default false,
  training_provider text,

  -- SEO
  primary_keyword text,

  -- Pages to generate
  pages           jsonb not null default '["home","about","services","contact"]',

  -- Deployment
  subdomain_slug  text unique,
  netlify_site_id text,
  deploy_url      text,

  -- Chat history
  chat_history    jsonb not null default '[]',

  -- Metadata
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.site_specs enable row level security;

-- Students own their own specs
create policy "site_specs_student_all" on public.site_specs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Instructors can read specs in their tenant
create policy "site_specs_instructor_read" on public.site_specs
  for select
  using (
    tenant_id in (
      select id from public.tenants where owner_id = auth.uid()
    )
  );

-- --------------------------------------------------------
-- 5. Photos
-- --------------------------------------------------------
create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  site_spec_id  uuid not null references public.site_specs(id) on delete cascade,
  storage_path  text not null,
  purpose       text,
  alt_text      text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.photos enable row level security;

-- Students manage photos on their own specs
create policy "photos_student_all" on public.photos
  for all
  using (
    site_spec_id in (
      select id from public.site_specs where user_id = auth.uid()
    )
  )
  with check (
    site_spec_id in (
      select id from public.site_specs where user_id = auth.uid()
    )
  );

-- Instructors can read photos for specs in their tenant
create policy "photos_instructor_read" on public.photos
  for select
  using (
    site_spec_id in (
      select id from public.site_specs
      where tenant_id in (
        select id from public.tenants where owner_id = auth.uid()
      )
    )
  );

-- --------------------------------------------------------
-- 6. updated_at auto-update trigger
-- --------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.handle_updated_at();

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.handle_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger site_specs_updated_at
  before update on public.site_specs
  for each row execute function public.handle_updated_at();

create trigger tenant_secrets_updated_at
  before update on public.tenant_secrets
  for each row execute function public.handle_updated_at();
