/**
 * Edge Function: generate-page
 *
 * Generates a single HTML page using the design system as context.
 * Called in parallel for each page during an LLM build.
 *
 * Input:  { site_spec_id, page, design_system: { css, nav_html, footer_html, wordmark_svg }, photos[] }
 * Output: { filename, html }
 */

import {
  corsHeaders,
  isRateLimited,
  authenticateAndGetApiKey,
  createServiceClient,
  checkBodySize,
  jsonResponse,
} from "../_shared/edge-helpers.ts";
import { sanitiseHtml } from "../_shared/sanitise-html.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE_FILENAMES: Record<string, string> = {
  home: "index.html",
  about: "about.html",
  services: "services.html",
  contact: "contact.html",
  testimonials: "testimonials.html",
  faq: "faq.html",
};

const VALID_PAGES = Object.keys(PAGE_FILENAMES);

// Section names per page type
const PAGE_SECTIONS: Record<string, string[]> = {
  home: ["hero", "services-overview", "featured-testimonial", "about-preview", "cta"],
  about: ["hero", "bio", "philosophy", "qualifications", "cta"],
  services: ["hero", "service-cards", "cta"],
  contact: ["hero", "contact-form", "contact-info"],
  testimonials: ["hero", "testimonials", "cta"],
  faq: ["hero", "faq", "cta"],
};

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface PhotoInput {
  purpose: string;
  publicUrl: string;
  altText: string;
}

interface DesignSystemInput {
  css: string;
  nav_html: string;
  footer_html: string;
  wordmark_svg: string;
}

interface PageRequestBody {
  site_spec_id: string;
  page: string;
  design_system: DesignSystemInput;
  photos: PhotoInput[];
}

