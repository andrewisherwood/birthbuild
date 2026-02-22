/**
 * Shared helpers for Edge Functions: CORS, auth, rate limiting, responses.
 *
 * Every generation Edge Function uses the same patterns for
 * authentication, tenant API key lookup, and rate limiting.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://birthbuild.com",
  "https://www.birthbuild.com",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[\w-]+--birthbuild\.netlify\.app$/.test(origin)) return true;
  return false;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ---------------------------------------------------------------------------
// Rate limiting (DB-backed, survives cold starts)
// ---------------------------------------------------------------------------

/**
 * Check if a user is rate-limited for a given scope.
 * Uses the check_rate_limit RPC which atomically checks + increments
 * a counter in the rate_limits table.
 *
 * Returns true if the user IS rate-limited (should be blocked).
 */
export async function isRateLimited(
  scope: string,
  userId: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const windowSecs = Math.ceil(windowMs / 1000);

  try {
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.rpc("check_rate_limit", {
      p_scope: scope,
      p_user_id: userId,
      p_max_requests: maxRequests,
      p_window_secs: windowSecs,
    });

    if (error) {
      // Fail closed for security/cost-protection endpoints.
      console.error(`[rate-limit] RPC error for ${scope}:`, error.message);
      return true;
    }

    // RPC returns true if ALLOWED, we return true if LIMITED
    return data === false;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error(`[rate-limit] Unexpected error for ${scope}:`, detail);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Body size validation
// ---------------------------------------------------------------------------

const DEFAULT_MAX_BODY_BYTES = 1_048_576; // 1 MB

/**
 * Check Content-Length header and reject oversized payloads before parsing.
 * Returns an error Response if too large, null if OK.
 */
export function checkBodySize(
  req: Request,
  cors: Record<string, string>,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Response | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return jsonResponse(
      { error: `Request body too large. Maximum size is ${Math.round(maxBytes / 1024)}KB.` },
      413,
      cors,
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auth + tenant API key resolution
// ---------------------------------------------------------------------------

export interface AuthResult {
  userId: string;
  claudeApiKey: string;
}

/**
 * Authenticate the caller and resolve their tenant's Claude API key.
 * Returns null + an error Response if auth fails.
 */
export async function authenticateAndGetApiKey(
  req: Request,
  cors: Record<string, string>,
): Promise<{ auth: AuthResult | null; error: Response | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      auth: null,
      error: jsonResponse({ error: "Missing authorisation header." }, 401, cors),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return {
      auth: null,
      error: jsonResponse({ error: "Invalid or expired token." }, 401, cors),
    };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return {
      auth: null,
      error: jsonResponse({ error: "User profile or tenant not found." }, 403, cors),
    };
  }

  const { data: secret, error: secretError } = await serviceClient
    .from("tenant_secrets")
    .select("claude_api_key")
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (secretError || !secret?.claude_api_key) {
    return {
      auth: null,
      error: jsonResponse(
        { error: "Your instructor has not configured an API key." },
        403,
        cors,
      ),
    };
  }

  return {
    auth: { userId: user.id, claudeApiKey: secret.claude_api_key },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Service client helper
// ---------------------------------------------------------------------------

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ---------------------------------------------------------------------------
// JSON response helpers
// ---------------------------------------------------------------------------

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
