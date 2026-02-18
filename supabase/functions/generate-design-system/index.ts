/**
 * Edge Function: generate-design-system
 *
 * Generates the shared CSS, navigation HTML, and footer HTML from a SiteSpec.
 * This is the "creative vision" call — it establishes the site's visual identity.
 *
 * Input:  { site_spec_id }
 * Output: { css, nav_html, footer_html, wordmark_svg }
 */

import {
  corsHeaders,
  isRateLimited,
  authenticateAndGetApiKey,
  createServiceClient,
  checkBodySize,
  jsonResponse,
} from "../_shared/edge-helpers.ts";
import { sanitiseHtml, sanitiseCss } from "../_shared/sanitise-html.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Palette definitions (duplicated from client — Edge Functions can't import src/)
// ---------------------------------------------------------------------------

interface PaletteColours {
  background: string;
  primary: string;
  accent: string;
  text: string;
  cta: string;
}

const PALETTES: Record<string, PaletteColours> = {
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

// ---------------------------------------------------------------------------
// Spec resolution helpers
// ---------------------------------------------------------------------------

interface ResolvedSpec {
  businessName: string;
  doulaName: string;
  tagline: string;
  serviceArea: string;
  style: string;
  colours: PaletteColours;
  headingFont: string;
  bodyFont: string;
  pages: string[];
  socialLinks: Array<{ platform: string; url: string }>;
  spacingDensity: string;
  borderRadius: string;
  typographyScale: string;
  brandFeeling: string;
  year: number;
}

// deno-lint-ignore no-explicit-any
function resolveSpec(spec: any): ResolvedSpec {
  let colours: PaletteColours;
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
    colours = valid ? cc : PALETTES["sage_sand"]!;
    const typo = TYPOGRAPHY_PRESETS[spec.typography] ?? TYPOGRAPHY_PRESETS["modern"]!;
    headingFont = spec.font_heading ?? typo.heading;
    bodyFont = spec.font_body ?? typo.body;
  } else {
    colours = PALETTES[spec.palette] ?? PALETTES["sage_sand"]!;
    const typo = TYPOGRAPHY_PRESETS[spec.typography] ?? TYPOGRAPHY_PRESETS["modern"]!;
    headingFont = spec.font_heading ?? typo.heading;
    bodyFont = spec.font_body ?? typo.body;
  }

  // Validate social links (SEC-018)
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
// Wordmark SVG generation (mirrors src/lib/wordmark.ts)
// ---------------------------------------------------------------------------

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateWordmark(
  businessName: string,
  fontFamily: string,
  primaryColour: string,
  style: string,
): string {
  const escaped = xmlEscape(businessName);
  const titleText = xmlEscape(businessName);
  const estimatedWidth = Math.max(200, businessName.length * 16 + 40);
  const height = style === "classic" ? 60 : 48;
  const fontWeight = style === "minimal" ? "300" : "600";
  const fontSize = style === "minimal" ? "24" : "28";
  const letterSpacing = style === "modern" ? "0.5" : style === "minimal" ? "2" : "0";
  const textY = style === "classic" ? "30" : "32";
  const divider =
    style === "classic"
      ? `<line x1="${estimatedWidth * 0.3}" y1="46" x2="${estimatedWidth * 0.7}" y2="46" stroke="${primaryColour}" stroke-width="1" opacity="0.6" />`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${estimatedWidth} ${height}" role="img" aria-labelledby="wordmark-title" width="${estimatedWidth}" height="${height}"><title id="wordmark-title">${titleText}</title><text x="50%" y="${textY}" text-anchor="middle" font-family="'${fontFamily}', sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}" fill="${primaryColour}">${escaped}</text>${divider}</svg>`;
}

// ---------------------------------------------------------------------------
// System prompt (SEC-009: hardcoded, never accepted from client)
// ---------------------------------------------------------------------------

