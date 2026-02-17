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

    // Persist the refreshed session so the SDK picks it up on next page load
    const updated: StoredSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: now + data.expires_in,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return data.access_token;
  } catch {
    return null;
  }
}

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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) errorMessage = parsed.error;
    } catch {
      if (text) errorMessage = text;
    }
    return { data: null, error: errorMessage };
  }

  const data = (await response.json()) as T;
  return { data, error: null };
}
