/**
 * Build & Deploy Edge Function.
 *
 * Receives generated site files from the client, creates a zip,
 * and deploys to Netlify via their Deploy API.
 *
 * Auth: JWT via Authorization header (same pattern as chat/index.ts).
 * Rate limit: 5 builds/hour per user.
 * Env: NETLIFY_API_TOKEN required.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sanitiseHtml, sanitiseCss } from "../_shared/sanitise-html.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuildRequestBody {
  site_spec_id: string;
  files: Array<{ path: string; content: string }>;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour
const RATE_LIMIT_SCOPE = "build";
const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 50;
const MAX_FILE_CONTENT_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024; // 6MB
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
      console.error("[build] Rate-limit RPC error:", error.message);
      // Fail closed for expensive endpoints.
      return true;
    }
    return data === false;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[build] Rate-limit unexpected error:", detail);
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

function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SLUGS.includes(subdomain);
}

function sanitiseDeployFiles(
  files: Array<{ path: string; content: string }>,
): {
  files: Array<{ path: string; content: string }>;
  stripped: Array<{ path: string; details: string[] }>;
} {
  const stripped: Array<{ path: string; details: string[] }> = [];
  const sanitisedFiles = files.map((file) => {
    if (file.path.endsWith(".html")) {
      const result = sanitiseHtml(file.content);
      if (result.stripped.length > 0) {
        stripped.push({ path: file.path, details: result.stripped });
      }
      return { ...file, content: result.html };
    }
    if (file.path.endsWith(".css")) {
      const result = sanitiseCss(file.content);
      if (result.stripped.length > 0) {
        stripped.push({ path: file.path, details: result.stripped });
      }
      return { ...file, content: result.css };
    }
    return file;
  });
  return { files: sanitisedFiles, stripped };
}

async function isSubdomainTaken(
  serviceClient: ReturnType<typeof createClient>,
  subdomain: string,
  siteSpecId: string,
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("site_specs")
    .select("id")
    .ilike("subdomain_slug", subdomain)
    .neq("id", siteSpecId)
    .limit(1);
  if (error) {
    throw new Error(`Failed to check subdomain uniqueness: ${error.message}`);
  }
  return Boolean(data && data.length > 0);
}

async function chooseAutoSubdomain(
  serviceClient: ReturnType<typeof createClient>,
  baseName: string | null,
  siteSpecId: string,
): Promise<string> {
  const base = slugify(baseName ?? "") || `site-${generateRandomSuffix()}`;

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${generateRandomSuffix()}`;
    if (!SUBDOMAIN_REGEX.test(candidate)) continue;
    if (isReservedSubdomain(candidate)) continue;
    if (!(await isSubdomainTaken(serviceClient, candidate, siteSpecId))) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique subdomain");
}

async function resolveSubdomain(
  serviceClient: ReturnType<typeof createClient>,
  siteSpec: Record<string, unknown>,
  siteSpecId: string,
): Promise<{ slug: string; error: string | null; status: number }> {
  const rawExisting = typeof siteSpec.subdomain_slug === "string"
    ? siteSpec.subdomain_slug
    : "";
  const existingNormalised = slugify(rawExisting);

  // User-provided slug: enforce strict validation and do not auto-mutate.
  if (rawExisting.trim().length > 0) {
    if (!existingNormalised || !SUBDOMAIN_REGEX.test(existingNormalised)) {
      return { slug: "", error: "Invalid subdomain format. Use letters, numbers, and hyphens only.", status: 400 };
    }
    if (isReservedSubdomain(existingNormalised)) {
      return { slug: "", error: "This subdomain is reserved. Please choose another.", status: 400 };
    }
    try {
      if (await isSubdomainTaken(serviceClient, existingNormalised, siteSpecId)) {
        return { slug: "", error: "This subdomain is already taken. Please choose another.", status: 409 };
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      console.error("[build] Subdomain lookup error:", detail);
      return { slug: "", error: "Unable to validate subdomain. Please try again.", status: 500 };
    }
    return { slug: existingNormalised, error: null, status: 200 };
  }

  try {
    const slug = await chooseAutoSubdomain(
      serviceClient,
      (siteSpec.doula_name as string | null) ?? null,
      siteSpecId,
    );
    return { slug, error: null, status: 200 };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[build] Failed to allocate subdomain:", detail);
    return { slug: "", error: "Unable to allocate a subdomain. Please try again.", status: 500 };
  }
}

// ---------------------------------------------------------------------------
// CORS (same origins as chat)
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
// Subdomain slug generation
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 63);
}

function generateRandomSuffix(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Simple ZIP creation
//
// Creates a minimal valid ZIP file from an array of { path, content } entries.
// Uses the Store method (no compression) which Netlify accepts fine.
// ---------------------------------------------------------------------------

function createZipBuffer(
  files: Array<{ path: string; content: string }>,
): Uint8Array {
  const encoder = new TextEncoder();

  // Pre-calculate sizes
  interface LocalEntry {
    path: Uint8Array;
    data: Uint8Array;
    crc32: number;
    offset: number;
  }

  const entries: LocalEntry[] = [];
  let offset = 0;

  // Build local file entries
  for (const file of files) {
    const pathBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    entries.push({
      path: pathBytes,
      data: dataBytes,
      crc32: crc,
      offset,
    });

    // Local file header (30 bytes) + path + data
    offset += 30 + pathBytes.length + dataBytes.length;
  }

  // Calculate central directory size
  let centralDirSize = 0;
  for (const entry of entries) {
    centralDirSize += 46 + entry.path.length;
  }

  const totalSize = offset + centralDirSize + 22;

  if (totalSize > MAX_ZIP_SIZE_BYTES) {
    throw new Error("Generated site exceeds maximum size limit.");
  }

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);
  let pos = 0;

  // Write local file headers + data
  for (const entry of entries) {
    // Local file header signature
    view.setUint32(pos, 0x04034b50, true);
    pos += 4;
    // Version needed (20 = 2.0)
    view.setUint16(pos, 20, true);
    pos += 2;
    // General purpose bit flag
    view.setUint16(pos, 0, true);
    pos += 2;
    // Compression method (0 = stored)
    view.setUint16(pos, 0, true);
    pos += 2;
    // Mod time
    view.setUint16(pos, 0, true);
    pos += 2;
    // Mod date
    view.setUint16(pos, 0, true);
    pos += 2;
    // CRC-32
    view.setUint32(pos, entry.crc32, true);
    pos += 4;
    // Compressed size
    view.setUint32(pos, entry.data.length, true);
    pos += 4;
    // Uncompressed size
    view.setUint32(pos, entry.data.length, true);
    pos += 4;
    // Filename length
    view.setUint16(pos, entry.path.length, true);
    pos += 2;
    // Extra field length
    view.setUint16(pos, 0, true);
    pos += 2;
    // Filename
    buffer.set(entry.path, pos);
    pos += entry.path.length;
    // File data
    buffer.set(entry.data, pos);
    pos += entry.data.length;
  }

  // Central directory offset
  const centralDirOffset = pos;

  // Write central directory
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    // Central directory header signature
    view.setUint32(pos, 0x02014b50, true);
    pos += 4;
    // Version made by
    view.setUint16(pos, 20, true);
    pos += 2;
    // Version needed
    view.setUint16(pos, 20, true);
    pos += 2;
    // General purpose bit flag
    view.setUint16(pos, 0, true);
    pos += 2;
    // Compression method (0 = stored)
    view.setUint16(pos, 0, true);
    pos += 2;
    // Mod time
    view.setUint16(pos, 0, true);
    pos += 2;
    // Mod date
    view.setUint16(pos, 0, true);
    pos += 2;
    // CRC-32
    view.setUint32(pos, entry.crc32, true);
    pos += 4;
    // Compressed size
    view.setUint32(pos, entry.data.length, true);
    pos += 4;
    // Uncompressed size
    view.setUint32(pos, entry.data.length, true);
    pos += 4;
    // Filename length
    view.setUint16(pos, entry.path.length, true);
    pos += 2;
    // Extra field length
    view.setUint16(pos, 0, true);
    pos += 2;
    // Comment length
    view.setUint16(pos, 0, true);
    pos += 2;
    // Disk number start
    view.setUint16(pos, 0, true);
    pos += 2;
    // Internal file attributes
    view.setUint16(pos, 0, true);
    pos += 2;
    // External file attributes
    view.setUint32(pos, 0, true);
    pos += 4;
    // Relative offset of local header
    view.setUint32(pos, entry.offset, true);
    pos += 4;
    // Filename
    buffer.set(entry.path, pos);
    pos += entry.path.length;
  }

  // End of central directory record
  view.setUint32(pos, 0x06054b50, true);
  pos += 4;
  // Disk number
  view.setUint16(pos, 0, true);
  pos += 2;
  // Disk with central directory
  view.setUint16(pos, 0, true);
  pos += 2;
  // Number of entries on this disk
  view.setUint16(pos, entries.length, true);
  pos += 2;
  // Total number of entries
  view.setUint16(pos, entries.length, true);
  pos += 2;
  // Size of central directory
  view.setUint32(pos, centralDirSize, true);
  pos += 4;
  // Offset of central directory
  view.setUint32(pos, centralDirOffset, true);
  pos += 4;
  // Comment length
  view.setUint16(pos, 0, true);

  return buffer;
}

// ---------------------------------------------------------------------------
// CRC-32 implementation
// ---------------------------------------------------------------------------

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC32_TABLE[(crc ^ data[i]!) & 0xff]!) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
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
  const netlifyApiToken = Deno.env.get("NETLIFY_API_TOKEN");
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  if (!netlifyApiToken) {
    console.error("[build] NETLIFY_API_TOKEN not configured");
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
          "You have reached the build limit. Please wait before trying again.",
      }),
      {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

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

  let body: BuildRequestBody;
  try {
    body = (await req.json()) as BuildRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (
    !body.site_spec_id ||
    typeof body.site_spec_id !== "string" ||
    !body.files ||
    !Array.isArray(body.files)
  ) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: site_spec_id, files.",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // SEC-019: Validate site_spec_id is a valid UUID format
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(body.site_spec_id)) {
    return new Response(
      JSON.stringify({ error: "Invalid site specification ID." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (body.files.length === 0) {
    return new Response(
      JSON.stringify({ error: "No files provided for deployment." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  if (body.files.length > MAX_FILES) {
    return new Response(
      JSON.stringify({ error: "Too many files provided." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // SEC-020: File path validation pattern
  const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-][a-zA-Z0-9_\-/]*\.(html|xml|txt|css|json|ico|svg|webmanifest)$/;
  const MAX_PATH_LENGTH = 100;

  // Validate individual files (paths + sizes)
  for (const file of body.files) {
    if (
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    ) {
      return new Response(
        JSON.stringify({ error: "Each file must have a path and content." }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    // SEC-020: Sanitise file paths to prevent directory traversal
    if (
      file.path.length > MAX_PATH_LENGTH ||
      file.path.includes("..") ||
      file.path.startsWith("/") ||
      !SAFE_PATH_REGEX.test(file.path)
    ) {
      return new Response(
        JSON.stringify({ error: `Invalid file path: "${file.path}".` }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    if (new TextEncoder().encode(file.content).length > MAX_FILE_CONTENT_BYTES) {
      return new Response(
        JSON.stringify({ error: `File "${file.path}" exceeds maximum size.` }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }
  }

  // -----------------------------------------------------------------------
  // 4. Fetch site_spec via service role, verify user_id matches
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
      JSON.stringify({ error: "You do not have permission to build this site." }),
      {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 5. Validate spec completeness
  // -----------------------------------------------------------------------

  const missingFields: string[] = [];
  if (!siteSpec.business_name) missingFields.push("business name");
  if (!siteSpec.doula_name) missingFields.push("your name");
  if (!siteSpec.service_area) missingFields.push("service area");
  if (
    !siteSpec.services ||
    !Array.isArray(siteSpec.services) ||
    siteSpec.services.length < 1
  ) {
    missingFields.push("at least one service");
  }
  if (!siteSpec.email) missingFields.push("email address");

  if (missingFields.length > 0) {
    return new Response(
      JSON.stringify({
        error: `Please complete the following before building: ${missingFields.join(", ")}.`,
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 6. Resolve and validate subdomain slug
  // -----------------------------------------------------------------------

  const subdomainResolution = await resolveSubdomain(serviceClient, siteSpec as Record<string, unknown>, body.site_spec_id);
  if (subdomainResolution.error) {
    return new Response(
      JSON.stringify({ error: subdomainResolution.error }),
      {
        status: subdomainResolution.status,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }
  const subdomainSlug = subdomainResolution.slug;

  // -----------------------------------------------------------------------
  // 7. Set status to "building"
  // -----------------------------------------------------------------------

  const { error: statusError } = await serviceClient
    .from("site_specs")
    .update({ status: "building", updated_at: new Date().toISOString() })
    .eq("id", body.site_spec_id);

  if (statusError) {
    console.error("[build] Failed to set building status:", statusError.message);
    return new Response(
      JSON.stringify({ error: "Failed to start build. Please try again." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 8. Sanitise files and create zip
  // -----------------------------------------------------------------------

  const { files: deployFiles, stripped: strippedContent } = sanitiseDeployFiles(body.files);
  if (strippedContent.length > 0) {
    await serviceClient.from("app_events").insert({
      user_id: user.id,
      site_spec_id: body.site_spec_id,
      event: "build_sanitiser_stripped_content",
      metadata: {
        file_count: strippedContent.length,
        files: strippedContent.map((item) => ({
          path: item.path,
          stripped_count: item.details.length,
        })),
      },
    });
  }

  let zipBuffer: Uint8Array;
  try {
    zipBuffer = createZipBuffer(deployFiles);
  } catch (zipError: unknown) {
    const detail =
      zipError instanceof Error ? zipError.message : "Unknown zip error";
    console.error("[build] Zip creation failed:", detail);

    await serviceClient
      .from("site_specs")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", body.site_spec_id);

    return new Response(
      JSON.stringify({ error: "Failed to package site files." }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 9. Create or get Netlify site
  // -----------------------------------------------------------------------

  // Save pre-build status so we can preserve "live" through rebuilds
  const preBuildStatus = siteSpec.status as string;

  let netlifySiteId = siteSpec.netlify_site_id as string | null;
  const netlifyHeaders = {
    Authorization: `Bearer ${netlifyApiToken}`,
    "Content-Type": "application/json",
  };

  try {
    if (!netlifySiteId) {
      const siteName = `birthbuild-${subdomainSlug}`;

      // Create a new Netlify site WITHOUT custom_domain (preview only)
      const createResponse = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: netlifyHeaders,
        body: JSON.stringify({ name: siteName }),
      });

      if (createResponse.ok) {
        const siteData = (await createResponse.json()) as { id: string };
        netlifySiteId = siteData.id;
      } else if (createResponse.status === 422) {
        // Name already taken — look up the existing site by subdomain
        console.warn(`[build] Site name "${siteName}" already exists, looking up…`);
        const lookupResponse = await fetch(
          `https://api.netlify.com/api/v1/sites/${siteName}.netlify.app`,
          { headers: { Authorization: `Bearer ${netlifyApiToken}` } },
        );

        if (!lookupResponse.ok) {
          const lookupText = await lookupResponse.text();
          console.error(
            `[build] Netlify site lookup failed (HTTP ${lookupResponse.status}):`,
            lookupText,
          );
          throw new Error("Failed to find existing Netlify site");
        }

        const existingSite = (await lookupResponse.json()) as { id: string };
        netlifySiteId = existingSite.id;
        console.log(`[build] Found existing Netlify site: ${netlifySiteId}`);
      } else {
        const errorText = await createResponse.text();
        console.error(
          `[build] Netlify create site failed (HTTP ${createResponse.status}):`,
          errorText,
        );
        throw new Error("Failed to create Netlify site");
      }
    }

    // -----------------------------------------------------------------------
    // 10. Deploy zip to Netlify
    // -----------------------------------------------------------------------

    const deployResponse = await fetch(
      `https://api.netlify.com/api/v1/sites/${netlifySiteId}/deploys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${netlifyApiToken}`,
          "Content-Type": "application/zip",
        },
        body: zipBuffer,
      },
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error(
        `[build] Netlify deploy failed (HTTP ${deployResponse.status}):`,
        errorText,
      );
      throw new Error("Failed to deploy to Netlify");
    }

    // We do not need the deploy response body for our purposes

  } catch (netlifyError: unknown) {
    const detail =
      netlifyError instanceof Error
        ? netlifyError.message
        : "Unknown Netlify error";
    console.error("[build] Netlify deployment error:", detail);

    await serviceClient
      .from("site_specs")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", body.site_spec_id);

    return new Response(
      JSON.stringify({
        error: "Deployment failed. Please try again.",
      }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 11. Update site_spec with preview URL and appropriate status
  // -----------------------------------------------------------------------

  const previewUrl = `https://birthbuild-${subdomainSlug}.netlify.app`;

  // If the site was already live, keep it live (rebuild scenario).
  // Otherwise, set to "preview" — user must explicitly publish to go live.
  const newStatus = preBuildStatus === "live" ? "live" : "preview";

  const updateFields: Record<string, unknown> = {
    status: newStatus,
    preview_url: previewUrl,
    netlify_site_id: netlifySiteId,
    subdomain_slug: subdomainSlug,
    updated_at: new Date().toISOString(),
  };

  // If the site was already live, preserve the existing custom domain URL.
  // Otherwise, explicitly clear deploy_url so any stale value is removed.
  if (preBuildStatus === "live" && siteSpec.deploy_url) {
    updateFields.deploy_url = siteSpec.deploy_url;
  } else {
    updateFields.deploy_url = null;
  }

  const { error: updateError } = await serviceClient
    .from("site_specs")
    .update(updateFields)
    .eq("id", body.site_spec_id);

  if (updateError) {
    console.error("[build] Failed to update site_spec after deploy:", updateError.message);
    return new Response(
      JSON.stringify({
        error: `Deploy succeeded but DB update failed: ${updateError.message}`,
        preview_url: previewUrl,
      }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 12. Return success
  // -----------------------------------------------------------------------

  return new Response(
    JSON.stringify({ success: true, preview_url: previewUrl }),
    {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    },
  );
});
