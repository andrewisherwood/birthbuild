-- Event logging for analytics, debugging, and security monitoring.

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  site_spec_id uuid references public.site_specs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Index for querying by event type and time range
create index idx_app_events_event_created on public.app_events (event, created_at desc);

-- Index for querying by user
create index idx_app_events_user on public.app_events (user_id, created_at desc);

-- RLS: users can insert their own events, admins/instructors can read all
alter table public.app_events enable row level security;

create policy "Users can insert own events"
  on public.app_events for insert
  with check (auth.uid() = user_id);

create policy "Admins can read all events"
  on public.app_events for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'instructor')
    )
  );
