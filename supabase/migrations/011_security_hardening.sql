-- 011_security_hardening.sql
-- Additional production hardening for rate limiting, subdomain safety, and mutable field controls.

-- ---------------------------------------------------------------------------
-- 1) Weighted rate limiting RPC (for endpoints that consume multiple units)
-- ---------------------------------------------------------------------------

create or replace function check_rate_limit_weighted(
  p_scope        text,
  p_user_id      uuid,
  p_max_requests integer,
  p_window_secs  integer,
  p_cost         integer
) returns boolean
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_cost integer;
begin
  v_cost := greatest(coalesce(p_cost, 1), 1);

  insert into rate_limits (scope, user_id, count, window_end)
  values (
    p_scope,
    p_user_id,
    v_cost,
    now() + (p_window_secs || ' seconds')::interval
  )
  on conflict (scope, user_id) do update
    set count = case
      when rate_limits.window_end < now() then v_cost
      else rate_limits.count + v_cost
    end,
    window_end = case
      when rate_limits.window_end < now()
        then now() + (p_window_secs || ' seconds')::interval
      else rate_limits.window_end
    end
  returning count into v_count;

  return v_count <= p_max_requests;
end;
$$;

grant execute on function check_rate_limit_weighted(text, uuid, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Subdomain hardening on site_specs
-- ---------------------------------------------------------------------------

-- Normalise existing slugs to lowercase + hyphenated form.
update public.site_specs
set subdomain_slug = left(
  trim(both '-' from regexp_replace(lower(trim(subdomain_slug)), '[^a-z0-9]+', '-', 'g')),
  63
)
where subdomain_slug is not null;

-- Drop empty/invalid/reserved slugs to null.
update public.site_specs
set subdomain_slug = null
where subdomain_slug is not null
  and (
    subdomain_slug = ''
    or subdomain_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    or subdomain_slug in ('www','api','app','admin','mail','ftp','cdn','assets','static','birthbuild')
  );

-- Resolve case-insensitive duplicates by nulling all but the earliest row.
with ranked as (
  select
    id,
    lower(subdomain_slug) as norm_slug,
    row_number() over (
      partition by lower(subdomain_slug)
      order by created_at asc, id asc
    ) as rn
  from public.site_specs
  where subdomain_slug is not null
)
update public.site_specs s
set subdomain_slug = null
from ranked r
where s.id = r.id
  and r.rn > 1;

alter table public.site_specs
  drop constraint if exists site_specs_subdomain_slug_format;

alter table public.site_specs
  add constraint site_specs_subdomain_slug_format
  check (
    subdomain_slug is null
    or (
      subdomain_slug = lower(subdomain_slug)
      and subdomain_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
      and subdomain_slug not in ('www','api','app','admin','mail','ftp','cdn','assets','static','birthbuild')
    )
  );

create unique index if not exists idx_site_specs_subdomain_slug_lower_unique
  on public.site_specs (lower(subdomain_slug))
  where subdomain_slug is not null;

-- ---------------------------------------------------------------------------
-- 3) Prevent authenticated clients from mutating deployment-sensitive fields
-- ---------------------------------------------------------------------------

create or replace function public.guard_site_spec_sensitive_fields()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant uuid;
  v_session uuid;
begin
  if auth.role() = 'authenticated' then
    v_tenant := public.get_user_tenant_id(auth.uid());
    v_session := public.get_user_session_id(auth.uid());

    if tg_op = 'INSERT' then
      if new.user_id is distinct from auth.uid() then
        raise exception 'Cannot create site spec for another user';
      end if;
      if new.tenant_id is distinct from v_tenant then
        raise exception 'tenant_id must match your profile';
      end if;
      if new.session_id is distinct from v_session then
        raise exception 'session_id must match your profile';
      end if;
      if new.status is distinct from 'draft' then
        raise exception 'Initial status must be draft';
      end if;
      if new.netlify_site_id is not null or new.deploy_url is not null or new.preview_url is not null then
        raise exception 'Deployment fields cannot be set by clients';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.user_id is distinct from old.user_id then
        raise exception 'Cannot modify user_id';
      end if;
      if new.tenant_id is distinct from old.tenant_id then
        raise exception 'Cannot modify tenant_id';
      end if;
      if new.session_id is distinct from old.session_id then
        raise exception 'Cannot modify session_id';
      end if;
      if new.status is distinct from old.status then
        raise exception 'Cannot modify status directly';
      end if;
      if new.netlify_site_id is distinct from old.netlify_site_id then
        raise exception 'Cannot modify netlify_site_id directly';
      end if;
      if new.deploy_url is distinct from old.deploy_url then
        raise exception 'Cannot modify deploy_url directly';
      end if;
      if new.preview_url is distinct from old.preview_url then
        raise exception 'Cannot modify preview_url directly';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_site_spec_sensitive_fields on public.site_specs;

create trigger enforce_site_spec_sensitive_fields
  before insert or update on public.site_specs
  for each row execute function public.guard_site_spec_sensitive_fields();

-- ---------------------------------------------------------------------------
-- 4) Prevent authenticated users from changing profile email directly
-- ---------------------------------------------------------------------------

create or replace function public.prevent_profile_field_changes()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    raise exception 'Cannot modify email field';
  end if;
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
