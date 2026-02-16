import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesignChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  current_design: Record<string, unknown>;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-user, 60 req/min — more iterative than onboarding)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_MESSAGES_PAYLOAD_BYTES = 50 * 1024; // 50KB

// ---------------------------------------------------------------------------
// SEC-009: System prompt hardcoded in Edge Function (not accepted from client)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a visual design assistant for BirthBuild — a platform that helps birth workers create professional websites.

## Your role
Interpret natural language design requests and apply changes to the site's visual design system. You have access to a constrained set of design tokens: colours, typography, spacing, and border radius.

## Design system constraints

### Colours (hex format, 6-digit)
You can set five colour roles:
- **primary** — headings, links, wordmark, footer background
- **background** — page background
- **accent** — borders, decorative elements
- **text** — body text colour
- **cta** — call-to-action button colour

### Typography
**Heading fonts** (use exact names): Playfair Display, Lora, Montserrat, Raleway, DM Serif Display, Inter, Source Sans 3
**Body fonts** (use exact names): Inter, Open Sans, Lato, Source Sans 3, Lora
**Scale**: small, default, large

### Spacing density
Options: compact, default, relaxed, spacious

### Border radius
Options: sharp, slightly-rounded, rounded, circular

## Rules
- Always use the apply_design_changes tool to make changes — never just describe them.
- Before applying colour changes, check WCAG AA contrast (4.5:1 ratio) between text and background. Warn the user if contrast is insufficient but still apply if they insist.
- Only suggest fonts from the curated lists above.
- Keep responses concise: 1–2 sentences explaining what you changed and why.
- If the user asks for something outside your scope (layout changes, content edits, adding sections), explain gracefully that the design editor handles visual presentation only, and suggest they use the other dashboard tabs for content changes.
- Handle "undo" requests by calling undo_last_change (the client manages the undo stack).
- Handle "reset" or "start over" requests by calling revert_to_deployed.
- When the user gives a vague request like "make it warmer" or "more professional", interpret it thoughtfully — warm = earth tones / serif fonts / relaxed spacing; professional = clean sans-serif / sharp borders / muted palette.
- Use British English in all responses (colour, organisation, etc).`;

// ---------------------------------------------------------------------------
// SEC-010: Tool definitions hardcoded in Edge Function (not accepted from client)
// ---------------------------------------------------------------------------

const DESIGN_TOOLS: Array<Record<string, unknown>> = [
  {
    name: "apply_design_changes",
    description:
      "Apply partial design changes to the site configuration. Only include the fields you want to change — unchanged fields should be omitted.",
    input_schema: {
      type: "object",
      properties: {
        colours: {
          type: "object",
          description: "Colour overrides (hex format, e.g. #5f7161)",
          properties: {
            primary: { type: "string", description: "Headings, links, footer bg" },
            background: { type: "string", description: "Page background" },
            accent: { type: "string", description: "Borders, decorative elements" },
            text: { type: "string", description: "Body text" },
            cta: { type: "string", description: "Call-to-action buttons" },
          },
        },
        typography: {
          type: "object",
          description: "Typography overrides",
          properties: {
            headingFont: {
              type: "string",
              enum: [
                "Playfair Display",
                "Lora",
                "Montserrat",
                "Raleway",
                "DM Serif Display",
                "Inter",
                "Source Sans 3",
              ],
              description: "Heading font family",
            },
            bodyFont: {
              type: "string",
              enum: ["Inter", "Open Sans", "Lato", "Source Sans 3", "Lora"],
              description: "Body font family",
            },
            scale: {
              type: "string",
              enum: ["small", "default", "large"],
              description: "Typography scale",
            },
          },
        },
        spacing: {
          type: "object",
          description: "Spacing overrides",
          properties: {
            density: {
              type: "string",
              enum: ["compact", "default", "relaxed", "spacious"],
              description: "Overall spacing density",
            },
          },
        },
        borderRadius: {
          type: "string",
          enum: ["sharp", "slightly-rounded", "rounded", "circular"],
          description: "Border radius style",
        },
      },
    },
  },
  {
    name: "undo_last_change",
    description:
      "Undo the last design change. The client maintains the undo stack.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "revert_to_deployed",
    description:
      "Revert all unsaved changes back to the last saved/deployed design state.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

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
  // 4. Fetch the Claude API key from tenant_secrets
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

  let body: DesignChatRequestBody;
  try {
    body = (await req.json()) as DesignChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: "Missing required field: messages." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // Validate message lengths
  for (const msg of body.messages) {
    if (
      typeof msg.content === "string" &&
      msg.content.length > MAX_MESSAGE_LENGTH
    ) {
      return new Response(
        JSON.stringify({
          error: `A message exceeds the maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
        }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }
  }

  // Validate total payload size
  const messagesPayloadSize = new TextEncoder().encode(
    JSON.stringify(body.messages),
  ).length;

  if (messagesPayloadSize > MAX_MESSAGES_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({
        error: "The conversation is too long. Please start a new design session.",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 6. Build system prompt with current design state
  // -----------------------------------------------------------------------

  const designContext = body.current_design
    ? `\n\n## Current design state\n\`\`\`json\n${JSON.stringify(body.current_design, null, 2)}\n\`\`\``
    : "";

  const fullSystemPrompt = SYSTEM_PROMPT + designContext;

  // -----------------------------------------------------------------------
  // 7. Call the Claude API (with tool-use loop, max 3 iterations)
  // -----------------------------------------------------------------------

  const conversationMessages: Array<Record<string, unknown>> = [
    ...body.messages,
  ];

  const claudeHeaders = {
    "Content-Type": "application/json",
    "x-api-key": secret.claude_api_key,
    "anthropic-version": "2023-06-01",
  };

  const allContentBlocks: Array<Record<string, unknown>> = [];
  const MAX_TOOL_ITERATIONS = 3;
  let iterations = 0;
  // deno-lint-ignore no-explicit-any
  let lastClaudeData: any = null;

  while (iterations <= MAX_TOOL_ITERATIONS) {
    let claudeResponse: Response;
    try {
      claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: claudeHeaders,
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          system: fullSystemPrompt,
          messages: conversationMessages,
          tools: DESIGN_TOOLS,
        }),
      });
    } catch (fetchError: unknown) {
      const errorDetail =
        fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
      console.error("[design-chat] Failed to reach Claude API:", errorDetail);
      return new Response(
        JSON.stringify({ error: "The AI service is currently unavailable. Please try again." }),
        {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(
        `[design-chat] Claude API error (HTTP ${claudeResponse.status}):`,
        errorText,
      );
      return new Response(
        JSON.stringify({
          error: "The AI service is currently unavailable. Please try again.",
        }),
        {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    lastClaudeData = await claudeResponse.json();
    const contentBlocks = lastClaudeData.content as Array<Record<string, unknown>>;
    allContentBlocks.push(...contentBlocks);

    // If Claude didn't use tools, we're done
    if (lastClaudeData.stop_reason !== "tool_use") {
      break;
    }

    // Build tool_result messages for each tool_use block
    const toolUseBlocks = contentBlocks.filter(
      (b: Record<string, unknown>) => b.type === "tool_use",
    );
    const toolResults = toolUseBlocks.map(
      (b: Record<string, unknown>) => ({
        type: "tool_result" as const,
        tool_use_id: b.id,
        content: "Applied successfully.",
      }),
    );

    // Append assistant response + tool results to conversation for next iteration
    conversationMessages.push({
      role: "assistant",
      content: contentBlocks,
    });
    conversationMessages.push({
      role: "user",
      content: toolResults,
    });

    iterations++;
  }

  // -----------------------------------------------------------------------
  // 8. Return the merged Claude response
  // -----------------------------------------------------------------------

  lastClaudeData.content = allContentBlocks;

  return new Response(JSON.stringify(lastClaudeData), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
