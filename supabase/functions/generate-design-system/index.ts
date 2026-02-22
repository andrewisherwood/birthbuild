/**
 * Edge Function: generate-design-system
 *
 * Generates the shared CSS, navigation HTML, and footer HTML from a SiteSpec.
 * This is the "creative vision" call — it establishes the site's visual identity.
 *
 * Input:  { site_spec_id, repair_issues? }
 * Output: { css, nav_html, footer_html, wordmark_svg, validation_issues }
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
import { callModel, type ToolDefinition } from "../_shared/model-client.ts";
import {
  resolveTemplate,
  buildDesignSystemVariables,
} from "../_shared/prompt-resolver.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_PROVIDERS = ["anthropic", "openai"] as const;
type ModelProvider = typeof VALID_PROVIDERS[number];

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 8192;

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

// ---------------------------------------------------------------------------
// Palette definitions (duplicated from client — Edge Functions can't import src/)
// ---------------------------------------------------------------------------

interface PaletteColours {
  background: string;
  primary: string;
  accent: string;
  text: string;
  cta: string;
  background_description?: string;
  primary_description?: string;
  accent_description?: string;
  text_description?: string;
  cta_description?: string;
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
    colours = valid
      ? {
          background: cc.background,
          primary: cc.primary,
          accent: cc.accent,
          text: cc.text,
          cta: cc.cta,
          background_description: cc.background_description,
          primary_description: cc.primary_description,
          accent_description: cc.accent_description,
          text_description: cc.text_description,
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

  // Build colour description comments for custom palettes
  const colourComment = (hex: string, desc?: string) =>
    desc ? `${hex}  /* Client described as: "${desc}" */` : hex;

  return `You are a senior web designer generating a complete CSS design system, navigation header, and footer for a birth worker's professional website.

## MANDATORY DESIGN SYSTEM — NON-NEGOTIABLE

The following colours and fonts are the client's confirmed brand identity. They may be used on business cards, Instagram, and printed materials. Using different colours or fonts would damage their professional credibility. You MUST use these EXACT values.

### Colour Palette (use these EXACT hex values — do NOT modify, "improve", or substitute)
- Background: ${colourComment(resolved.colours.background, resolved.colours.background_description)}
- Primary: ${colourComment(resolved.colours.primary, resolved.colours.primary_description)}
- Accent: ${colourComment(resolved.colours.accent, resolved.colours.accent_description)}
- Text: ${colourComment(resolved.colours.text, resolved.colours.text_description)}
- CTA: ${colourComment(resolved.colours.cta, resolved.colours.cta_description)}

COLOUR RULES:
1. Your :root CSS variables MUST use these exact hex values. Copy them character-for-character.
2. ALL colour references in your CSS must use var(--colour-*) variables. Never hardcode hex values in component styles.
3. Do NOT use sage green, olive, muted earth tones, or any "default doula" palette unless those are the actual values above.
4. Do NOT drift toward generic colour schemes. If the primary is terracotta, the site must look terracotta, not sage.

### Typography (use these EXACT font names)
- Heading font: ${resolved.headingFont}
- Body font: ${resolved.bodyFont}
- Typography scale: ${resolved.typographyScale}

FONT RULES:
1. ALL heading elements (h1-h6) must use '${resolved.headingFont}'.
2. ALL body text must use '${resolved.bodyFont}'.
3. Do NOT substitute DM Serif Display, Playfair Display, Cormorant, or any other font unless it is the exact font named above.
4. The Google Fonts <link> must load the exact fonts specified.

