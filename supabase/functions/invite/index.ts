/**
 * Invite Edge Function.
 *
 * Receives a list of student emails and a session_id from an instructor,
 * creates user accounts (or finds existing ones), generates magic links,
 * and returns the results.
 *
 * Auth: JWT via Authorization header (same pattern as chat/build Edge Functions).
 * Rate limit: 100 invites per hour per instructor.
 * Max: 50 emails per request.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteRequestBody {
  emails: string[];
  session_id: string;
}

interface InviteResultItem {
  email: string;
  success: boolean;
  magic_link?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EMAILS_PER_REQUEST = 50;
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour
const RATE_LIMIT_SCOPE = "invite";
const MAX_REQUEST_BODY_BYTES = 128 * 1024; // 128KB

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function isRateLimited(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  emailCount: number,
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient.rpc("check_rate_limit_weighted", {
      p_scope: RATE_LIMIT_SCOPE,
      p_user_id: userId,
      p_max_requests: RATE_LIMIT_MAX,
      p_window_secs: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      p_cost: emailCount,
    });
    if (error) {
      console.error("[invite] Rate-limit RPC error:", error.message);
      return true;
    }
    return data === false;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[invite] Rate-limit unexpected error:", detail);
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
// CORS (same origins as chat/build)
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

  // -----------------------------------------------------------------------
  // 1. Authenticate the user via JWT
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // 2. Verify caller is an instructor
  // -----------------------------------------------------------------------

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: callerProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role, tenant_id")
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

  if (callerProfile.role !== "instructor") {
    return new Response(
      JSON.stringify({ error: "Only instructors can invite students." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (!callerProfile.tenant_id) {
    return new Response(
      JSON.stringify({ error: "No tenant associated with your account." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const tenantId = callerProfile.tenant_id as string;

  // -----------------------------------------------------------------------
  // 3. Parse & validate request body
  // -----------------------------------------------------------------------

  if (!checkBodySize(req)) {
    return new Response(
      JSON.stringify({ error: "Request body too large." }),
      {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  let body: InviteRequestBody;
  try {
    body = (await req.json()) as InviteRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!body.emails || !Array.isArray(body.emails)) {
    return new Response(
      JSON.stringify({ error: "Missing required field: emails." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (!body.session_id || typeof body.session_id !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing required field: session_id." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Validate session_id is a valid UUID
  if (!UUID_REGEX.test(body.session_id)) {
    return new Response(
      JSON.stringify({ error: "Invalid session ID format." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (body.emails.length === 0) {
    return new Response(
      JSON.stringify({ error: "No email addresses provided." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (body.emails.length > MAX_EMAILS_PER_REQUEST) {
    return new Response(
      JSON.stringify({
        error: `Maximum ${MAX_EMAILS_PER_REQUEST} emails per request.`,
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 4. Rate limiting
  // -----------------------------------------------------------------------

  if (await isRateLimited(serviceClient, user.id, body.emails.length)) {
    return new Response(
      JSON.stringify({
        error:
          "You have reached the invite limit. Please wait before trying again.",
      }),
      {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 5. Verify session belongs to caller's tenant and is active
  // -----------------------------------------------------------------------

  const { data: session, error: sessionError } = await serviceClient
    .from("sessions")
    .select("id, tenant_id, status")
    .eq("id", body.session_id)
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: "Session not found." }),
      {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (session.tenant_id !== tenantId) {
    return new Response(
      JSON.stringify({
        error: "You do not have permission to invite to this session.",
      }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (session.status !== "active") {
    return new Response(
      JSON.stringify({
        error: "Cannot invite students to an archived session.",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 6. Process each email
  // -----------------------------------------------------------------------

  const results: InviteResultItem[] = [];

  for (const rawEmail of body.emails) {
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    // Validate email format
    if (!email || !EMAIL_REGEX.test(email)) {
      results.push({ email: email || "(empty)", success: false, error: "Invalid email format." });
      continue;
    }

    try {
      // Check if user already exists by looking up profiles
      const { data: existingProfile } = await serviceClient
        .from("profiles")
        .select("id, tenant_id")
        .eq("email", email)
        .maybeSingle();

      let userId: string;

      if (existingProfile) {
        // User exists — verify they belong to the caller's tenant.
        // A null tenant_id means the user is unassigned (e.g. signed up
        // via magic link before being invited) — allow the invite to
        // claim them.
        if (existingProfile.tenant_id && existingProfile.tenant_id !== tenantId) {
          results.push({
            email,
            success: false,
            error: "This email belongs to a different organisation.",
          });
          continue;
        }

        // Same tenant or unassigned — update with session + tenant
        userId = existingProfile.id as string;

        await serviceClient
          .from("profiles")
          .update({
            role: "student",
            tenant_id: tenantId,
            session_id: body.session_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } else {
        // Create new user via auth admin
        const { data: newUser, error: createError } =
          await serviceClient.auth.admin.createUser({
            email,
            email_confirm: true,
          });

        if (createError || !newUser?.user) {
          console.error(
            `[invite] Failed to create user for ${email}:`,
            createError?.message ?? "Unknown error",
          );
          results.push({
            email,
            success: false,
            error: "Failed to create account.",
          });
          continue;
        }

        userId = newUser.user.id;

        // Upsert profile — the handle_new_user trigger may have already
        // created a bare profile row, so update it with student details.
        const { error: profileUpsertError } = await serviceClient
          .from("profiles")
          .upsert(
            {
              id: userId,
              email,
              role: "student",
              tenant_id: tenantId,
              session_id: body.session_id,
            },
            { onConflict: "id" },
          );

        if (profileUpsertError) {
          console.error(
            `[invite] Failed to create profile for ${email}:`,
            profileUpsertError.message,
          );
          results.push({
            email,
            success: false,
            error: "Failed to create student profile.",
          });
          continue;
        }
      }

      // Generate magic link (for the copy-link fallback in the UI)
      const { data: linkData, error: linkError } =
        await serviceClient.auth.admin.generateLink({
          type: "magiclink",
          email,
        });

      if (linkError || !linkData?.properties?.action_link) {
        console.error(
          `[invite] Failed to generate link for ${email}:`,
          linkError?.message ?? "No action_link returned",
        );
        results.push({
          email,
          success: false,
          error: "Failed to generate magic link.",
        });
        continue;
      }

      // Send the magic link email via Supabase Auth OTP endpoint.
      // This uses the configured SMTP (Brevo) to deliver the email.
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
          `[invite] Failed to send magic link email for ${email}:`,
          otpBody,
        );
        // Still succeed — instructor can copy the link manually
      }

      results.push({
        email,
        success: true,
        magic_link: linkData.properties.action_link,
      });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      console.error(`[invite] Unexpected error for ${email}:`, detail);
      results.push({
        email,
        success: false,
        error: "An unexpected error occurred.",
      });
    }
  }

  // -----------------------------------------------------------------------
  // 7. Return results
  // -----------------------------------------------------------------------

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
