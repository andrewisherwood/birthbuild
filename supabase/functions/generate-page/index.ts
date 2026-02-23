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
import { callModel, type ToolDefinition } from "../_shared/model-client.ts";
import {
  resolveTemplate,
  buildPageVariables,
  type ResolvedSpecForPrompt,
} from "../_shared/prompt-resolver.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_PROVIDERS = ["anthropic", "openai"] as const;
type ModelProvider = typeof VALID_PROVIDERS[number];

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 16384;

// ---------------------------------------------------------------------------
// Prompt config (A/B testing harness override)
// ---------------------------------------------------------------------------

interface PromptConfig {
  system_prompt?: string;
  user_message?: string;
  model_provider?: string;
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  provider_api_key?: string;
}

function validatePromptConfig(pc: unknown): { valid: boolean; error?: string } {
  if (pc === undefined || pc === null) return { valid: true };
  if (typeof pc !== "object" || Array.isArray(pc)) {
    return { valid: false, error: "prompt_config must be an object." };
  }
  const obj = pc as Record<string, unknown>;
  if (obj.system_prompt !== undefined && typeof obj.system_prompt !== "string") {
    return { valid: false, error: "prompt_config.system_prompt must be a string." };
  }
  if (obj.user_message !== undefined && typeof obj.user_message !== "string") {
    return { valid: false, error: "prompt_config.user_message must be a string." };
  }
  if (obj.model_provider !== undefined) {
    if (typeof obj.model_provider !== "string" || !VALID_PROVIDERS.includes(obj.model_provider as ModelProvider)) {
      return { valid: false, error: `prompt_config.model_provider must be one of: ${VALID_PROVIDERS.join(", ")}.` };
    }
  }
  if (obj.model_name !== undefined && typeof obj.model_name !== "string") {
    return { valid: false, error: "prompt_config.model_name must be a string." };
  }
  if (obj.temperature !== undefined) {
    if (typeof obj.temperature !== "number" || obj.temperature < 0 || obj.temperature > 1) {
      return { valid: false, error: "prompt_config.temperature must be a number between 0 and 1." };
    }
  }
  if (obj.max_tokens !== undefined) {
    if (typeof obj.max_tokens !== "number" || obj.max_tokens < 1 || obj.max_tokens > 32768) {
      return { valid: false, error: "prompt_config.max_tokens must be a number between 1 and 32768." };
    }
  }
  if (obj.provider_api_key !== undefined && typeof obj.provider_api_key !== "string") {
    return { valid: false, error: "prompt_config.provider_api_key must be a string." };
  }
  return { valid: true };
}

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
  prompt_config?: PromptConfig;
}

// ---------------------------------------------------------------------------
// Spec resolution (for prompt template variable building)
// ---------------------------------------------------------------------------

const PALETTES: Record<string, { background: string; primary: string; accent: string; text: string; cta: string }> = {
  sage_sand: { background: "#f5f0e8", primary: "#5f7161", accent: "#c9b99a", text: "#3d3d3d", cta: "#5f7161" },
  blush_neutral: { background: "#fdf6f0", primary: "#c9928e", accent: "#d4c5b9", text: "#4a4a4a", cta: "#c9928e" },
  deep_earth: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a08060", text: "#2d2d2d", cta: "#6b4c3b" },
  ocean_calm: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#8fb8c9", text: "#2d3b3e", cta: "#3d6b7e" },
};

