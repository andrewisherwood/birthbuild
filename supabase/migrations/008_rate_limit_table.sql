-- ============================================================
-- DB-backed rate limiting for Edge Functions
--
-- Replaces the in-memory Map that resets on every cold start.
-- Uses a single atomic RPC call to check + increment.
-- ============================================================

create table if not exists rate_limits (
  scope      text    not null,
  user_id    uuid    not null,
  count      integer not null default 1,
  window_end timestamptz not null,
  primary key (scope, user_id)
);

-- RPC: check_rate_limit(scope, user_id, max_requests, window_seconds)
-- Returns true if the request is ALLOWED, false if rate-limited.
-- Atomically creates/updates the counter in a single statement.
create or replace function check_rate_limit(
  p_scope        text,
  p_user_id      uuid,
  p_max_requests integer,
  p_window_secs  integer
) returns boolean
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  -- Upsert: if expired or missing, start a new window; otherwise increment.
  insert into rate_limits (scope, user_id, count, window_end)
  values (
    p_scope,
    p_user_id,
    1,
    now() + (p_window_secs || ' seconds')::interval
  )
  on conflict (scope, user_id) do update
    set count = case
      when rate_limits.window_end < now() then 1          -- window expired, reset
      else rate_limits.count + 1                          -- still in window, increment
    end,
    window_end = case
      when rate_limits.window_end < now()
        then now() + (p_window_secs || ' seconds')::interval  -- new window
      else rate_limits.window_end                              -- keep existing
    end
  returning count into v_count;

  return v_count <= p_max_requests;
end;
$$;

-- Allow service role to call the function (Edge Functions use service role)
grant execute on function check_rate_limit to service_role;

-- Periodic cleanup: delete expired rows (optional, keeps table small)
-- Can be called from a cron job or pg_cron extension.
create or replace function cleanup_expired_rate_limits()
returns void
language sql
security definer
as $$
  delete from rate_limits where window_end < now();
$$;
