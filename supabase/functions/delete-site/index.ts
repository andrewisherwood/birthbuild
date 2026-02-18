/**
 * Delete Site Edge Function.
 *
 * 1. Authenticates via JWT, verifies ownership
 * 2. If netlify_site_id exists, deletes the Netlify site
 * 3. Deletes photos from Supabase Storage
 * 4. Deletes the site_specs row (photos rows cascade)
 *
 * Auth: JWT via Authorization header.
 * Env: NETLIFY_API_TOKEN required for Netlify cleanup.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeleteSiteRequestBody {
  site_spec_id: string;
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
  // 2. Parse & validate request
  // -----------------------------------------------------------------------

  let body: DeleteSiteRequestBody;
  try {
    body = (await req.json()) as DeleteSiteRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!body.site_spec_id || typeof body.site_spec_id !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing required field: site_spec_id." }),
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
  // 3. Fetch site spec, verify ownership
  // -----------------------------------------------------------------------

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

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
        error: "You do not have permission to delete this site.",
      }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 4. Delete Netlify site (best-effort)
  // -----------------------------------------------------------------------

  const netlifySiteId = siteSpec.netlify_site_id as string | null;
  if (netlifySiteId && netlifyApiToken) {
    try {
      const response = await fetch(
        `https://api.netlify.com/api/v1/sites/${netlifySiteId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${netlifyApiToken}`,
          },
        },
      );
      if (!response.ok) {
        console.error(
          `[delete-site] Netlify delete failed (HTTP ${response.status})`,
        );
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      console.error("[delete-site] Netlify delete error:", detail);
    }
  }

  // -----------------------------------------------------------------------
  // 5. Delete photos from storage (best-effort)
  // -----------------------------------------------------------------------

  const { data: photoRows } = await serviceClient
    .from("photos")
    .select("storage_path")
    .eq("site_spec_id", body.site_spec_id);

  if (photoRows && photoRows.length > 0) {
    const paths = photoRows.map(
      (row: Record<string, unknown>) => row.storage_path as string,
    );
    await serviceClient.storage.from("photos").remove(paths);
  }

  // -----------------------------------------------------------------------
  // 6. Delete the site_specs row (photos cascade via FK)
  // -----------------------------------------------------------------------

  const { error: deleteError } = await serviceClient
    .from("site_specs")
    .delete()
    .eq("id", body.site_spec_id);

  if (deleteError) {
    console.error("[delete-site] DB delete failed:", deleteError.message);
    return new Response(
      JSON.stringify({ error: "Failed to delete site. Please try again." }),
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