## Site Identity
- Business name: "${resolved.businessName}"
- Doula/birth worker name: "${resolved.doulaName}"
- Tagline: "${resolved.tagline}"
- Service area: "${resolved.serviceArea}"
- Style preference: ${resolved.style}${resolved.brandFeeling ? `\n- Brand feeling: "${resolved.brandFeeling}" — use this as creative direction for the overall aesthetic. Let it influence spacing, shadow depth, gradient warmth, and decorative elements. But NEVER let it override the colour palette or fonts above.` : ""}

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
12. Hero styles — the hero uses a layered z-index stack inside a relative container. You MUST define all of these selectors:
    - \`.hero\` — position: relative; min-height: 85vh; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; color: white
    - \`.hero__bg\` — position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0 (this is the \`<img>\` element)
    - \`.hero__overlay\` — position: absolute; inset: 0; z-index: 1; background: linear-gradient using primary colour at ~0.85 opacity blending to accent at ~0.75 opacity (for text readability over the photo)
    - \`.hero__content\` — position: relative; z-index: 2; max-width: 800px; padding: var(--hero-padding)
    - \`.hero h1\` — color: white; text-shadow for readability
    - \`.hero__tagline\` — tagline-size font, white with slight transparency
    - \`.btn--hero\` — white background, primary-coloured text, box-shadow, hover inverts to CTA bg with white text
    - \`.hero--text-only\` — fallback for sites without a hero image (gradient background, lower min-height)
    - \`.hero--inner\` — shorter hero for inner pages (about, services, etc.): min-height: 50vh instead of 85vh
13. About/bio page layout styles:
    - \`.about-content\` — display: grid; grid-template-columns: 1fr on mobile, 350px 1fr at ≥768px; gap: 3rem; align-items: start
    - \`.headshot\` — max-width: 400px; width: 100%; border-radius: var(--img-radius); object-fit: cover
    - \`.bio-text blockquote\` — border-left: 3px solid var(--colour-accent); padding-left: 1.5rem; margin: 2rem 0; font-style: italic
14. Button styles (.btn primary CTA, .btn--outline variant)
15. Card grid (responsive 1/2/3 columns with gap) plus .card--service variant (no padding, flex column, overflow hidden) with .card__image (200px height, object-fit cover, scale hover), .card__body (padded), .card__link (CTA-coloured arrow link)
16. Testimonial styles (border-left accent, blockquote italic)
17. FAQ styles (details/summary, no default marker, +/- icons)
18. Contact form styles (form groups, labels, inputs, textareas, focus states)
19. Footer styles (primary bg, white text, social links row, copyright)
20. Utility classes (.text-center, .mt-2, .mt-3, .mb-2)
21. Responsive breakpoints at 640px, 768px, 900px
22. Be creative with your design while respecting the colour palette and style preference. Add subtle transitions, shadows, gradients, or decorative elements that match the ${resolved.style} aesthetic.

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
1. Social media links using inline SVG icons (never text labels). Style as 44×44px circular buttons with rgba(255,255,255,0.1) background, hover rgba(255,255,255,0.25) with translateY(-2px). Include aria-label on each \`<a>\`, aria-hidden="true" on each SVG.
2. Copyright line: "&copy; ${resolved.year} ${resolved.businessName}. All rights reserved."
3. Privacy note: "This site does not use tracking cookies."

### Social Icon SVG Reference
Use these exact SVG paths for social icons (viewBox="0 0 24 24", width/height 20, fill="currentColor"):
- Facebook: \`<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>\`
- Instagram: \`<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>\`
- TikTok: \`<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>\`
- LinkedIn: \`<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>\`
- X/Twitter: \`<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>\`

## Constraints
- WCAG AA compliant (4.5:1 contrast ratio for text)
- Mobile-first responsive design
- British English throughout
- No JavaScript whatsoever
- CRITICAL: Use the EXACT colour hex values from the MANDATORY DESIGN SYSTEM section. Do not alter, adjust, or "improve" them. Do not substitute with similar colours. Copy them character-for-character into your :root block.
- CRITICAL: Use the EXACT font names from the MANDATORY DESIGN SYSTEM section. Do not substitute with similar fonts.
- The CSS must be self-contained (no external dependencies except Google Fonts)
- Do NOT use @import in the CSS. Google Fonts are loaded via a <link> tag in the HTML <head>, not via CSS @import.
- If you find yourself reaching for sage green (#5f7161), cream (#f5f0e8), or DM Serif Display — STOP and check the MANDATORY DESIGN SYSTEM section. Those are defaults, not what this client wants.`;
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
// Output validation + Claude request helpers
// ---------------------------------------------------------------------------

const MIN_CSS_CHARS = 1800;
const REQUIRED_CSS_VARS = [
  "colour-bg",
  "colour-primary",
  "colour-accent",
  "colour-text",
  "colour-cta",
  "font-heading",
  "font-body",
  "max-width",
  "section-padding",
  "h1-size",
  "body-size",
];
const REQUIRED_CSS_SELECTORS = [
  "body",
  "h1",
  ".skip-link",
  ".nav-link",
  ".nav-link--active",
  ".section",
  ".section-inner",
  ".section--alt",
  ".hero",
  ".hero__bg",
  ".hero__overlay",
  ".hero__content",
  ".hero--inner",
  ".about-content",
  ".headshot",
  ".btn",
  ".btn--outline",
  ".cards",
  ".card",
  ".card--service",
  ".card__image",
  ".card__body",
  ".card__link",
  ".price",
];

