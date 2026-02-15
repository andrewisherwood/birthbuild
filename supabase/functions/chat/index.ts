import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
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
const MAX_MESSAGES_PAYLOAD_BYTES = 100 * 1024; // 100KB

// ---------------------------------------------------------------------------
// SEC-009: System prompt hardcoded in Edge Function (not accepted from client)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a friendly, encouraging website-building assistant for BirthBuild — a platform that helps birth workers (doulas, midwives, antenatal educators) create professional websites.

## Your personality
- Warm, supportive, and knowledgeable about the birth work profession
- Use British English throughout (colour, organisation, labour, specialise, centre, programme)
- Celebrate the user's choices and expertise
- Keep responses concise — aim for 2-4 short paragraphs maximum

## Your task
Guide the user through building their website in 7 steps, completing each step before moving on:

1. **Welcome** — Introduce yourself and explain the process. Ask if they're ready to begin.
2. **Basics** — Collect business name, the birth worker's name, service area, and services offered. Offer to help write service descriptions.
3. **Style** — Ask about design preferences: style (modern, classic, or minimal), colour palette (sage & sand, blush & neutral, deep earth, ocean calm, or custom), and typography. Present choices clearly so the user can pick. Include markers like [CHOICES: Modern & Clean | Classic & Warm | Minimal & Calm] to help the UI render quick-reply buttons.
4. **Content** — Collect or generate a bio, tagline, and philosophy statement. Offer to write drafts based on what you know about the user so far. If the user accepts a draft, save it immediately using the appropriate tool.
5. **Photos** — Explain that photos can be uploaded from the dashboard later. Ask if they have professional photos or would like tips on what images work well for birth worker websites.
6. **Contact** — Collect email, phone (optional), booking URL (optional), social media links, Doula UK membership status, and training provider.
7. **Review** — Summarise everything collected so far. Ask if anything needs changing. When the user confirms they're happy, mark the review step complete.