function buildSystemPrompt(resolved: ResolvedSpec): string {
  const pageList = resolved.pages
    .map((p) => {
      const filenames: Record<string, string> = {
        home: "index.html",
        about: "about.html",
        services: "services.html",
        contact: "contact.html",
        testimonials: "testimonials.html",
        faq: "faq.html",
      };
      return `${p} (${filenames[p] ?? p + ".html"})`;
    })
    .join(", ");

  const socialLinksDesc =
    resolved.socialLinks.length > 0
      ? resolved.socialLinks.map((l) => `${l.platform}: ${l.url}`).join(", ")
      : "none provided";

  return `You are a senior web designer generating a complete CSS design system, navigation header, and footer for a birth worker's professional website.

## Site Identity
- Business name: "${resolved.businessName}"
- Doula/birth worker name: "${resolved.doulaName}"
- Tagline: "${resolved.tagline}"
- Service area: "${resolved.serviceArea}"
- Style preference: ${resolved.style}${resolved.brandFeeling ? `\n- Brand feeling: "${resolved.brandFeeling}" — use this as creative direction for the overall aesthetic. Let it influence spacing, shadow depth, gradient warmth, and decorative elements.` : ""}

## Colour Palette (use these exact hex values as CSS custom properties)
- Background: ${resolved.colours.background}
- Primary: ${resolved.colours.primary}
- Accent: ${resolved.colours.accent}
- Text: ${resolved.colours.text}
- CTA: ${resolved.colours.cta}

## Typography
- Heading font: ${resolved.headingFont}
- Body font: ${resolved.bodyFont}
- Typography scale: ${resolved.typographyScale}

## Spacing & Shape
- Spacing density: ${resolved.spacingDensity}
- Border radius: ${resolved.borderRadius}

## Navigation Pages
${pageList}

## Social Links
${socialLinksDesc}

## Requirements

### CSS Design System
Generate a complete CSS stylesheet with:
1. \`:root\` block with CSS custom properties: --colour-bg, --colour-primary, --colour-accent, --colour-text, --colour-cta, --font-heading, --font-body, --radius, --btn-radius, --img-radius, --max-width (1100px), --section-padding, --hero-padding, --card-padding, --gap, --h1-size, --h2-size, --h3-size, --body-size, --tagline-size
2. CSS reset (box-sizing, margin, padding, smooth scroll)
3. Body styles (font-family, colour, background, line-height 1.7, antialiased)
4. Heading styles (h1-h6 using heading font, primary colour)
5. Link styles with hover effects
6. Focus-visible outlines (2px solid primary, 2px offset) for keyboard navigation (WCAG 2.4.7)
7. Image styles (max-width 100%, height auto, display block)
8. Skip link styles (off-screen, visible on focus)
9. Header/nav styles (sticky, border-bottom, flex layout)
10. CSS-only hamburger menu for mobile (checkbox hack, no JavaScript)
11. Section styles (.section, .section-inner with max-width, .section--alt)
12. Hero styles (centred text, scaled heading)
13. Button styles (.btn primary CTA, .btn--outline variant)
14. Card grid (responsive 1/2/3 columns with gap)
15. Testimonial styles (border-left accent, blockquote italic)
16. FAQ styles (details/summary, no default marker, +/- icons)
17. Contact form styles (form groups, labels, inputs, textareas, focus states)
18. Footer styles (primary bg, white text, social links row, copyright)
19. Utility classes (.text-center, .mt-2, .mt-3, .mb-2)
20. Responsive breakpoints at 640px, 768px, 900px
21. Be creative with your design while respecting the colour palette and style preference. Add subtle transitions, shadows, gradients, or decorative elements that match the ${resolved.style} aesthetic.

### Navigation HTML
Generate a semantic \`<header>\` element with:
1. A skip link: \`<a href="#main" class="skip-link">Skip to content</a>\`
2. A wordmark link to index.html (use placeholder \`{{WORDMARK_SVG}}\` where the SVG goes)
3. CSS-only hamburger toggle (checkbox + label, no JavaScript)
4. \`<nav>\` with links to each page, using class "nav-link"
5. Active page link gets class "nav-link--active" and aria-current="page" — use \`{{ACTIVE_PAGE}}\` placeholder
6. The nav output must work with the CSS you generate

### Footer HTML
Generate a semantic \`<footer>\` element with:
1. Social media links (if provided) in a flex row
2. Copyright line: "&copy; ${resolved.year} ${resolved.businessName}. All rights reserved."
3. Privacy note: "This site does not use tracking cookies."

## Constraints
- WCAG AA compliant (4.5:1 contrast ratio for text)
- Mobile-first responsive design
- British English throughout
- No JavaScript whatsoever
- Use the exact colour hex values provided — do not alter them
- The CSS must be self-contained (no external dependencies except Google Fonts)`;
}