const TYPOGRAPHY_PRESETS: Record<string, { heading: string; body: string }> = {
  modern: { heading: "Inter", body: "Inter" },
  classic: { heading: "Playfair Display", body: "Source Sans 3" },
  mixed: { heading: "DM Serif Display", body: "Inter" },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidSocialLink(url: string): boolean {
  return url.startsWith("https://") && url.length <= 500;
}

// deno-lint-ignore no-explicit-any
function resolveSpecForPrompt(spec: any): ResolvedSpecForPrompt {
  let colours: ResolvedSpecForPrompt["colours"];
  let headingFont: string;
  let bodyFont: string;
  let spacingDensity = "default";
  let borderRadius = "rounded";
  let typographyScale = "default";

  if (spec.design) {
    colours = spec.design.colours ?? PALETTES["sage_sand"]!;
    headingFont = spec.design.typography?.headingFont ?? TYPOGRAPHY_PRESETS["modern"]!.heading;
    bodyFont = spec.design.typography?.bodyFont ?? TYPOGRAPHY_PRESETS["modern"]!.body;
    spacingDensity = spec.design.spacing?.density ?? "default";
    borderRadius = spec.design.borderRadius ?? "rounded";
    typographyScale = spec.design.typography?.scale ?? "default";
  } else if (spec.palette === "custom" && spec.custom_colours) {
    const cc = spec.custom_colours;
    const valid = ["background", "primary", "accent", "text", "cta"].every(
      (k: string) => HEX_RE.test(cc[k] ?? ""),
    );
    colours = valid
      ? {
          background: cc.background, primary: cc.primary, accent: cc.accent,
          text: cc.text, cta: cc.cta,
          background_description: cc.background_description, primary_description: cc.primary_description,
          accent_description: cc.accent_description, text_description: cc.text_description,
          cta_description: cc.cta_description,
        }
      : PALETTES["sage_sand"]!;
    const typo = TYPOGRAPHY_PRESETS[spec.typography] ?? TYPOGRAPHY_PRESETS["modern"]!;
    headingFont = spec.font_heading ?? typo.heading;
    bodyFont = spec.font_body ?? typo.body;
  } else {
    colours = PALETTES[spec.palette] ?? PALETTES["sage_sand"]!;
    const typo = TYPOGRAPHY_PRESETS[spec.typography] ?? TYPOGRAPHY_PRESETS["modern"]!;
    headingFont = spec.font_heading ?? typo.heading;
    bodyFont = spec.font_body ?? typo.body;
  }

  const socialLinks: Array<{ platform: string; url: string }> = [];
  if (spec.social_links && typeof spec.social_links === "object") {
    for (const [platform, url] of Object.entries(spec.social_links)) {
      if (typeof url === "string" && isValidSocialLink(url)) {
        socialLinks.push({ platform, url });
      }
    }
  }

  return {
    businessName: spec.business_name ?? "My Site",
    doulaName: spec.doula_name ?? "",
    tagline: spec.tagline ?? "",
    serviceArea: spec.service_area ?? "",
    style: spec.style ?? "modern",
    colours,
    headingFont,
    bodyFont,
    pages: spec.pages ?? ["home", "about", "services", "contact"],
    socialLinks,
    spacingDensity,
    borderRadius,
    typographyScale,
    brandFeeling: spec.brand_feeling ?? "",
    year: new Date().getFullYear(),
  };
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

  const hasPhotos = photos.length > 0;
  const heroPhoto = photos.find((p) => p.purpose === "hero");
  const headshotPhoto = photos.find((p) => p.purpose === "headshot");
  const galleryPhotos = photos.filter((p) => p.purpose === "gallery");
  const photosDesc = hasPhotos
    ? `PHOTOS ARE PROVIDED — you MUST use every one. Do NOT use .hero--text-only when a hero photo is listed. Do NOT use plain .card when gallery photos are listed.\n${photos.map((p) => `- ${p.purpose}: ${p.publicUrl} (alt: "${p.altText}")`).join("\n")}`
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
    case "home": {
      const heroHtml = heroPhoto
        ? `Use this EXACT hero structure (copy it literally, do NOT use .hero--text-only):
\`\`\`html
<section class="hero">
  <img class="hero__bg" src="${heroPhoto.publicUrl}" alt="${heroPhoto.altText}" loading="lazy">
  <div class="hero__overlay"></div>
  <div class="hero__content">
    <h1>...</h1>
    <p class="hero__tagline">...</p>
    <p class="hero__answer">...</p>
    <a class="btn btn--hero" href="/contact">...</a>
  </div>
</section>
\`\`\``
        : "No hero photo — use .hero.hero--text-only with brand colour gradient.";
      const cardHtml = galleryPhotos.length > 0
        ? `Use .card--service with images. Here is the structure for EACH card (copy this pattern):
\`\`\`html
<article class="card card--service">
  <img class="card__image" src="[gallery photo URL from Photos section]" alt="[alt]" loading="lazy">
  <div class="card__body">
    <h3>Service Title</h3>
    <p>Description</p>
    <p><strong>Price</strong></p>
    <a class="card__link" href="/contact">Enquire</a>
  </div>
</article>
\`\`\`
Assign one gallery photo to each of the first 3 service cards.`
        : "Use plain .card with text content (no images available).";
      pageSpecific = `## Home Page Requirements
- Hero section: ${heroHtml}
- **Entity-rich h1**: Use "${businessName}${serviceArea ? ` — ${primaryKeyword || "Doula"} in ${serviceArea}` : ""}" as the h1 text.
- **Answer paragraph**: After the tagline, add a <p class="hero__answer"> with: "${doulaName || businessName} provides [service names] in ${serviceArea}."
- Services overview showing the first 3 services as cards. ${cardHtml}
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
    }

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
- **Hero**: Use \`.hero .hero--inner\` (NOT the full 85vh hero). Same layered structure as homepage hero (.hero__bg, .hero__overlay, .hero__content) but shorter. h1 + tagline only, no CTA button.
- **Entity-rich h1**: "About ${doulaName || businessName}${primaryLocation ? ` | ${primaryLocation}` : serviceArea ? ` | ${serviceArea}` : ""}"
- **Bio section layout**: Use a \`.section > .section-inner > .about-content\` grid. ${headshotPhoto ? `Place this EXACT image on the left:\n\`<img class="headshot" src="${headshotPhoto.publicUrl}" alt="${headshotPhoto.altText}" loading="lazy">\`` : "Place a placeholder area on the left."} The bio text goes on the right in a \`<div class="bio-text">\`. This creates a two-column layout on desktop and stacks on mobile.
- Start the bio with an answer-first opening sentence.
- If a signature story is provided, wrap it in a \`<blockquote>\` inside the bio-text div for visual emphasis.
- **Philosophy section**: Separate \`.section.section--alt\` with their approach statement. Heading: "My Approach".
- **Qualifications section**: Separate \`.section\` with heading "Qualifications & Training". List qualifications using a \`<ul>\` with checkmark (✓) items.${doulaUk ? " Mention Doula UK membership." : ""}${trainingProvider ? ` Trained with: ${trainingProvider}.` : ""}${aboutExtrasStr}
- **CTA section**: Final \`.section.section--alt.text-center\` encouraging visitors to get in touch with a .btn link to /contact.
- **Person + Credential JSON-LD** in a <script type="application/ld+json"> block with @type Person, name, and hasCredential array listing training provider, Doula UK (if applicable), and additional training.`;
      break;
    }

    case "services":
      pageSpecific = `## Services Page Requirements
- **Entity-rich h1**: "Services | ${businessName}${serviceArea ? ` in ${serviceArea}` : ""}"
- The first content section must use: <section class="section"><div class="section-inner">...</div></section>
- Service cards section must include:
  - a grid wrapper using .cards (preferred), .grid, or .services-grid
  - one card per service using .card (or .card card--service when an image is used)
  - title, description, and <span class="price"> for each service
  - at least one CTA using .btn or .btn--outline
- CTA section encouraging visitors to book/enquire and using design-system button classes
- Do NOT invent alternative component class names. Use existing design-system classes only.
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
4. ${hasPhotos ? "Photos ARE available (listed in the Photos section above). You MUST insert them as \`<img>\` tags using the exact URLs provided, with the specified alt text and \`loading=\"lazy\"\`. A page with photos available but no \`<img>\` tags is a failed output." : "No photos available — do not add placeholder images."}

## Constraints
- Semantic HTML5 with proper landmark roles
- WCAG AA accessible (labels, alt text, focus styles, contrast)
- British English throughout (colour, organisation, labour, specialise, centre, programme)
- No medical claims or language that could be construed as medical advice
- No JavaScript. \`<script type="application/ld+json">\` IS permitted on any page — JSON-LD is structured data, not executable code.
- Mobile-first responsive (the CSS handles this)
- Creative, professional, and warm — make this site stand out
- CRITICAL: Do NOT add any inline styles with hardcoded colours. Use var(--colour-primary), var(--colour-accent), etc. from the design system CSS.
- CRITICAL: Do NOT override the design system fonts with different font families.
- CRITICAL: Use existing design-system class names only. Do NOT invent new component class names.`;
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
// Claude invocation + output guards
// ---------------------------------------------------------------------------

interface ClaudePageResult {
  html: string | null;
  error: string | null;
  status: number;
}

interface PageValidationResult {
  valid: boolean;
  issues: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasClass(html: string, className: string): boolean {
  const safeClass = escapeRegExp(className);
  const classRe = new RegExp(`class\\s*=\\s*["'][^"']*\\b${safeClass}\\b[^"']*["']`, "i");
  return classRe.test(html);
}

function validatePageStructure(page: string, html: string): PageValidationResult {
  // Current reliability issue is concentrated on services page styling drift.
  if (page !== "services") {
    return { valid: true, issues: [] };
  }

  const issues: string[] = [];

  if (!/<main\b/i.test(html)) {
    issues.push("missing <main> content container");
  }
  if (!hasClass(html, "section")) {
    issues.push("missing .section class");
  }
  if (!hasClass(html, "section-inner")) {
    issues.push("missing .section-inner class");
  }
  if (!(hasClass(html, "cards") || hasClass(html, "grid") || hasClass(html, "services-grid"))) {
    issues.push("missing card grid class (.cards, .grid, or .services-grid)");
  }
  if (!hasClass(html, "card")) {
    issues.push("missing .card class on service cards");
  }
  if (!hasClass(html, "btn")) {
    issues.push("missing .btn class on at least one CTA");
  }
  if (!/<script\s+type\s*=\s*["']application\/ld\+json["']/i.test(html)) {
    issues.push("missing JSON-LD script block");
  }

  return { valid: issues.length === 0, issues };
}

function enforceDesignSystemCss(html: string, css: string): string {
  const canonicalStyle = `<style>\n${css}\n</style>`;
  const withoutStyleBlocks = html.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");

  if (/<\/head>/i.test(withoutStyleBlocks)) {
    return withoutStyleBlocks.replace(/<\/head>/i, `${canonicalStyle}\n</head>`);
  }

  // Fallback for malformed HTML: prepend CSS so we never deploy an unstyled page.
  return `${canonicalStyle}\n${withoutStyleBlocks}`;
}

function buildUserMessage(
  page: string,
  designSystem: DesignSystemInput,
  mode: "initial" | "repair",
  issues: string[] = [],
): string {
  const repairBlock = mode === "repair"
    ? `
The previous ${page} page draft failed validation:
- ${issues.join("\n- ")}

Regenerate the full page now and follow this class map exactly:
- Layout: .section, .section-inner, .section--alt, .text-center
- Cards: .cards (or .grid), .card, .card--service, .card__image, .card__body, .price
- Actions: .btn, .btn--outline, .card__link

Do not invent alternative class names.
`
    : "";

  return `Generate the ${page} page. Here is the design system to use:

### CSS (inline in <style>):
\`\`\`css
${designSystem.css}
\`\`\`

### Navigation HTML (insert after <body>):
\`\`\`html
${designSystem.nav_html.replace("{{WORDMARK_SVG}}", designSystem.wordmark_svg ?? "")}
\`\`\`

### Footer HTML (insert before </body>):
\`\`\`html
${designSystem.footer_html}
\`\`\`
${repairBlock}
Use the output_page tool to return the complete HTML page.`;
}

async function requestPage(
  page: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  promptConfig?: PromptConfig,
): Promise<ClaudePageResult> {
  const provider: ModelProvider =
    (promptConfig?.model_provider as ModelProvider) ?? "anthropic";
  const model = promptConfig?.model_name ?? DEFAULT_MODEL;
  const effectiveApiKey = promptConfig?.provider_api_key ?? apiKey;
  const maxTokens = promptConfig?.max_tokens ?? DEFAULT_MAX_TOKENS;

  try {
    const response = await callModel({
      provider,
      model,
      apiKey: effectiveApiKey,
      systemPrompt,
      userMessage,
      tools: [OUTPUT_TOOL as ToolDefinition],
      forcedTool: "output_page",
      temperature: promptConfig?.temperature,
      maxTokens,
    });

    if (response.stopReason === "max_tokens") {
      console.error(`[generate-page:${page}] Model hit max_tokens limit`);
      if (!response.toolInput?.html) {
        return {
          html: null,
          error: `Page generation for ${page} was cut short. Please try again.`,
          status: 500,
        };
      }
    }

    if (
      response.toolName !== "output_page" ||
      !response.toolInput ||
      typeof response.toolInput.html !== "string"
    ) {
      console.error(`[generate-page:${page}] No valid tool_use payload in model response`);
      return {
        html: null,
        error: `Failed to generate ${page} page. Please try again.`,
        status: 500,
      };
    }

    return { html: response.toolInput.html as string, error: null, status: 200 };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error(`[generate-page:${page}] Model API call failed:`, detail);
    return {
      html: null,
      error: "The AI service is currently unavailable. Please try again.",
      status: 502,
    };
  }
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

  // Validate prompt_config if provided (A/B testing harness)
  const pcValidation = validatePromptConfig(body.prompt_config);
  if (!pcValidation.valid) {
    return jsonResponse({ error: pcValidation.error! }, 400, cors);
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
  // If prompt_config.system_prompt is provided, resolve its {{variables}} from the spec.
  // Otherwise, use the hardcoded buildSystemPrompt() for production behaviour.
  let systemPrompt: string;
  if (body.prompt_config?.system_prompt) {
    const resolved = resolveSpecForPrompt(spec);
    const variables = buildPageVariables(resolved, spec, body.page);
    systemPrompt = resolveTemplate(body.prompt_config.system_prompt, variables);
  } else {
    systemPrompt = buildSystemPrompt(body.page, spec, body.design_system, body.photos ?? []);
  }

  // 6. Generate page, then enforce structure if needed
  let initialMessage: string;
  if (body.prompt_config?.user_message) {
    const resolved = resolveSpecForPrompt(spec);
    const variables = buildPageVariables(resolved, spec, body.page);
    initialMessage = resolveTemplate(body.prompt_config.user_message, variables);
  } else {
    initialMessage = buildUserMessage(body.page, body.design_system, "initial");
  }

  const initialResult = await requestPage(
    body.page,
    auth!.claudeApiKey,
    systemPrompt,
    initialMessage,
    body.prompt_config,
  );

  if (initialResult.error || !initialResult.html) {
    return jsonResponse(
      { error: initialResult.error ?? `Failed to generate ${body.page} page. Please try again.` },
      initialResult.status,
      cors,
    );
  }

  let generatedHtml = initialResult.html;
  let validation = validatePageStructure(body.page, generatedHtml);

  if (!validation.valid) {
    console.warn(
      `[generate-page:${body.page}] Validation failed; retrying with stricter guidance: ${validation.issues.join("; ")}`,
    );
    const repairMessage = buildUserMessage(body.page, body.design_system, "repair", validation.issues);
    const repairResult = await requestPage(
      body.page,
      auth!.claudeApiKey,
      systemPrompt,
      repairMessage,
      body.prompt_config,
    );

    if (repairResult.error || !repairResult.html) {
      return jsonResponse(
        { error: repairResult.error ?? `Failed to generate ${body.page} page. Please try again.` },
        repairResult.status,
        cors,
      );
    }

    generatedHtml = repairResult.html;
    validation = validatePageStructure(body.page, generatedHtml);

    if (!validation.valid) {
      console.error(
        `[generate-page:${body.page}] Validation failed after retry: ${validation.issues.join("; ")}`,
      );
      return jsonResponse(
        { error: `Failed to generate a fully styled ${body.page} page. Please try again.` },
        500,
        cors,
      );
    }
  }

  // 7. Enforce canonical CSS and sanitise output
  const htmlWithCanonicalCss = enforceDesignSystemCss(generatedHtml, body.design_system.css);
  const { html: sanitisedHtml, stripped } = sanitiseHtml(htmlWithCanonicalCss);
  const filename = PAGE_FILENAMES[body.page] ?? `${body.page}.html`;

  // Log security event if content was stripped
  if (stripped.length > 0) {
    const serviceClient = createServiceClient();
    await serviceClient.from("app_events").insert({
      user_id: auth!.userId,
      event: "sanitiser_blocked_content",
      metadata: { page: body.page, stripped, site_spec_id: body.site_spec_id },
    });
  }

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
