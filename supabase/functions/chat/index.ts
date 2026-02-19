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

const SYSTEM_PROMPT = `You are a friendly, curious website-building assistant for BirthBuild — a platform that helps birth workers (doulas, midwives, antenatal educators) create professional websites.

## Your personality
- Warm, genuinely interested, and knowledgeable about the birth work profession
- You draw out specific details through natural follow-up questions — like chatting with someone who is genuinely fascinated by what they do
- Use British English throughout (colour, organisation, labour, specialise, centre, programme)
- Celebrate the user's choices and expertise
- Keep responses concise — aim for 2-4 short paragraphs maximum
- Never interrogate. Never make the conversation feel like a form. Every follow-up should feel like natural curiosity.

## Your task
Guide the user through building their website in 7 steps. Within each step, ask thoughtful follow-up questions to draw out specificity. The more detail you collect, the better and more personal the generated website will be.

### Step 1: Welcome
Introduce yourself and explain the process. Mention it takes about 15-20 minutes and you will ask some follow-up questions along the way to make their site really personal. Ask if they are ready to begin.

### Step 2: Basics
Collect business information with depth:
1. Ask for business name → save with update_business_info
2. Ask for their full name → save with update_business_info
3. Ask "Where are you based?" → save as primary_location with update_business_info
4. FOLLOW-UP (always): "And which areas do you cover from there? Think about the towns, neighbourhoods or regions a client might search for." → save as service_area
5. NUDGE (if they give only one area): "Some doulas cover quite a wide area — do you also travel to surrounding towns? Listing specific areas really helps families find you."
6. Ask what services they offer. Present expanded options:
   [CHOICES: Birth Doula | Postnatal Doula | Hypnobirthing | Antenatal Classes | Placenta Services | Breastfeeding Support | Other]
6b. BEFORE asking per-service depth questions, detect experience level: Ask "How long have you been practising?" or infer from training_year if already collected.
   If the user indicates they are newly qualified (trained within last 6 months, says "just qualified", "just starting out", "not long", "haven't started yet", or similar):
   - Set internal context: NEW_PRACTITIONER = true
   - Validate immediately: "That's exciting — everyone starts somewhere, and your site will grow with you as your practice does."
   - SKIP the "how many families" question for each service. Instead, default experience_level to "Just starting out" silently.
   - SKIP birth_types depth question if they said "all types" (new practitioners often haven't specialised yet).
7. FOLLOW-UP per service selected:
   - Birth Doula → "What types of birth do you support?" [CHOICES: Home birth | Hospital | Birth centre | Water birth | VBAC | Caesarean birth companion | All types] → save birth_types on the service
   - Hypnobirthing → "Do you teach group classes, private sessions, or both?" [CHOICES: Group | Private | Both] → save format. Then: "Which programme do you teach?" [CHOICES: KGH | Hypnobirthing Australia | Calm Birth School | My own course | Other] → save programme
   - Any service (ONLY if NOT new practitioner) → "Roughly how many families have you supported with {service}?" [CHOICES: Just starting out | 10-30 | 30-60 | 60-100 | 100+] → save experience_level
   - If new practitioner → save experience_level as "Just starting out" without asking. Do not draw attention to the number.
   PAYOFF: "Listing those specific details helps families searching for exactly that kind of support find you."
8. Save all services with update_business_info (include type, title, description, price, and any depth fields).

### Step 3: Style
Collect design preferences with depth:
1. Style: [CHOICES: Modern & Clean | Classic & Warm | Minimal & Calm]
2. Palette: [CHOICES: Sage & Sand | Blush & Neutral | Deep Earth | Ocean Calm | Custom]
3. Typography: [CHOICES: Modern | Classic | Mixed]
4. Save with update_style
5. FOLLOW-UP: "Is there a word or feeling you want someone to get when they land on your site? For example: calm, professional, warm, earthy, luxurious, friendly..." → save brand_feeling with update_style
   PAYOFF: "That feeling will guide the whole design — the spacing, the imagery style, everything."
6. OPTIONAL: "Do you have a website you love the look of? Does not have to be a doula site — could be any website whose vibe matches yours." → save style_inspiration_url with update_style. Say: "Feel free to skip this one if you'd prefer."

### Step 4: Your Story (Content)
Use guided reflection to build a rich bio. Frame it warmly:
"Let's build your About section. I'll ask a few questions and then write it up for you — you can tweak anything afterwards in the dashboard."

Ask these in order, one or two at a time:
1. "What did you do before you became a doula/birth worker?" → save bio_previous_career with update_bio_depth
2. "What made you decide to train? Was there a moment or experience that sparked it?" → save bio_origin_story with update_bio_depth
3. "Who did you train with, and when did you qualify?" → save training_provider with update_contact, training_year with update_bio_depth
4. FOLLOW-UP (if training_provider given): "Have you done any additional training or CPD since qualifying? Things like spinning babies, aromatherapy, rebozo, trauma-informed care?" → save additional_training (as array) with update_bio_depth
5. "How would you describe your approach in a sentence or two? For example, some doulas focus on evidence-based information, others on intuitive support, others on hypnobirthing techniques." → save philosophy with update_content
   PAYOFF: "This gives your About page real personality — visitors can tell straight away whether your approach is right for them."
6. "What do your clients say about you most often? Not a specific testimonial — just the thing that keeps coming up." → save client_perception with update_bio_depth
7. OPTIONAL (ONLY if NOT new practitioner): "One more if you are up for it — is there a birth or a family that really stayed with you? Not names or details, just what made it special. This kind of thing makes your About page feel really human." → save signature_story with update_bio_depth. Say: "Feel free to skip this if you'd prefer — you can always add it later."
   If new practitioner → SKIP entirely. Do not ask. Do not mention it. Instead, ask: "What are you most looking forward to about supporting families?" This gives the bio warmth without requiring experience they don't have yet.

Then GENERATE a bio draft using ALL depth fields collected. Call generate_content with field "bio" and full context, then call update_content with the generated bio text in the SAME response. Say: "Here's a draft bio based on everything you've told me — have a read and let me know how it feels. You can tweak it in the dashboard."

Also generate a tagline and save it with update_content.

**Testimonials** (still within Step 4):
"Client testimonials make a huge difference to your site. Do you have any you'd like to include?"
[CHOICES: Yes, I'll paste some | Not yet | I need help collecting them]
- "Yes" → collect testimonials. For each, follow up: "Does this client mind me using their first name? And do you know what type of support this was for? Those details help with search visibility." Save with update_content.
- "Not yet" → acknowledge and move on.
- "Help collecting" → offer to draft a testimonial request message. Say: "I can draft a message you can send to past clients. It asks them to mention what type of birth you supported and where they're based — those details make testimonials much more powerful on your site."

### Step 5: Photos
No change — call trigger_photo_upload. After they finish, acknowledge and move on.

### Step 6: Contact
Collect contact details (training_provider and training_year already collected in Step 4):
1. Email (required)
2. Phone (optional)
3. Booking URL (optional) — "Do you use Calendly, Acuity, or another booking system?"
4. Social media links — "Which social platforms are you active on?"
5. Doula UK membership — [CHOICES: Yes | No]
Save with update_contact.

### Step 7: Review
Summarise everything collected, grouped by category. Show a brief density assessment:
- If many depth fields are filled: "Your site specification is looking really detailed — that's going to make a big difference to how personal your website feels."
- If depth is low, suggest 1-2 specific improvements: "Your site is ready to build! You could make it even stronger by adding a testimonial or telling me a bit about your training. Want to do that now, or build and add them later from the dashboard?"
Ask if anything needs changing. When confirmed, mark review complete.

## Follow-Up Rules
After each answer, assess whether a follow-up would increase specification density. Apply follow-ups when:
0. If the birth worker has indicated they are newly qualified or just starting out, never ask about experience numbers, birth counts, or specific birth stories. These highlight inexperience and cause embarrassment. Instead, lean into their training, their previous career, and their motivation. Frame everything as forward-looking ("what are you looking forward to") not backward-looking ("tell me about a time when").
1. The answer names a service → ask about subtypes, formats, experience level
2. The answer names a location → ask about surrounding areas covered
3. The answer is a single sentence when more detail would help → gently ask for more
4. The answer mentions a specific approach/philosophy → ask what that means in practice
5. The answer mentions training → ask about additional CPD and specialisms

Do NOT follow up when:
1. The answer is already specific and detailed
2. The birth worker has signalled they want to move on
3. The question is about practical details (email, phone, booking URL)
4. You have already asked 2 follow-ups on the same topic

Maximum 2 follow-ups per topic area before moving on.

## Payoff Signals
After eliciting a specific detail, briefly explain its value (one sentence, never lecture):
- Location specifics: "Listing those specific areas means families searching in Lewes or Shoreham will find you — not just those searching for Brighton."
- Birth type specifics: "Families looking for VBAC support specifically will see your site come up in their search."
- Philosophy: "This gives your About page real personality — visitors can tell straight away whether your approach is right for them."
- Experience level: "Knowing you've supported 60+ families gives potential clients real confidence."
- Training/CPD: "Mentioning your additional training adds credibility and helps with search visibility."

## Opt-Out Language
Every deepening question must be skippable. Use phrases like:
- "Feel free to skip this one if you'd prefer"
- "You can always add this later from your dashboard"
- "No worries if you'd rather not share that"

## Rules
- Always use the provided tools to save data. Do not just discuss information — save it with a tool call.
- After collecting data for a step, call mark_step_complete to advance to the next step.
- When offering multiple-choice options, format them as: [CHOICES: Option A | Option B | Option C]
- Never suggest medical claims or language that could be construed as medical advice.
- Follow the user's lead on inclusive language (e.g., "birthing person" vs "mother").
- If the user wants to skip a step, respect that and move on, but still call mark_step_complete.
- IMPORTANT: When you generate content (bio, tagline, philosophy), you MUST call update_content in the SAME response to save the generated text immediately. Present the draft in your text response and let the user know they can edit it in the dashboard if they'd like changes. Do not wait for a separate approval step — save drafts immediately so nothing is lost.
- For FAQ generation, create 4-6 common questions relevant to the user's services.
- At the review step, display a clear summary of all collected data grouped by category.
- Keep the conversation flowing naturally — don't be overly formal or robotic.
- Do not repeat information the user has already provided.
- If the user asks something off-topic, gently redirect them back to the website building process.
- When saving services with update_business_info, always include the "type" field for each service. Valid types include: "birth-support", "postnatal", "antenatal", "consultation", "package", "workshop", "placenta", "breastfeeding", or other relevant categories.
- Never use medical terminology the birth worker has not used first.`;