// ---------------------------------------------------------------------------
// System prompt builder (SEC-009: hardcoded, never accepted from client)
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
function buildSystemPrompt(page: string, spec: any, designSystem: DesignSystemInput, photos: PhotoInput[]): string {
  const sections = PAGE_SECTIONS[page] ?? ["hero", "content", "cta"];
  const sectionList = sections
    .map((s) => `<!-- bb-section:${s} -->...<section>...</section>...<!-- /bb-section:${s} -->`)
    .join("\n");

  const businessName = spec.business_name ?? "My Site";
  const doulaName = spec.doula_name ?? "";
  const tagline = spec.tagline ?? "";
  const serviceArea = spec.service_area ?? "";
  const bio = spec.bio ?? "";
  const philosophy = spec.philosophy ?? "";
  const services = spec.services ?? [];
  const testimonials = spec.testimonials ?? [];
  const email = spec.email ?? "";
  const phone = spec.phone ?? "";
  const bookingUrl = spec.booking_url ?? "";
  const doulaUk = spec.doula_uk ?? false;
  const trainingProvider = spec.training_provider ?? "";
  const trainingYear = spec.training_year ?? "";
  const primaryKeyword = spec.primary_keyword ?? "";
  const subdomain = spec.subdomain_slug ?? "example";
  const primaryLocation = spec.primary_location ?? "";
  const bioPreviousCareer = spec.bio_previous_career ?? "";
  const bioOriginStory = spec.bio_origin_story ?? "";
  const additionalTraining = spec.additional_training ?? [];
  const clientPerception = spec.client_perception ?? "";
  const signatureStory = spec.signature_story ?? "";

  const photosDesc = photos.length > 0
    ? photos.map((p) => `- ${p.purpose}: ${p.publicUrl} (alt: "${p.altText}")`).join("\n")
    : "No photos provided.";

  const servicesDesc = services.length > 0
    ? services.map((s: { title: string; description: string; price: string; type: string }) =>
        `- ${s.title} (${s.type}): ${s.description} — ${s.price}`
      ).join("\n")
    : "No services listed.";

  const testimonialsDesc = testimonials.length > 0
    ? testimonials.map((t: { quote: string; name: string; context: string }) =>
        `- "${t.quote}" — ${t.name} (${t.context})`
      ).join("\n")
    : "No testimonials provided.";

  let pageSpecific = "";

  switch (page) {
    case "home":
      pageSpecific = `## Home Page Requirements
- Hero section: MUST use full-width background image with text overlay. Use the hero photo as an <img> with object-fit:cover positioned absolutely. Add gradient overlay div for readability. h1 + tagline + CTA in white on top. Use .hero, .hero__bg, .hero__overlay, .hero__content, .hero__tagline, .btn--hero classes. If no hero photo is available, use a text-only hero with .hero--text-only class and brand colours.
- **Entity-rich h1**: Use "${businessName}${serviceArea ? ` — ${primaryKeyword || "Doula"} in ${serviceArea}` : ""}" as the h1 text.
- **Answer paragraph**: After the tagline, add a <p class="hero__answer"> with: "${doulaName || businessName} provides [service names] in ${serviceArea}."
- Services overview showing the first 3 services as cards. Each card MUST include a relevant image at the top if photos are available. Use .card--service wrapper with .card__image div (img inside) and .card__body div for text. Use .card__link for enquiry links. Fall back to plain .card if no images.
- Featured testimonial (first one, if available)
- About preview with a brief teaser linking to about.html
- Final CTA section encouraging visitors to get in touch
- **Full LocalBusiness + Person JSON-LD** in a <script type="application/ld+json"> block:
  \`\`\`json
  {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
    "name": "${businessName}",
    "description": "${tagline}",
    "url": "https://${subdomain}.birthbuild.com",
    ${email ? `"email": "${email}",` : ""}
    ${phone ? `"telephone": "${phone}",` : ""}
    ${serviceArea ? `"areaServed": "${serviceArea}",` : ""}
    ${primaryLocation ? `"address": {"@type": "PostalAddress", "addressLocality": "${primaryLocation}"},` : ""}
    "makesOffer": [for each service: {"@type":"Offer","itemOffered":{"@type":"Service","name":"...","description":"..."},"price":"...","priceCurrency":"GBP"}],
    ${trainingProvider ? `"hasCredential": [{"@type":"EducationalOccupationalCredential","credentialCategory":"Professional Training","recognizedBy":{"@type":"Organization","name":"${trainingProvider}"}}],` : ""}
    ${doulaName ? `"founder": {"@type": "Person", "name": "${doulaName}"},` : ""}
    "sameAs": [social link URLs if any]
  }
  \`\`\``;
      break;

    case "about": {
      const aboutExtras: string[] = [];
      if (bioPreviousCareer) aboutExtras.push(`- Reference their previous career: ${bioPreviousCareer}`);
      if (bioOriginStory) aboutExtras.push(`- Weave in their origin story: ${bioOriginStory}`);
      if (additionalTraining.length > 0) aboutExtras.push(`- Mention additional qualifications: ${additionalTraining.join(", ")}`);
      if (clientPerception) aboutExtras.push(`- Include what clients say about them: ${clientPerception}`);
      if (signatureStory) aboutExtras.push(`- If space allows, reference this personal story: ${signatureStory}`);
      if (trainingYear) aboutExtras.push(`- Training year: ${trainingYear}`);
      const aboutExtrasStr = aboutExtras.length > 0 ? "\n" + aboutExtras.join("\n") : "";
      pageSpecific = `## About Page Requirements
- **Entity-rich h1**: "About ${doulaName || businessName}${primaryLocation ? ` | ${primaryLocation}` : serviceArea ? ` | ${serviceArea}` : ""}"
- Bio section with the birth worker's biography. Start with an answer-first opening sentence.
- Philosophy section with their approach statement
- Qualifications section${doulaUk ? " (mention Doula UK membership)" : ""}${trainingProvider ? ` (trained with: ${trainingProvider})` : ""}${aboutExtrasStr}
- CTA section encouraging visitors to get in touch
- If a headshot photo is available, display it prominently
- **Person + Credential JSON-LD** in a <script type="application/ld+json"> block with @type Person, name, and hasCredential array listing training provider, Doula UK (if applicable), and additional training.`;
      break;
    }

    case "services":
      pageSpecific = `## Services Page Requirements
- **Entity-rich h1**: "Services | ${businessName}${serviceArea ? ` in ${serviceArea}` : ""}"
- Service cards — one card per service with title, description, and price
- CTA section encouraging visitors to book/enquire
- **Service schema JSON-LD** in a <script type="application/ld+json"> block with @graph containing an array of Service objects, each with name, description, provider (LocalBusiness with name "${businessName}"), and areaServed.`;
      break;

    case "contact":
      pageSpecific = `## Contact Page Requirements
- **Entity-rich h1**: "Contact ${businessName}${serviceArea ? ` | ${serviceArea}` : ""}"
- Contact form using Netlify Forms (add data-netlify="true" and name="contact" attributes to the <form>)
  - Fields: Name (required), Email (required), Phone (optional), Message (required, textarea)
  - Submit button
- Contact info section with:
  ${email ? `- Email: ${email}` : ""}
  ${phone ? `- Phone: ${phone}` : ""}
  ${bookingUrl ? `- Booking link: ${bookingUrl}` : ""}
  - Service area: ${serviceArea}`;
      break;

    case "testimonials":
      pageSpecific = `## Testimonials Page Requirements
- **Entity-rich h1**: "Client Reviews | ${businessName}"
- All testimonials displayed as styled blockquotes with attribution
- CTA section encouraging visitors to get in touch
- **Review + AggregateRating JSON-LD** in a <script type="application/ld+json"> block with @type LocalBusiness, aggregateRating (ratingValue 5, reviewCount ${testimonials.length}), and a review array with each testimonial as a Review object (reviewBody, author Person, ratingValue 5).`;
      break;

    case "faq":
      pageSpecific = `## FAQ Page Requirements
- **Entity-rich h1**: "FAQ | ${businessName}"
- FAQ items using <details>/<summary> elements for accessible expand/collapse
- Generate 4-6 relevant FAQs about doula/birth worker services if none are specified in the content
- CTA section encouraging visitors to get in touch
- **FAQPage JSON-LD** in a <script type="application/ld+json"> block with @type FAQPage and mainEntity array of Question objects, each with name and acceptedAnswer (Answer with text).`;
      break;
  }

  return `You are a senior web designer generating a single HTML page for a birth worker's professional website.

## MANDATORY: DESIGN SYSTEM FIDELITY

The CSS design system provided below contains the client's confirmed brand colours and fonts. These are non-negotiable.

RULES:
1. Inline the provided CSS design system EXACTLY as given in the <style> tag. Do not modify any hex values or font names.
2. Do NOT add additional colour values or font declarations that conflict with the design system.
3. Do NOT use hardcoded hex colours in inline styles or additional <style> blocks. Use the CSS custom properties (var(--colour-*)) defined in the design system.
4. Do NOT substitute fonts. The design system specifies the exact heading and body fonts. Use them.
5. If you feel the urge to use sage green, cream, or DM Serif Display — STOP. Check the design system CSS. Use what it specifies.

## Site Identity
- Business name: "${businessName}"
- Doula/birth worker name: "${doulaName}"
- Tagline: "${tagline}"
- Service area: "${serviceArea}"
- Primary keyword for SEO: "${primaryKeyword}"

## Content
Bio: ${bio || "Not provided"}
Philosophy: ${philosophy || "Not provided"}

### Services
${servicesDesc}

### Testimonials
${testimonialsDesc}

## Photos
${photosDesc}

## Design System CSS (already generated — inline EXACTLY in <style>)
The CSS design system has already been generated with the client's exact brand colours and fonts. You MUST inline it character-for-character in the <style> tag of your page. Do NOT modify any values. Do NOT add conflicting colour or font declarations.

## Navigation HTML (already generated — use verbatim)
The navigation header has been generated. Insert it verbatim after <body>.

## Footer HTML (already generated — use verbatim)
The footer has been generated. Insert it verbatim before </body>.

${pageSpecific}

## Section Markers
Wrap each content section in HTML comment markers:
${sectionList}

These markers enable deterministic editing later. Every section of content within <main> must be wrapped.

## Output Format
Generate a complete \`<!DOCTYPE html>\` page with:
1. \`<html lang="en-GB">\`
2. \`<head>\` with:
   - charset utf-8, viewport meta
   - Content-Security-Policy meta tag: \`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://*.supabase.co data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'">\`
   - SEO title and description (unique to this page)
   - Open Graph and Twitter Card meta tags
   - Google Fonts \`<link>\` (preconnect + stylesheet)
   - \`<style>\` block containing the complete design system CSS
3. \`<body>\` with:
   - The navigation HTML (with {{ACTIVE_PAGE}} replaced with "${page}")
   - \`<main id="main">\` containing all page sections with markers
   - The footer HTML
4. If photos are available, insert \`<img>\` tags with the provided URLs, alt text, and \`loading="lazy"\`

## Constraints
- Semantic HTML5 with proper landmark roles
- WCAG AA accessible (labels, alt text, focus styles, contrast)
- British English throughout (colour, organisation, labour, specialise, centre, programme)
- No medical claims or language that could be construed as medical advice
- No JavaScript. \`<script type="application/ld+json">\` IS permitted on any page — JSON-LD is structured data, not executable code.
- Mobile-first responsive (the CSS handles this)
- Creative, professional, and warm — make this site stand out
- CRITICAL: Do NOT add any inline styles with hardcoded colours. Use var(--colour-primary), var(--colour-accent), etc. from the design system CSS.
- CRITICAL: Do NOT override the design system fonts with different font families.`;
}

