import {
  corsHeaders,
  jsonResponse,
  createServiceClient,
  isRateLimited,
} from "../_shared/edge-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, cors);
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorisation header." }, 401, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Invalid or expired token." }, 401, cors);
  }

  // Rate limit: 5 reports per hour per user
  const limited = await isRateLimited("report-bug", user.id, 5, 3600_000);
  if (limited) {
    return jsonResponse(
      { error: "Too many reports. Please wait before submitting another." },
      429,
      cors,
    );
  }

  // Parse body
  let body: { title?: string; description?: string; url?: string; browser?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, cors);
  }

  const title = String(body.title ?? "").trim().slice(0, 200);
  const description = String(body.description ?? "").trim().slice(0, 2000);
  const url = String(body.url ?? "").slice(0, 500);
  const browser = String(body.browser ?? "").slice(0, 200);

  if (!title) {
    return jsonResponse({ error: "Title is required." }, 400, cors);
  }

  // Build GitHub Issue body
  const issueBody = [
    `**Reporter:** ${user.email ?? "unknown"}`,
    `**URL:** ${url || "not provided"}`,
    `**Browser:** ${browser || "not provided"}`,
    "",
    "---",
    "",
    description || "No description provided.",
  ].join("\n");

  // Create GitHub Issue
  const ghToken = Deno.env.get("GITHUB_PAT");
  const serviceClient = createServiceClient();

  if (!ghToken) {
    // Log the report to app_events as fallback
    await serviceClient.from("app_events").insert({
      user_id: user.id,
      event: "bug_report_submitted",
      metadata: { title, description, url, browser, github_fallback: true },
    });
    return jsonResponse({ success: true, fallback: true }, 200, cors);
  }

  const ghRepo = Deno.env.get("GITHUB_REPO") ?? "andrewisherwood/birthbuild-issues";
  const labels = title.startsWith("[SECURITY]")
    ? ["bug", "user-reported", "security-alert"]
    : ["bug", "user-reported"];

  const ghResponse = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body: issueBody, labels }),
  });

  if (!ghResponse.ok) {
    const ghErr = await ghResponse.text();
    console.error("[report-bug] GitHub API error:", ghErr);
    // Fallback: log to app_events
    await serviceClient.from("app_events").insert({
      user_id: user.id,
      event: "bug_report_submitted",
      metadata: { title, description, url, browser, github_error: true },
    });
    return jsonResponse({ success: true, fallback: true }, 200, cors);
  }

  const ghData = await ghResponse.json();

  // Also log to app_events for analytics
  await serviceClient.from("app_events").insert({
    user_id: user.id,
    event: "bug_report_submitted",
    metadata: { title, github_issue_number: ghData.number },
  });

  return jsonResponse({ success: true, issue_number: ghData.number }, 200, cors);
});