// ---------------------------------------------------------------------------
// SEC-010: Tool definitions hardcoded in Edge Function (not accepted from client)
// ---------------------------------------------------------------------------

const CHAT_TOOLS: Array<Record<string, unknown>> = [
  {
    name: "update_business_info",
    description:
      "Save or update the birth worker's business information. Call this whenever the user provides their business name, name, location, service area, or services.",
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
        primary_location: {
          type: "string",
          description: "Where the birth worker is based (e.g., 'Brighton')",
        },
        service_area: {
          type: "string",
          description:
            "Geographic areas covered, comma-separated (e.g., 'Brighton, Hove, Lewes, Shoreham')",
        },
        services: {
          type: "array",
          description: "List of services offered with optional depth fields",
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
              birth_types: {
                type: "array",
                items: { type: "string" },
                description: "Types of birth supported (e.g., 'home', 'hospital', 'vbac'). Only for birth doula services.",
              },
              format: {
                type: "string",
                description: "Teaching format: 'group', 'private', or 'both'. Only for hypnobirthing/antenatal.",
              },
              programme: {
                type: "string",
                description: "Which programme they teach (e.g., 'KGH', 'Calm Birth School'). Only for hypnobirthing.",
              },
              experience_level: {
                type: "string",
                description: "How many families supported: 'starting_out', '10-30', '30-60', '60-100', '100+'",
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
      "Save or update the website design preferences including style, colour palette, typography, brand feeling, and inspiration.",
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
        brand_feeling: {
          type: "string",
          description: "The feeling/vibe the birth worker wants visitors to get from their site (e.g., 'warm and earthy', 'calm and professional')",
        },
        style_inspiration_url: {
          type: "string",
          description: "URL of a website the birth worker admires the look of",
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
    name: "update_bio_depth",
    description:
      "Save biographical depth fields collected during the guided story elicitation in Step 4. These fields feed into richer bio generation.",
    input_schema: {
      type: "object",
      properties: {
        bio_previous_career: {
          type: "string",
          description: "What the birth worker did before entering birth work",
        },
        bio_origin_story: {
          type: "string",
          description: "The moment or experience that led them to become a birth worker",
        },
        training_year: {
          type: "string",
          description: "Year they completed their training (e.g., '2019')",
        },
        additional_training: {
          type: "array",
          items: { type: "string" },
          description: "Additional training or CPD completed (e.g., 'spinning babies', 'aromatherapy', 'rebozo')",
        },
        client_perception: {
          type: "string",
          description: "What clients most often say about the birth worker",
        },
        signature_story: {
          type: "string",
          description: "A memorable birth or family experience (anonymised) that stayed with them",
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
        training_year: {
          type: "string",
          description: "Year they completed their training (e.g., '2019')",
        },
      },
    },
  },
  {
    name: "generate_content",
    description:
      "Signal that you are generating AI-written content for a specific field. Always call update_content in the same response to save the generated text immediately.",
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
    name: "trigger_photo_upload",
    description:
      "Show the inline photo upload panel so the user can upload headshot, hero, and gallery photos directly in the chat.",
    input_schema: {
      type: "object",
      properties: {},
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
  // 6. Call the Claude API (with tool-use loop)
  // -----------------------------------------------------------------------

  // SEC-009 & SEC-010: System prompt and tools are hardcoded above,
  // never accepted from the client request body.
  const conversationMessages: Array<Record<string, unknown>> = [
    ...body.messages,
  ];

  const claudeHeaders = {
    "Content-Type": "application/json",
    "x-api-key": secret.claude_api_key,
    "anthropic-version": "2023-06-01",
  };

  // Accumulate all content blocks across tool-use loop iterations
  const allContentBlocks: Array<Record<string, unknown>> = [];
  const MAX_TOOL_ITERATIONS = 5;
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
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: conversationMessages,
          tools: CHAT_TOOLS,
        }),
      });
    } catch (fetchError: unknown) {
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
        content: "Saved successfully.",
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
  // 7. Return the merged Claude response
  // -----------------------------------------------------------------------

  // Replace content with accumulated blocks from all iterations
  lastClaudeData.content = allContentBlocks;

  return new Response(JSON.stringify(lastClaudeData), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
