import { supabase } from "@/lib/supabase";

/**
 * Fire-and-forget event logging to the app_events table.
 * Never throws — swallows errors to avoid disrupting user flows.
 */
export function logEvent(
  event: string,
  metadata: Record<string, unknown> = {},
  options?: { siteSpecId?: string; userId?: string },
): void {
  const row: Record<string, unknown> = {
    event,
    metadata,
  };
  if (options?.siteSpecId) row.site_spec_id = options.siteSpecId;
  if (options?.userId) row.user_id = options.userId;

  void supabase.from("app_events").insert(row).then(({ error }) => {
    if (error) {
      console.warn("[logEvent] Failed to log event:", event, error.message);
    }
  });
}
