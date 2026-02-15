-- ============================================================
-- BirthBuild Seed Data (local development)
-- ============================================================
-- Note: These UUIDs are deterministic for reproducible local dev.
-- In production, auth.users rows are created by Supabase Auth.

-- Create test users in auth.users (Supabase local dev)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'instructor@birthbuild.test',
    crypt('testpassword123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'student@birthbuild.test',
    crypt('testpassword123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    now(),
    now()
  )
on conflict (id) do nothing;

-- 1. Tenant
insert into public.tenants (id, name, owner_id, plan)
values (
  '10000000-0000-0000-0000-000000000001',
  'Jane''s Doula Academy',
  '00000000-0000-0000-0000-000000000001',
  'free'
);

-- 2. Session
insert into public.sessions (id, tenant_id, name, status)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Spring 2026 Cohort',
  'active'
);

-- 3. Profiles
insert into public.profiles (id, email, display_name, role, tenant_id, session_id)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'instructor@birthbuild.test',
    'Jane Smith',
    'instructor',
    '10000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'student@birthbuild.test',
    'Shellie Poulter',
    'student',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001'
  );

-- 4. Site Spec
insert into public.site_specs (
  id, user_id, tenant_id, session_id, status,
  business_name, doula_name, tagline, service_area,
  services, email, style, palette
)
values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'draft',
  'Shellie Poulter Doula Services',
  'Shellie Poulter',
  'Supporting you through birth and beyond',
  'Brighton & Hove',
  '[{"type": "birth_doula", "title": "Birth Doula Support", "description": "Continuous support during labour and birth.", "price": ""}]',
  'shellie@example.com',
  'modern',
  'sage_sand'
);
