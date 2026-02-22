/**
 * Publish / Unpublish Edge Function.
 *
 * Publish: Adds a custom domain to the Netlify site (status: preview → live).
 * Unpublish: Removes the custom domain (status: live → preview).
 *
 * Auth: JWT via Authorization header.
 * Rate limit: 10 per hour per user.
 * Env: NETLIFY_API_TOKEN required.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishRequestBody {
  site_spec_id: string;
  action: "publish" | "unpublish";
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 3_600_000;
const RATE_LIMIT_SCOPE = "publish";
const MAX_REQUEST_BODY_BYTES = 64 * 1024; // 64KB
const RESERVED_SLUGS = [
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "ftp",
  "cdn",
  "assets",
  "static",
  "birthbuild",
];
const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

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
      console.error("[publish] Rate-limit RPC error:", error.message);
      return true;
    }
    return data === false;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[publish] Rate-limit unexpected error:", detail);
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

function normaliseSubdomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 63);
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
  // 1. Authenticate
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
  const netlifyApiToken = Deno.env.get("NETLIFY_API_TOKEN");
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  if (!netlifyApiToken) {
    console.error("[publish] NETLIFY_API_TOKEN not configured");
    return new Response(
      JSON.stringify({ error: "Deployment service is not configured." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

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
  // 2. Rate limiting
  // -----------------------------------------------------------------------

  if (await isRateLimited(serviceClient, user.id)) {
    return new Response(
      JSON.stringify({
        error:
          "You have reached the publish limit. Please wait before trying again.",
      }),
      {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 3. Parse & validate request
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

  let body: PublishRequestBody;
  try {
    body = (await req.json()) as PublishRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (
    !body.site_spec_id ||
    typeof body.site_spec_id !== "string" ||
    !body.action ||
    !["publish", "unpublish"].includes(body.action)
  ) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: site_spec_id, action (publish|unpublish).",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(body.site_spec_id)) {
    return new Response(
      JSON.stringify({ error: "Invalid site specification ID." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 4. Fetch site spec, verify ownership
  // -----------------------------------------------------------------------

  const { data: siteSpec, error: specError } = await serviceClient
    .from("site_specs")
    .select("*")
    .eq("id", body.site_spec_id)
    .single();

  if (specError || !siteSpec) {
    return new Response(
      JSON.stringify({ error: "Site specification not found." }),
      {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (siteSpec.user_id !== user.id) {
    return new Response(
      JSON.stringify({
        error: "You do not have permission to modify this site.",
      }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  let netlifySiteId = siteSpec.netlify_site_id as string | null;
  const subdomainSlug = normaliseSubdomain(String(siteSpec.subdomain_slug ?? ""));

  if (!subdomainSlug || !SUBDOMAIN_REGEX.test(subdomainSlug)) {
    return new Response(
      JSON.stringify({
        error: "Invalid subdomain. Please set a valid subdomain and rebuild.",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }
  if (RESERVED_SLUGS.includes(subdomainSlug)) {
    return new Response(
      JSON.stringify({
        error: "This subdomain is reserved. Please choose another and rebuild.",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const netlifyHeaders = {
    Authorization: `Bearer ${netlifyApiToken}`,
    "Content-Type": "application/json",
  };

  // If netlify_site_id is missing (e.g. the build's DB update failed), look
  // it up by the well-known site name and persist it for future calls.
  if (!netlifySiteId) {
    const siteName = `birthbuild-${subdomainSlug}`;
    const lookupRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteName}.netlify.app`,
      { headers: { Authorization: `Bearer ${netlifyApiToken}` } },
    );

    if (!lookupRes.ok) {
      return new Response(
        JSON.stringify({
          error: "This site has not been built yet. Please build first.",
        }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const existingSite = (await lookupRes.json()) as { id: string };
    netlifySiteId = existingSite.id;
    console.log(`[publish] Recovered netlify_site_id: ${netlifySiteId}`);

    // Persist the recovered ID so future calls don't need the lookup.
    await serviceClient
      .from("site_specs")
      .update({ netlify_site_id: netlifySiteId })
      .eq("id", siteSpec.id);
  }

  // -----------------------------------------------------------------------
  // 5. Publish or Unpublish
  // -----------------------------------------------------------------------

  if (body.action === "publish") {
    if (siteSpec.status !== "preview") {
      return new Response(
        JSON.stringify({
          error: "Site must be in preview status to publish.",
        }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // Add custom domain to Netlify site
    try {
      const response = await fetch(
        `https://api.netlify.com/api/v1/sites/${netlifySiteId}`,
        {
          method: "PUT",
          headers: netlifyHeaders,
          body: JSON.stringify({
            custom_domain: `${subdomainSlug}.birthbuild.com`,
            force_ssl: true,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[publish] Netlify add domain failed (HTTP ${response.status}):`,
          errorText,
        );
        return new Response(
          JSON.stringify({ error: "Failed to publish site. Please try again." }),
          {
            status: 502,
            headers: { ...cors, "Content-Type": "application/json" },
          },
        );
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      console.error("[publish] Netlify error:", detail);
      return new Response(
        JSON.stringify({ error: "Failed to publish site. Please try again." }),
        {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const deployUrl = `https://${subdomainSlug}.birthbuild.com`;

    const { error: updateError } = await serviceClient
      .from("site_specs")
      .update({
        status: "live",
        deploy_url: deployUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.site_spec_id);

    if (updateError) {
      console.error("[publish] DB update failed:", updateError.message);
      return new Response(
        JSON.stringify({
          error:
            "Site was published on Netlify but the database update failed. Please try again or contact support.",
        }),
        {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, deploy_url: deployUrl }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Unpublish
  if (siteSpec.status !== "live") {
    return new Response(
      JSON.stringify({
        error: "Site must be live to unpublish.",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Remove custom domain from Netlify site
  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${netlifySiteId}`,
      {
        method: "PUT",
        headers: netlifyHeaders,
        body: JSON.stringify({
          custom_domain: null,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[publish] Netlify remove domain failed (HTTP ${response.status}):`,
        errorText,
      );
      return new Response(
        JSON.stringify({
          error: "Failed to unpublish site. Please try again.",
        }),
        {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[publish] Netlify error:", detail);
    return new Response(
      JSON.stringify({
        error: "Failed to unpublish site. Please try again.",
      }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const { error: updateError } = await serviceClient
    .from("site_specs")
    .update({
      status: "preview",
      deploy_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.site_spec_id);

  if (updateError) {
    console.error("[publish] DB update failed:", updateError.message);
    return new Response(
      JSON.stringify({
        error:
          "Site was unpublished on Netlify but the database update failed. Please try again or contact support.",
      }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
