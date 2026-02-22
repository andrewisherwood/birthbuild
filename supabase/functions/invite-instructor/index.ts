/**
 * Invite-Instructor Edge Function.
 *
 * Creates a new instructor account: auth user + tenant + profile.
 * Sends a magic link email and returns the link URL.
 *
 * Auth: JWT via Authorization header. Caller must have role = "admin".
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteInstructorBody {
  email: string;
  org_name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const MAX_ORG_NAME_LENGTH = 120;
const RATE_LIMIT_SCOPE = "invite-instructor";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour
const MAX_REQUEST_BODY_BYTES = 32 * 1024; // 32KB

async function isRateLimited(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient.rpc("check_rate_limit", {
      p_scope: RATE_LIMIT_SCOPE,
      p_user_id: userId,
      p_max_requests: RATE_LIMIT_MAX,
      p_window_secs: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
    if (error) {
      console.error("[invite-instructor] Rate-limit RPC error:", error.message);
      return true;
    }
    return data === false;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[invite-instructor] Rate-limit unexpected error:", detail);
    return true;
  }
}

function checkBodySize(req: Request): boolean {
  const contentLength = req.headers.get("content-length");
  if (!contentLength) return true;
  const parsed = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= MAX_REQUEST_BODY_BYTES;
}

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

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // -------------------------------------------------------------------------
  // 1. Authenticate caller via JWT
  // -------------------------------------------------------------------------

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorisation header." }),
      {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
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
    return new Response(
      JSON.stringify({ error: "Invalid or expired token." }),
      {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 2. Verify caller is an admin
  // -------------------------------------------------------------------------

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: callerProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !callerProfile) {
    return new Response(
      JSON.stringify({ error: "User profile not found." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (callerProfile.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Only admins can invite instructors." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 3. Parse & validate request body
  // -------------------------------------------------------------------------

  if (!checkBodySize(req)) {
    return new Response(
      JSON.stringify({ error: "Request body too large." }),
      {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  let body: InviteInstructorBody;
  try {
    body = (await req.json()) as InviteInstructorBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const orgName =
    typeof body.org_name === "string" ? body.org_name.trim() : "";

  if (email.length > MAX_EMAIL_LENGTH) {
    return new Response(
      JSON.stringify({ error: "Email address is too long." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return new Response(
      JSON.stringify({ error: "A valid email address is required." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (!orgName) {
    return new Response(
      JSON.stringify({ error: "Organisation name is required." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (orgName.length > MAX_ORG_NAME_LENGTH) {
    return new Response(
      JSON.stringify({ error: "Organisation name is too long." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Rate limit after basic validation to avoid charging malformed payloads.
  if (await isRateLimited(serviceClient, user.id)) {
    return new Response(
      JSON.stringify({
        error:
          "You have reached the instructor invite limit. Please wait before trying again.",
      }),
      {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 4. Check email doesn't already have a profile
  // -------------------------------------------------------------------------

  const { data: existingProfile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return new Response(
      JSON.stringify({ error: "An account with this email already exists." }),
      {
        status: 409,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 5. Create auth user
  // -------------------------------------------------------------------------

  const { data: newUser, error: createUserError } =
    await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });

  if (createUserError || !newUser?.user) {
    console.error(
      `[invite-instructor] Failed to create user for ${email}:`,
      createUserError?.message ?? "Unknown error",
    );
    return new Response(
      JSON.stringify({ error: "Failed to create user account." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const newUserId = newUser.user.id;

  // -------------------------------------------------------------------------
  // 6. Create tenant
  // -------------------------------------------------------------------------

  const { data: newTenant, error: tenantError } = await serviceClient
    .from("tenants")
    .insert({ name: orgName, owner_id: newUserId })
    .select("id")
    .single();

  if (tenantError || !newTenant) {
    console.error(
      `[invite-instructor] Failed to create tenant for ${email}:`,
      tenantError?.message ?? "Unknown error",
    );
    return new Response(
      JSON.stringify({ error: "Failed to create organisation." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 7. Upsert profile (trigger may have created a bare row)
  // -------------------------------------------------------------------------

  const { error: profileUpsertError } = await serviceClient
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        email,
        role: "instructor",
        tenant_id: newTenant.id,
      },
      { onConflict: "id" },
    );

  if (profileUpsertError) {
    console.error(
      `[invite-instructor] Failed to upsert profile for ${email}:`,
      profileUpsertError.message,
    );
    return new Response(
      JSON.stringify({ error: "Failed to create instructor profile." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 8. Generate magic link
  // -------------------------------------------------------------------------

  const { data: linkData, error: linkError } =
    await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error(
      `[invite-instructor] Failed to generate link for ${email}:`,
      linkError?.message ?? "No action_link returned",
    );
    return new Response(
      JSON.stringify({ error: "Failed to generate magic link." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -------------------------------------------------------------------------
  // 9. Send magic link email via OTP endpoint
  // -------------------------------------------------------------------------

  const otpResponse = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email }),
  });

  if (!otpResponse.ok) {
    const otpBody = await otpResponse.text();
    console.error(
      `[invite-instructor] Failed to send magic link email for ${email}:`,
      otpBody,
    );
    // Still succeed — admin can copy the link manually
  }

  // -------------------------------------------------------------------------
  // 10. Return result
  // -------------------------------------------------------------------------

  return new Response(
    JSON.stringify({
      success: true,
      magic_link: linkData.properties.action_link,
    }),
    {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