## Rules
- Always use the provided tools to save data. Do not just discuss information — save it with a tool call.
- After collecting data for a step, call mark_step_complete to advance to the next step.
- When offering multiple-choice options, format them as: [CHOICES: Option A | Option B | Option C]
- Never suggest medical claims or language that could be construed as medical advice.
- Follow the user's lead on inclusive language (e.g., "birthing person" vs "mother").
- If the user wants to skip a step, respect that and move on, but still call mark_step_complete.
- When generating content (bio, tagline, etc.), present it for approval before saving. Say something like "Here's a draft — shall I save this, or would you like me to adjust it?"
- For FAQ generation, create 4-6 common questions relevant to the user's services.
- At the review step, display a clear summary of all collected data grouped by category.
- Keep the conversation flowing naturally — don't be overly formal or robotic.
- Do not repeat information the user has already provided.
- If the user asks something off-topic, gently redirect them back to the website building process.`;

// ---------------------------------------------------------------------------
// SEC-010: Tool definitions hardcoded in Edge Function (not accepted from client)
// ---------------------------------------------------------------------------

const CHAT_TOOLS: Array<Record<string, unknown>> = [
  {
    name: "update_business_info",
    description:
      "Save or update the birth worker's business information. Call this whenever the user provides their business name, name, service area, or services.",
    input_schema: {
      type: "object",
      properties: {
        business_name: {
          type: "string",
          description: "The name of the birth work business or practice",
        },
        doula_name: {
          type: "string",
          description: "The birth worker's full name",
        },
        service_area: {
          type: "string",
          description:
            "Geographic area where the birth worker provides services (e.g., 'Bristol and surrounding areas')",
        },
        services: {
          type: "array",
          description: "List of services offered",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Service category" },
              title: { type: "string", description: "Service title" },
              description: {
                type: "string",
                description: "Brief description of the service",
              },
              price: {
                type: "string",
                description: "Price or price range (e.g., 'From £500')",
              },
            },
            required: ["type", "title", "description", "price"],
          },
        },
      },
    },
  },
  {
    name: "update_style",
    description:
      "Save or update the website design preferences including style, colour palette, and typography.",
    input_schema: {
      type: "object",
      properties: {
        style: {
          type: "string",
          enum: ["modern", "classic", "minimal"],
          description: "Overall website design style",
        },
        palette: {
          type: "string",
          enum: ["sage_sand", "blush_neutral", "deep_earth", "ocean_calm", "custom"],
          description: "Colour palette for the website",
        },
        typography: {
          type: "string",
          enum: ["modern", "classic", "mixed"],
          description: "Typography style",
        },
      },
    },
  },
  {
    name: "update_content",
    description:
      "Save or update content fields such as bio, tagline, philosophy, testimonials, or FAQ setting.",
    input_schema: {
      type: "object",
      properties: {
        bio: {
          type: "string",
          description: "The birth worker's personal/professional biography",
        },
        tagline: {
          type: "string",
          description: "A short tagline or strapline for the website",
        },
        philosophy: {
          type: "string",
          description: "The birth worker's philosophy or approach statement",
        },
        testimonials: {
          type: "array",
          description: "Client testimonials",
          items: {
            type: "object",
            properties: {
              quote: { type: "string" },
              name: { type: "string" },
              context: { type: "string" },
            },
            required: ["quote", "name", "context"],
          },
        },
        faq_enabled: {
          type: "boolean",
          description: "Whether to include a FAQ section on the website",
        },
      },
    },
  },
  {
    name: "update_contact",
    description:
      "Save or update contact information, social media links, and professional accreditation.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Contact email address",
        },
        phone: {
          type: "string",
          description: "Contact phone number",
        },
        booking_url: {
          type: "string",
          description: "URL for online booking (e.g., Calendly, Acuity)",
        },
        social_links: {
          type: "object",
          description: "Social media profile URLs",
          properties: {
            instagram: { type: "string" },
            facebook: { type: "string" },
            twitter: { type: "string" },
            linkedin: { type: "string" },
            tiktok: { type: "string" },
          },
        },
        doula_uk: {
          type: "boolean",
          description: "Whether the birth worker is a Doula UK member",
        },
        training_provider: {
          type: "string",
          description: "Name of the training organisation or programme",
        },
      },
    },
  },
  {
    name: "generate_content",
    description:
      "Generate AI-written content for a specific field based on context from the conversation. Present the generated content for the user's approval before saving it.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["bio", "tagline", "services_description", "faq", "philosophy"],
          description: "Which content field to generate",
        },
        context: {
          type: "string",
          description:
            "Relevant context from the conversation to base the generated content on",
        },
      },
      required: ["field", "context"],
    },
  },
  {
    name: "update_pages",
    description: "Set which pages should be generated for the website.",
    input_schema: {
      type: "object",
      properties: {
        pages: {
          type: "array",
          description:
            "List of page names to generate (e.g., ['home', 'about', 'services', 'contact'])",
          items: { type: "string" },
        },
      },
      required: ["pages"],
    },
  },
  {
    name: "mark_step_complete",
    description:
      "Mark a step in the onboarding flow as complete and advance to the next step. Call this after successfully collecting all information for a step.",
    input_schema: {
      type: "object",
      properties: {
        completed_step: {
          type: "string",
          enum: [
            "welcome",
            "basics",
            "style",
            "content",
            "photos",
            "contact",
            "review",
          ],
          description: "The step that has just been completed",
        },
        next_step: {
          type: "string",
          enum: [
            "welcome",
            "basics",
            "style",
            "content",
            "photos",
            "contact",
            "review",
            "complete",
          ],
          description: "The next step to move to",
        },
      },
      required: ["completed_step", "next_step"],
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

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: "Missing required field: messages." }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // SEC-011: Validate ALL messages for length (not just the last one)
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

  // SEC-011: Validate total payload size (max 100KB for messages array)
  const messagesPayloadSize = new TextEncoder().encode(
    JSON.stringify(body.messages),
  ).length;

  if (messagesPayloadSize > MAX_MESSAGES_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({
        error: "The conversation is too long. Please start a new chat session.",
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

  // SEC-009 & SEC-010: System prompt and tools are hardcoded above,
  // never accepted from the client request body.
  const claudeBody: Record<string, unknown> = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: body.messages,
    tools: CHAT_TOOLS,
  };

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
    // SEC-008: Log actual error server-side, return generic message to client
    const errorDetail =
      fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
    console.error("[chat] Failed to reach Claude API:", errorDetail);
    return new Response(
      JSON.stringify({ error: "The AI service is currently unavailable. Please try again." }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // SEC-008: Log actual error server-side, return generic message to client
  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    console.error(
      `[chat] Claude API error (HTTP ${claudeResponse.status}):`,
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

  // -----------------------------------------------------------------------
  // 7. Return the Claude response
  // -----------------------------------------------------------------------

  const claudeData: unknown = await claudeResponse.json();

  return new Response(JSON.stringify(claudeData), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