interface DesignSystemPayload {
  css: string;
  nav_html: string;
  footer_html: string;
}

interface ClaudeDesignSystemResult {
  payload: DesignSystemPayload | null;
  error: string | null;
  status: number;
  stopReason: string | null;
}

interface DesignSystemValidationResult {
  valid: boolean;
  issues: string[];
}

interface SanitisedDesignSystemResult {
  payload: DesignSystemPayload;
  stripped: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCssVar(css: string, variableName: string): boolean {
  const varRe = new RegExp(`--${escapeRegExp(variableName)}\\s*:`, "i");
  return varRe.test(css);
}

function hasCssSelector(css: string, selector: string): boolean {
  const escaped = escapeRegExp(selector);
  // Selector token with strict boundaries to avoid ".btn" matching ".btn--outline".
  const selectorRe = new RegExp(`(^|[^-_a-zA-Z0-9])${escaped}(?![-_a-zA-Z0-9])`, "m");
  return selectorRe.test(css);
}

function validateDesignSystemOutput(payload: DesignSystemPayload): DesignSystemValidationResult {
  const issues: string[] = [];
  const css = payload.css;
  const nav = payload.nav_html;
  const footer = payload.footer_html;

  if (css.trim().length < MIN_CSS_CHARS) {
    issues.push(`CSS output too short (${css.trim().length} chars).`);
  }

  for (const variableName of REQUIRED_CSS_VARS) {
    if (!hasCssVar(css, variableName)) {
      issues.push(`Missing CSS variable --${variableName}.`);
    }
  }

  for (const selector of REQUIRED_CSS_SELECTORS) {
    if (!hasCssSelector(css, selector)) {
      issues.push(`Missing CSS selector ${selector}.`);
    }
  }

  if (!/<header\b/i.test(nav)) issues.push("Navigation markup missing <header>.");
  if (!/<nav\b/i.test(nav)) issues.push("Navigation markup missing <nav>.");
  if (!/\bskip-link\b/.test(nav)) issues.push("Navigation markup missing .skip-link.");
  if (!/\bnav-link\b/.test(nav)) issues.push("Navigation markup missing .nav-link.");
  if (!/\{\{WORDMARK_SVG\}\}/.test(nav)) issues.push("Navigation markup missing {{WORDMARK_SVG}} placeholder.");
  if (!/\{\{ACTIVE_PAGE\}\}/.test(nav)) issues.push("Navigation markup missing {{ACTIVE_PAGE}} placeholder.");

  if (!/<footer\b/i.test(footer)) issues.push("Footer markup missing <footer>.");
  if (!/tracking cookies/i.test(footer)) issues.push("Footer markup missing privacy note.");
  if (!/(?:&copy;|&#169;|copyright)/i.test(footer)) issues.push("Footer markup missing copyright line.");

  return { valid: issues.length === 0, issues };
}

function sanitiseDesignSystemOutput(payload: DesignSystemPayload): SanitisedDesignSystemResult {
  const { css: sanitisedCss, stripped: cssStripped } = sanitiseCss(payload.css);
  const { html: sanitisedNavHtml, stripped: navStripped } = sanitiseHtml(payload.nav_html);
  const { html: sanitisedFooterHtml, stripped: footerStripped } = sanitiseHtml(payload.footer_html);

  return {
    payload: {
      css: sanitisedCss,
      nav_html: sanitisedNavHtml,
      footer_html: sanitisedFooterHtml,
    },
    stripped: [...cssStripped, ...navStripped, ...footerStripped],
  };
}

function buildRepairPrompt(issues: string[]): string {
  return `Your previous output failed server validation and cannot be used.

Validation issues:
- ${issues.join("\n- ")}

Regenerate the complete design system from scratch now.
Requirements:
1. Return full css, nav_html, and footer_html via output_design_system.
2. Include ALL required variables and selectors exactly as requested in the system prompt.
3. Do not omit nav placeholders {{WORDMARK_SVG}} and {{ACTIVE_PAGE}}.
4. Do not shorten the CSS. Return the complete stylesheet.`;
}

async function requestDesignSystem(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  promptConfig?: PromptConfig,
): Promise<ClaudeDesignSystemResult> {
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
      forcedTool: "output_design_system",
      temperature: promptConfig?.temperature,
      maxTokens,
    });

    if (response.stopReason === "max_tokens") {
      console.error("[generate-design-system] Model hit max_tokens limit");
    }

    if (
      response.toolName !== "output_design_system" ||
      !response.toolInput
    ) {
      console.error("[generate-design-system] No valid tool_use payload in model response");
      return {
        payload: null,
        error: "Failed to generate design system. Please try again.",
        status: 500,
        stopReason: response.stopReason,
      };
    }

    const input = response.toolInput;
    if (
      typeof input.css !== "string" ||
      typeof input.nav_html !== "string" ||
      typeof input.footer_html !== "string"
    ) {
      console.error("[generate-design-system] Tool payload missing required fields");
      return {
        payload: null,
        error: "Failed to generate design system. Please try again.",
        status: 500,
        stopReason: response.stopReason,
      };
    }

    return {
      payload: {
        css: input.css,
        nav_html: input.nav_html,
        footer_html: input.footer_html,
      },
      error: null,
      status: 200,
      stopReason: response.stopReason,
    };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-design-system] Model API call failed:", detail);
    return {
      payload: null,
      error: "The AI service is currently unavailable. Please try again.",
      status: 502,
      stopReason: null,
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

  let body: { site_spec_id?: string; repair_issues?: string[]; prompt_config?: PromptConfig };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, cors);
  }

  if (!body.site_spec_id || !UUID_RE.test(body.site_spec_id)) {
    return jsonResponse({ error: "Missing or invalid site_spec_id." }, 400, cors);
  }

  // Validate repair_issues if provided
  if (body.repair_issues !== undefined) {
    if (
      !Array.isArray(body.repair_issues) ||
      body.repair_issues.length > 50 ||
      !body.repair_issues.every((item: unknown) => typeof item === "string")
    ) {
      return jsonResponse({ error: "repair_issues must be an array of up to 50 strings." }, 400, cors);
    }
  }

  // Validate prompt_config if provided (A/B testing harness)
  const pcValidation = validatePromptConfig(body.prompt_config);
  if (!pcValidation.valid) {
    return jsonResponse({ error: pcValidation.error! }, 400, cors);
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

  // 7. Call model (single pass — client handles retry with repair_issues)
  // If prompt_config.system_prompt is provided, resolve its {{variables}} from the spec.
  // Otherwise, use the hardcoded buildSystemPrompt() for production behaviour.
  let systemPrompt: string;
  if (body.prompt_config?.system_prompt) {
    const variables = buildDesignSystemVariables(resolved);
    systemPrompt = resolveTemplate(body.prompt_config.system_prompt, variables);
  } else {
    systemPrompt = buildSystemPrompt(resolved);
  }

  let userMessage: string;
  if (body.prompt_config?.user_message) {
    const variables = buildDesignSystemVariables(resolved);
    userMessage = resolveTemplate(body.prompt_config.user_message, variables);
  } else if (body.repair_issues && body.repair_issues.length > 0) {
    userMessage = buildRepairPrompt(body.repair_issues);
  } else {
    userMessage = "Generate the complete CSS design system, navigation header HTML, and footer HTML for this birth worker's website. Use the output_design_system tool to return your work.";
  }

  const result = await requestDesignSystem(
    auth!.claudeApiKey,
    systemPrompt,
    userMessage,
    body.prompt_config,
  );

  if (result.error || !result.payload) {
    return jsonResponse(
      { error: result.error ?? "Failed to generate design system. Please try again." },
      result.status,
      cors,
    );
  }

  const sanitisedResult = sanitiseDesignSystemOutput(result.payload);
  let validation = validateDesignSystemOutput(sanitisedResult.payload);
  if (result.stopReason === "max_tokens") {
    validation = {
      valid: false,
      issues: ["Model response hit max_tokens (possible truncation).", ...validation.issues],
    };
  }

  if (!validation.valid) {
    console.warn(
      `[generate-design-system] Validation issues (${validation.issues.length}): ${validation.issues.join("; ")}`,
    );
  }

  // 8. Log sanitiser events (if any)
  if (sanitisedResult.stripped.length > 0) {
    await serviceClient.from("app_events").insert({
      user_id: auth!.userId,
      event: "sanitiser_blocked_content",
      metadata: { component: "design-system", stripped: sanitisedResult.stripped },
    });
  }

  return jsonResponse(
    {
      success: true,
      css: sanitisedResult.payload.css,
      nav_html: sanitisedResult.payload.nav_html,
      footer_html: sanitisedResult.payload.footer_html,
      wordmark_svg: wordmarkSvg,
      validation_issues: validation.valid ? [] : validation.issues,
    },
    200,
    cors,
  );
});
