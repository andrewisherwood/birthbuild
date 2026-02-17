/**
 * Edge Function: edit-section
 *
 * LLM-powered editing of a single HTML section.
 * Takes the section HTML, an instruction, and context,
 * then returns the rewritten section.
 *
 * Input:  { section_html, section_name, instruction, context }
 * Output: { edited_html }
 */

import {
  corsHeaders,
  isRateLimited,
  authenticateAndGetApiKey,
  jsonResponse,
} from "../_shared/edge-helpers.ts";
import { sanitiseHtml } from "../_shared/sanitise-html.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour
const MAX_SECTION_HTML_LENGTH = 50_000;
const MAX_INSTRUCTION_LENGTH = 2_000;

// ---------------------------------------------------------------------------
// System prompt (SEC-009: hardcoded)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a web designer editing a single HTML section of a birth worker's professional website.

## Rules
- Rewrite the HTML section based on the user's instruction
- Preserve the section markers: <!-- bb-section:NAME --> and <!-- /bb-section:NAME -->
- Preserve the existing CSS class names (they reference the site's design system)
- Keep the same semantic HTML structure (headings, sections, articles, etc.)
- Use British English throughout (colour, organisation, labour, specialise, centre, programme)
- Never include medical claims or language construed as medical advice
- No JavaScript
- No <script>, <iframe>, <object>, or <embed> tags
- Keep the output concise — match the approximate length of the original unless the instruction asks for more content
- If the instruction asks you to add content, generate professional, warm copy appropriate for a birth worker's website`;

// ---------------------------------------------------------------------------
// Tool definition (SEC-010: hardcoded)
// ---------------------------------------------------------------------------

const OUTPUT_TOOL = {
  name: "output_edited_section",
  description: "Output the edited HTML section.",
  input_schema: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description: "The edited HTML section, including the bb-section markers.",
      },
    },
    required: ["html"],
  },
};

// ---------------------------------------------------------------------------
// Request type
// ---------------------------------------------------------------------------

interface EditSectionBody {
  section_html: string;
  section_name: string;
  instruction: string;
  context?: {
    business_name?: string;
    doula_name?: string;
    service_area?: string;
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
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  // 1. Auth
  const { auth, error: authErr } = await authenticateAndGetApiKey(req, cors);
  if (authErr) return authErr;

  // 2. Rate limit
  if (isRateLimited("edit-section", auth!.userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse(
      { error: "Too many edit requests. Please wait and try again." },
      429,
      cors,
    );
  }

  // 3. Parse body
  let body: EditSectionBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, cors);
  }

  if (!body.section_html || typeof body.section_html !== "string") {
    return jsonResponse({ error: "Missing section_html." }, 400, cors);
  }

  if (body.section_html.length > MAX_SECTION_HTML_LENGTH) {
    return jsonResponse({ error: "Section HTML too large." }, 400, cors);
  }

  if (!body.instruction || typeof body.instruction !== "string") {
    return jsonResponse({ error: "Missing instruction." }, 400, cors);
  }

  if (body.instruction.length > MAX_INSTRUCTION_LENGTH) {
    return jsonResponse({ error: "Instruction too long." }, 400, cors);
  }

  if (!body.section_name || typeof body.section_name !== "string") {
    return jsonResponse({ error: "Missing section_name." }, 400, cors);
  }

  // 4. Build user message
  const contextParts: string[] = [];
  if (body.context?.business_name) {
    contextParts.push(`Business: ${body.context.business_name}`);
  }
  if (body.context?.doula_name) {
    contextParts.push(`Name: ${body.context.doula_name}`);
  }
  if (body.context?.service_area) {
    contextParts.push(`Area: ${body.context.service_area}`);
  }

  const contextStr = contextParts.length > 0
    ? `\n\nBusiness context: ${contextParts.join(", ")}`
    : "";

  const userMessage = `Edit the "${body.section_name}" section according to this instruction:

"${body.instruction}"
${contextStr}

Here is the current section HTML:
\`\`\`html
${body.section_html}
\`\`\`

Use the output_edited_section tool to return the edited HTML. Keep the <!-- bb-section:${body.section_name} --> and <!-- /bb-section:${body.section_name} --> markers.`;

  // 5. Call Claude API
  let claudeResponse: Response;
  try {
    claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": auth!.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [OUTPUT_TOOL],
        tool_choice: { type: "tool", name: "output_edited_section" },
      }),
    });
  } catch (fetchError: unknown) {
    const detail = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
    console.error("[edit-section] Claude API fetch failed:", detail);
    return jsonResponse(
      { error: "The AI service is currently unavailable. Please try again." },
      502,
      cors,
    );
  }

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    console.error(
      `[edit-section] Claude API error (HTTP ${claudeResponse.status}):`,
      errorText,
    );
    return jsonResponse(
      { error: "The AI service returned an error. Please try again." },
      502,
      cors,
    );
  }

  // deno-lint-ignore no-explicit-any
  const claudeData: any = await claudeResponse.json();
  const toolUse = claudeData.content?.find(
    // deno-lint-ignore no-explicit-any
    (block: any) => block.type === "tool_use" && block.name === "output_edited_section",
  );

  if (!toolUse?.input?.html) {
    console.error("[edit-section] No tool_use block in Claude response");
    return jsonResponse(
      { error: "Failed to edit section. Please try again." },
      500,
      cors,
    );
  }

  // 6. Sanitise output
  const sanitisedHtml = sanitiseHtml(toolUse.input.html as string);

  return jsonResponse(
    {
      success: true,
      edited_html: sanitisedHtml,
    },
    200,
    cors,
  );
});
