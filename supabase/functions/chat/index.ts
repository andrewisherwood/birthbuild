import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  system: string;
  tools?: Array<Record<string, unknown>>;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-user, 30 req/min)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_MESSAGE_LENGTH = 4_000;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://birthbuild.com",
  "https://www.birthbuild.com",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    return new Response(JSON.stringify({ error: "Missing authorisation header." }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client scoped to the caller's JWT (respects RLS)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired token." }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // -----------------------------------------------------------------------
  // 2. Rate limiting
  // -----------------------------------------------------------------------

  if (isRateLimited(user.id)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
      {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 3. Look up tenant_id from the user's profile
  // -----------------------------------------------------------------------

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return new Response(
      JSON.stringify({ error: "User profile or tenant not found." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 4. Fetch the Claude API key from tenant_secrets (service role bypasses RLS)
  // -----------------------------------------------------------------------

  const { data: secret, error: secretError } = await serviceClient
    .from("tenant_secrets")
    .select("claude_api_key")
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (secretError || !secret?.claude_api_key) {
    return new Response(
      JSON.stringify({ error: "Your instructor has not configured an API key." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 5. Parse & validate request body
  // -----------------------------------------------------------------------

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!body.messages || !Array.isArray(body.messages) || !body.system) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: messages, system." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Enforce max message length on the latest user message
  const lastMessage = body.messages[body.messages.length - 1];
  if (
    lastMessage &&
    lastMessage.role === "user" &&
    typeof lastMessage.content === "string" &&
    lastMessage.content.length > MAX_MESSAGE_LENGTH
  ) {
    return new Response(
      JSON.stringify({
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 6. Call the Claude API
  // -----------------------------------------------------------------------

  const claudeBody: Record<string, unknown> = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: body.system,
    messages: body.messages,
  };

  if (body.tools && body.tools.length > 0) {
    claudeBody.tools = body.tools;
  }

  let claudeResponse: Response;
  try {
    claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": secret.claude_api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(claudeBody),
    });
  } catch (fetchError: unknown) {
    const message =
      fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
    return new Response(
      JSON.stringify({ error: `Failed to reach Claude API: ${message}` }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    return new Response(
      JSON.stringify({
        error: "Claude API returned an error.",
        status: claudeResponse.status,
        detail: errorText,
      }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 7. Return the Claude response
  // -----------------------------------------------------------------------

  const claudeData: unknown = await claudeResponse.json();

  return new Response(JSON.stringify(claudeData), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
