/**
 * Direct access-token retrieval that bypasses the Supabase SDK's auth lock.
 *
 * The SDK's auth module uses an internal lock (navigator.locks or our custom
 * mutex) to serialise auth operations.  When the lock chain is corrupted —
 * e.g. by React 18 Strict Mode double-mounts or WebSocket reconnection
 * races — every SDK auth call (getSession, refreshSession, invoke) hangs
 * indefinitely.
 *
 * This module reads the persisted session straight from localStorage and,
 * when the access token is expired, refreshes it via a raw fetch to the
 * GoTrue endpoint — zero SDK involvement.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// The SDK stores its session under this localStorage key.
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
}

/**
 * Return a usable access token, refreshing via raw fetch if necessary.
 * Returns `null` when the user is not signed in or the refresh fails.
 */
export async function getAccessTokenDirect(): Promise<string | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  let stored: StoredSession;
  try {
    stored = JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }

  if (!stored.access_token || !stored.refresh_token) return null;

  const now = Math.floor(Date.now() / 1000);

  // Token still valid (30s buffer for network latency)
  if (stored.expires_at - now > 30) {
    return stored.access_token;
  }

  // Token expired — refresh via raw GoTrue endpoint
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: stored.refresh_token }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Merge refreshed tokens into the existing stored object so the SDK's
    // additional fields (user, token_type, etc.) are preserved.
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // If the existing value is unparseable, start fresh
    }
    const updated = {
      ...existing,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now + data.expires_in,
      expires_in: data.expires_in,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return data.access_token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Storage bypass helpers (photos bucket is public for reads, auth for writes)
// ---------------------------------------------------------------------------

/**
 * Upload a file to Supabase Storage via raw fetch, bypassing the SDK auth lock.
 */
export async function uploadStorageBypass(
  bucket: string,
  path: string,
  file: File,
  options?: { cacheControl?: string; upsert?: boolean },
): Promise<{ error: string | null }> {
  const accessToken = await getAccessTokenDirect();
  if (!accessToken) {
    return { error: "Your session has expired. Please sign in again." };
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        ...(options?.cacheControl ? { "cache-control": options.cacheControl } : {}),
        ...(options?.upsert ? { "x-upsert": "true" } : {}),
      },
      body: file,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { error: text || `Upload failed: HTTP ${response.status}` };
    }

    return { error: null };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Network error";
    return { error: `Upload failed: ${detail}` };
  }
}

/**
 * Remove files from Supabase Storage via raw fetch, bypassing the SDK auth lock.
 */
export async function removeStorageBypass(
  bucket: string,
  paths: string[],
): Promise<{ error: string | null }> {
  const accessToken = await getAccessTokenDirect();
  if (!accessToken) {
    return { error: "Your session has expired. Please sign in again." };
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ prefixes: paths }),
    });

    if (!response.ok) {
      return { error: `Delete failed: HTTP ${response.status}` };
    }

    return { error: null };
  } catch {
    return { error: "Network error during delete." };
  }
}

/**
 * Build a public URL for a file in a public Supabase Storage bucket.
 * No auth needed — the photos bucket is public (migration 007).
 */
export function getPublicStorageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ---------------------------------------------------------------------------
// PostgREST bypass (DB queries without SDK auth lock)
// ---------------------------------------------------------------------------

interface PostgrestBypassOptions {
  table: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** PostgREST query string, e.g. "select=id&site_spec_id=eq.xxx&order=version.desc&limit=1" */
  queryParams?: string;
  body?: unknown;
  /** Extra headers (e.g. Prefer: return=representation) */
  headers?: Record<string, string>;
}

interface PostgrestBypassResult<T> {
  data: T | null;
  error: string | null;
  statusCode: number;
}

/**
 * Execute a raw PostgREST query, bypassing the SDK auth lock.
 *
 * The Supabase JS client's `.from()` calls go through the shared auth module
 * to obtain headers. When the auth lock is corrupted (React 18 double-mounts,
 * WebSocket reconnection races), these calls hang indefinitely — the same
 * issue that affects `functions.invoke()` and Storage writes.
 *
 * Use this for critical DB operations that must not hang.
 */
export async function postgrestBypass<T = unknown>(
  opts: PostgrestBypassOptions,
): Promise<PostgrestBypassResult<T>> {
  const accessToken = await getAccessTokenDirect();
  if (!accessToken) {
    return { data: null, error: "Your session has expired. Please sign in again.", statusCode: 0 };
  }

  const qs = opts.queryParams ? `?${opts.queryParams}` : "";
  const url = `${SUPABASE_URL}/rest/v1/${opts.table}${qs}`;
  const method = opts.method ?? "GET";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Network error";
    console.error(`[postgrestBypass] Fetch failed for ${method} ${opts.table}:`, detail);
    return { data: null, error: `Network error: ${detail}`, statusCode: 0 };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errorMessage = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      if (parsed.message) errorMessage = parsed.message;
    } catch {
      if (text) errorMessage = text;
    }
    return { data: null, error: errorMessage, statusCode: response.status };
  }

  // PATCH/DELETE may return 204 No Content
  if (response.status === 204) {
    return { data: null, error: null, statusCode: 204 };
  }

  try {
    const data = (await response.json()) as T;
    return { data, error: null, statusCode: response.status };
  } catch {
    return { data: null, error: "Failed to parse response.", statusCode: response.status };
  }
}

// ---------------------------------------------------------------------------
// Edge Function bypass
// ---------------------------------------------------------------------------

/**
 * Invoke a Supabase Edge Function via raw fetch, completely bypassing the SDK.
 */
export async function invokeEdgeFunctionBypass<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const accessToken = await getAccessTokenDirect();
  if (!accessToken) {
    return { data: null, error: "Your session has expired. Please sign in again." };
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Network error";
    console.error(`[invokeEdgeFunctionBypass] fetch failed for ${functionName}:`, detail);
    return { data: null, error: "Network error. Please check your connection and try again." };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errorMessage = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) errorMessage = parsed.error;
    } catch {
      if (text) errorMessage = text;
    }
    return { data: null, error: errorMessage };
  }

  try {
    const data = (await response.json()) as T;
    return { data, error: null };
  } catch {
    console.error(`[invokeEdgeFunctionBypass] Failed to parse JSON from ${functionName}`);
    return { data: null, error: "Unexpected response from server." };
  }
}