// ---------------------------------------------------------------------------
// Tool definition (SEC-010: hardcoded)
// ---------------------------------------------------------------------------

const OUTPUT_TOOL = {
  name: "output_design_system",
  description: "Output the generated design system CSS, navigation HTML, and footer HTML.",
  input_schema: {
    type: "object",
    properties: {
      css: {
        type: "string",
        description: "Complete CSS stylesheet for the site design system.",
      },
      nav_html: {
        type: "string",
        description: "Semantic HTML for the site header/navigation, including skip link.",
      },
      footer_html: {
        type: "string",
        description: "Semantic HTML for the site footer.",
      },
    },
    required: ["css", "nav_html", "footer_html"],
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
  if (await isRateLimited("generate-design-system", auth!.userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse(
      { error: "Too many design system generation requests. Please wait and try again." },
      429,
      cors,
    );
  }

  // 3. Parse body
  const sizeErr = checkBodySize(req, cors);
  if (sizeErr) return sizeErr;

  let body: { site_spec_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, cors);
  }

  if (!body.site_spec_id || !UUID_RE.test(body.site_spec_id)) {
    return jsonResponse({ error: "Missing or invalid site_spec_id." }, 400, cors);
  }

  // 4. Fetch spec via service role (bypasses RLS for full access)
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

  // 5. Resolve design tokens from spec
  const resolved = resolveSpec(spec);

  // 6. Generate wordmark SVG
  const wordmarkSvg = generateWordmark(
    resolved.businessName,
    resolved.headingFont,
    resolved.colours.primary,
    resolved.style,
  );

  // 7. Call Claude API
  const systemPrompt = buildSystemPrompt(resolved);

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
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "Generate the complete CSS design system, navigation header HTML, and footer HTML for this birth worker's website. Use the output_design_system tool to return your work.",
          },
        ],
        tools: [OUTPUT_TOOL],
        tool_choice: { type: "tool", name: "output_design_system" },
      }),
    });
  } catch (fetchError: unknown) {
    const detail = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
    console.error("[generate-design-system] Claude API fetch failed:", detail);
    return jsonResponse(
      { error: "The AI service is currently unavailable. Please try again." },
      502,
      cors,
    );
  }

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    console.error(
      `[generate-design-system] Claude API error (HTTP ${claudeResponse.status}):`,
      errorText,
    );
    return jsonResponse(
      { error: "The AI service returned an error. Please try again." },
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
    console.error("[generate-design-system] Failed to parse Claude response:", detail);
    return jsonResponse(
      { error: "Failed to generate design system. Please try again." },
      500,
      cors,
    );
  }

  if (claudeData.stop_reason === "max_tokens") {
    console.error("[generate-design-system] Claude hit max_tokens limit");
  }

  const toolUse = claudeData.content?.find(
    // deno-lint-ignore no-explicit-any
    (block: any) => block.type === "tool_use" && block.name === "output_design_system",
  );

  if (!toolUse?.input) {
    console.error("[generate-design-system] No tool_use block in Claude response");
    return jsonResponse(
      { error: "Failed to generate design system. Please try again." },
      500,
      cors,
    );
  }

  const { css, nav_html, footer_html } = toolUse.input as {
    css: string;
    nav_html: string;
    footer_html: string;
  };

  // 8. Sanitise output
  const sanitisedCss = sanitiseCss(css);
  const sanitisedNavHtml = sanitiseHtml(nav_html);
  const sanitisedFooterHtml = sanitiseHtml(footer_html);

  return jsonResponse(
    {
      success: true,
      css: sanitisedCss,
      nav_html: sanitisedNavHtml,
      footer_html: sanitisedFooterHtml,
      wordmark_svg: wordmarkSvg,
    },
    200,
    cors,
  );
});