// ---------------------------------------------------------------------------
// Tool definition (SEC-010: hardcoded)
// ---------------------------------------------------------------------------

const OUTPUT_TOOL = {
  name: "output_page",
  description: "Output the generated HTML page.",
  input_schema: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description: "Complete HTML page content (<!DOCTYPE html>...)</html>).",
      },
    },
    required: ["html"],
  },
};

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
  if (await isRateLimited("generate-page", auth!.userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse(
      { error: "Too many page generation requests. Please wait and try again." },
      429,
      cors,
    );
  }

  // 3. Parse body
  const sizeErr = checkBodySize(req, cors);
  if (sizeErr) return sizeErr;

  let body: PageRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, cors);
  }

  if (!body.site_spec_id || !UUID_RE.test(body.site_spec_id)) {
    return jsonResponse({ error: "Missing or invalid site_spec_id." }, 400, cors);
  }

  if (!body.page || !VALID_PAGES.includes(body.page)) {
    return jsonResponse({ error: `Invalid page: ${body.page}. Must be one of: ${VALID_PAGES.join(", ")}` }, 400, cors);
  }

  if (!body.design_system?.css || !body.design_system?.nav_html || !body.design_system?.footer_html) {
    return jsonResponse({ error: "Missing design_system fields (css, nav_html, footer_html)." }, 400, cors);
  }

  // 4. Fetch spec
  const serviceClient = createServiceClient();
  const { data: spec, error: specError } = await serviceClient
    .from("site_specs")
    .select("*")
    .eq("id", body.site_spec_id)
    .eq("user_id", auth!.userId)
    .single();

  if (specError || !spec) {
    return jsonResponse({ error: "Site specification not found." }, 404, cors);
  }

  // 5. Build system prompt with spec data and design system context
  const systemPrompt = buildSystemPrompt(body.page, spec, body.design_system, body.photos ?? []);

  // Build user message with design system inline
  const userMessage = `Generate the ${body.page} page. Here is the design system to use:

### CSS (inline in <style>):
\`\`\`css
${body.design_system.css}
\`\`\`

### Navigation HTML (insert after <body>):
\`\`\`html
${body.design_system.nav_html.replace("{{WORDMARK_SVG}}", body.design_system.wordmark_svg ?? "")}
\`\`\`

### Footer HTML (insert before </body>):
\`\`\`html
${body.design_system.footer_html}
\`\`\`

Use the output_page tool to return the complete HTML page.`;

  // 6. Call Claude API
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
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [OUTPUT_TOOL],
        tool_choice: { type: "tool", name: "output_page" },
      }),
    });
  } catch (fetchError: unknown) {
    const detail = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
    console.error(`[generate-page:${body.page}] Claude API fetch failed:`, detail);
    return jsonResponse(
      { error: "The AI service is currently unavailable. Please try again." },
      502,
      cors,
    );
  }

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    console.error(
      `[generate-page:${body.page}] Claude API error (HTTP ${claudeResponse.status}):`,
      errorText,
    );
    return jsonResponse(
      { error: `Failed to generate ${body.page} page. Please try again.` },
      502,
      cors,
    );
  }

  // deno-lint-ignore no-explicit-any
  let claudeData: any;
  try {
    claudeData = await claudeResponse.json();
  } catch (parseErr: unknown) {
    const detail = parseErr instanceof Error ? parseErr.message : "Unknown parse error";
    console.error(`[generate-page:${body.page}] Failed to parse Claude response:`, detail);
    return jsonResponse(
      { error: `Failed to generate ${body.page} page. Please try again.` },
      500,
      cors,
    );
  }

  if (claudeData.stop_reason === "max_tokens") {
    console.error(`[generate-page:${body.page}] Claude hit max_tokens limit`);
    // Check if the tool call completed despite the truncation
    const partialToolUse = claudeData.content?.find(
      // deno-lint-ignore no-explicit-any
      (block: any) => block.type === "tool_use" && block.name === "output_page",
    );
    if (!partialToolUse?.input?.html) {
      return jsonResponse(
        { error: `Page generation for ${body.page} was cut short. Please try again.` },
        500,
        cors,
      );
    }
  }

  const toolUse = claudeData.content?.find(
    // deno-lint-ignore no-explicit-any
    (block: any) => block.type === "tool_use" && block.name === "output_page",
  );

  if (!toolUse?.input?.html) {
    console.error(
      `[generate-page:${body.page}] No tool_use block. stop_reason=${claudeData.stop_reason}, content_types=${
        claudeData.content?.map((b: { type: string }) => b.type).join(",") ?? "none"
      }`,
    );
    return jsonResponse(
      { error: `Failed to generate ${body.page} page. Please try again.` },
      500,
      cors,
    );
  }

  // 7. Sanitise output
  const sanitisedHtml = sanitiseHtml(toolUse.input.html as string);
  const filename = PAGE_FILENAMES[body.page] ?? `${body.page}.html`;

  return jsonResponse(
    {
      success: true,
      filename,
      html: sanitisedHtml,
    },
    200,
    cors,
  );
});
