-- ============================================================
-- BirthBuild Initial Schema
-- ============================================================

-- --------------------------------------------------------
-- 1. Create all tables
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

create table public.tenant_secrets (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  claude_api_key text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.tenant_secrets enable row level security;

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.sessions add constraint valid_session_status check (status in ('active', 'archived', 'completed'));
alter table public.sessions enable row level security;

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
alter table public.profiles add constraint valid_role check (role in ('student', 'instructor', 'admin'));
alter table public.profiles enable row level security;

create table public.site_specs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tenant_id       uuid references public.tenants(id),
  session_id      uuid references public.sessions(id),
  status          text not null default 'draft'
    constraint valid_site_spec_status check (status in ('draft', 'building', 'live', 'error')),
  business_name   text,
  doula_name      text,
  tagline         text,
  service_area    text,
  services        jsonb not null default '[]',
  email           text,
  phone           text,
  booking_url     text,
  social_links    jsonb not null default '{}',
  bio             text,
  philosophy      text,
  testimonials    jsonb not null default '[]',
  faq_enabled     boolean not null default true,
  blog_enabled    boolean not null default false,
  style           text not null default 'modern',
  palette         text not null default 'sage_sand',
  custom_colours  jsonb,
  typography      text not null default 'modern',
  font_heading    text,
  font_body       text,
  doula_uk        boolean not null default false,
  training_provider text,
  primary_keyword text,
  pages           jsonb not null default '["home","about","services","contact"]',
  subdomain_slug  text unique,
  netlify_site_id text,
  deploy_url      text,
  chat_history    jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.site_specs enable row level security;

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

-- --------------------------------------------------------
-- 2. Security-definer helpers (bypass RLS to break circular refs)
-- --------------------------------------------------------

-- Returns the tenant_id for a given user from profiles (no RLS check)
create or replace function public.get_user_tenant_id(p_user_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select tenant_id from public.profiles where id = p_user_id limit 1;
$$;

-- Returns the session_id for a given user from profiles (no RLS check)
create or replace function public.get_user_session_id(p_user_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select session_id from public.profiles where id = p_user_id limit 1;
$$;

-- Returns tenant IDs owned by a given user (no RLS check)
create or replace function public.get_owned_tenant_ids(p_owner_id uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select id from public.tenants where owner_id = p_owner_id;
$$;

-- --------------------------------------------------------
-- 3. RLS Policies (using helper functions to avoid recursion)
-- --------------------------------------------------------

-- Tenants
create policy "tenant_owner_all" on public.tenants
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "tenant_members_read" on public.tenants
  for select
  using (id = public.get_user_tenant_id(auth.uid()));

-- Tenant Secrets
create policy "owner_only" on public.tenant_secrets
  for all
  using (tenant_id in (select public.get_owned_tenant_ids(auth.uid())))
  with check (tenant_id in (select public.get_owned_tenant_ids(auth.uid())));

-- Sessions
create policy "sessions_instructor_all" on public.sessions
  for all
  using (tenant_id in (select public.get_owned_tenant_ids(auth.uid())))
  with check (tenant_id in (select public.get_owned_tenant_ids(auth.uid())));

create policy "sessions_student_read" on public.sessions
  for select
  using (id = public.get_user_session_id(auth.uid()));

-- Profiles
create policy "profiles_own_select" on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_own_update" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_instructor_read" on public.profiles
  for select
  using (tenant_id in (select public.get_owned_tenant_ids(auth.uid())));

-- Site Specs
create policy "site_specs_student_all" on public.site_specs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "site_specs_instructor_read" on public.site_specs
  for select
  using (tenant_id in (select public.get_owned_tenant_ids(auth.uid())));

-- Photos
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

create policy "photos_instructor_read" on public.photos
  for select
  using (
    site_spec_id in (
      select id from public.site_specs
      where tenant_id in (select public.get_owned_tenant_ids(auth.uid()))
    )
  );

-- --------------------------------------------------------
-- 4. Triggers and functions
-- --------------------------------------------------------

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
