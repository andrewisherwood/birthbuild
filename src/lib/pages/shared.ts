/**
 * Shared HTML generation utilities for static site output.
 * All user-provided text MUST be escaped via escapeHtml() before
 * being inserted into generated HTML (SEC XSS prevention).
 */

import type { SiteSpec, CustomColours, StyleOption, SocialLinks } from "@/types/site-spec";
import { getPaletteColours, TYPOGRAPHY_CONFIG } from "@/lib/palettes";
import {
  findFont,
  buildGoogleFontsUrl,
  SPACING_SCALES,
  BORDER_RADIUS_SCALES,
  TYPOGRAPHY_SCALES,
  type SpacingTokens,
  type BorderRadiusTokens,
  type TypographyScaleTokens,
} from "@/lib/design-tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoData {
  purpose: string;
  publicUrl: string;
  altText: string;
}

// ---------------------------------------------------------------------------
// HTML escaping (critical security function)
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ---------------------------------------------------------------------------
// Social link validation (SEC-018)
// ---------------------------------------------------------------------------

const MAX_SOCIAL_LINK_LENGTH = 500;

export function isValidSocialLink(url: string): boolean {
  return url.startsWith("https://") && url.length <= MAX_SOCIAL_LINK_LENGTH;
}

/**
 * Filter social links to only include valid entries.
 */
export function getValidSocialLinks(links: SocialLinks): Array<{ platform: string; url: string }> {
  const result: Array<{ platform: string; url: string }> = [];
  for (const [platform, url] of Object.entries(links)) {
    if (url && isValidSocialLink(url)) {
      result.push({ platform, url });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Page list for navigation
// ---------------------------------------------------------------------------

interface NavItem {
  slug: string;
  label: string;
  filename: string;
}

export function getNavItems(pages: string[]): NavItem[] {
  const pageConfig: Record<string, { label: string; filename: string }> = {
    home: { label: "Home", filename: "index.html" },
    about: { label: "About", filename: "about.html" },
    services: { label: "Services", filename: "services.html" },
    contact: { label: "Contact", filename: "contact.html" },
    testimonials: { label: "Testimonials", filename: "testimonials.html" },
    faq: { label: "FAQ", filename: "faq.html" },
  };

  return pages
    .map((slug) => {
      const config = pageConfig[slug];
      if (!config) return null;
      return { slug, ...config };
    })
    .filter((item): item is NavItem => item !== null);
}

// ---------------------------------------------------------------------------
// <head> generation
// ---------------------------------------------------------------------------

export function generateHead(
  spec: SiteSpec,
  pageTitle: string,
  pageDescription: string,
): string {
  const escapedTitle = escapeHtml(pageTitle);
  const escapedDescription = escapeHtml(pageDescription);

  let colours: CustomColours;
  let headingFont: string;
  let bodyFont: string;
  let googleFontsUrl: string;
  let designTokens: {
    spacing: SpacingTokens;
    borderRadius: BorderRadiusTokens;
    typographyScale: TypographyScaleTokens;
  } | undefined;

  if (spec.design) {
    // Use advanced design config
    colours = spec.design.colours;
    headingFont = spec.design.typography.headingFont;
    bodyFont = spec.design.typography.bodyFont;
    googleFontsUrl = buildGoogleFontsUrl(headingFont, bodyFont);
    designTokens = {
      spacing: SPACING_SCALES[spec.design.spacing.density],
      borderRadius: BORDER_RADIUS_SCALES[spec.design.borderRadius],
      typographyScale: TYPOGRAPHY_SCALES[spec.design.typography.scale],
    };
  } else {
    // Use base fields
    const typography = TYPOGRAPHY_CONFIG[spec.typography];
    colours = getPaletteColours(spec.palette, spec.custom_colours);
    headingFont = typography.heading;
    bodyFont = typography.body;
    googleFontsUrl = typography.googleFontsUrl;
  }

  const css = generateCss(colours, headingFont, bodyFont, spec.style, designTokens);

  return `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${googleFontsUrl}" rel="stylesheet" />
    <style>${css}</style>
  </head>`;
}

// ---------------------------------------------------------------------------
// Navigation generation
// ---------------------------------------------------------------------------

export function generateNav(
  spec: SiteSpec,
  wordmark: string,
  activePage: string,
): string {
  const navItems = getNavItems(spec.pages);
  const navId = "main-nav";
  const toggleId = "nav-toggle";
  const businessLabel = spec.business_name ? escapeHtml(spec.business_name) : "Home";

  const links = navItems
    .map((item) => {
      const isCurrent = item.slug === activePage;
      return `<a href="${item.filename}" class="nav-link${isCurrent ? " nav-link--active" : ""}" ${isCurrent ? 'aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`;
    })
    .join("\n          ");

  return `<a href="#main" class="skip-link">Skip to content</a>
  <header class="site-header" role="banner">
    <div class="header-inner">
      <a href="index.html" class="wordmark-link" aria-label="${businessLabel}">
        ${wordmark}
      </a>
      <input type="checkbox" id="${toggleId}" class="nav-toggle-checkbox" aria-hidden="true" />
      <label for="${toggleId}" class="nav-toggle-label" aria-label="Open navigation menu">
        <span class="nav-toggle-icon"></span>
      </label>
      <nav id="${navId}" class="main-nav" aria-label="Main navigation">
        <div class="nav-links">
          ${links}
        </div>
      </nav>
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// Footer generation
// ---------------------------------------------------------------------------

export function generateFooter(spec: SiteSpec): string {
  const year = new Date().getFullYear();
  const businessName = spec.business_name ? escapeHtml(spec.business_name) : "This website";

  const validLinks = getValidSocialLinks(spec.social_links);
  const socialHtml =
    validLinks.length > 0
      ? `<div class="footer-social">
          ${validLinks
            .map(
              (link) =>
                `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.platform)}">${escapeHtml(link.platform)}</a>`,
            )
            .join("\n          ")}
        </div>`
      : "";

  return `<footer class="site-footer" role="contentinfo">
    <div class="footer-inner">
      ${socialHtml}
      <p class="footer-copyright">&copy; ${year} ${businessName}. All rights reserved.</p>
      <p class="footer-privacy">This site does not use tracking cookies.</p>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

export function generateCss(
  colours: CustomColours,
  headingFont: string,
  bodyFont: string,
  style: StyleOption,
  designTokens?: {
    spacing: SpacingTokens;
    borderRadius: BorderRadiusTokens;
    typographyScale: TypographyScaleTokens;
  },
): string {
  // Border radius: use design tokens if provided, otherwise derive from style
  const cardRadius = designTokens?.borderRadius.card ?? (style === "modern" ? "8px" : style === "classic" ? "4px" : "2px");
  const btnRadius = designTokens?.borderRadius.button ?? (style === "modern" ? "6px" : style === "classic" ? "4px" : "2px");
  const imgRadius = designTokens?.borderRadius.image ?? cardRadius;

  // Spacing
  const sectionPadding = designTokens?.spacing.sectionPadding ?? "4rem 1.5rem";
  const heroPadding = designTokens?.spacing.heroPadding ?? "5rem 1.5rem";
  const cardPadding = designTokens?.spacing.cardPadding ?? "2rem";
  const gap = designTokens?.spacing.gap ?? "1.5rem";

  // Typography scale
  const h1Size = designTokens?.typographyScale.h1 ?? "2.5rem";
  const h2Size = designTokens?.typographyScale.h2 ?? "2rem";
  const h3Size = designTokens?.typographyScale.h3 ?? "1.25rem";
  const bodySize = designTokens?.typographyScale.body ?? "1rem";
  const taglineSize = designTokens?.typographyScale.tagline ?? "1.2rem";

  // Font category fallback
  const headingFontDef = findFont(headingFont);
  const headingFallback = headingFontDef?.category === "serif" ? "serif" : "sans-serif";
  const bodyFontDef = findFont(bodyFont);
  const bodyFallback = bodyFontDef?.category === "serif" ? "serif" : "sans-serif";

  return `
    :root {
      --colour-bg: ${colours.background};
      --colour-primary: ${colours.primary};
      --colour-accent: ${colours.accent};
      --colour-text: ${colours.text};
      --colour-cta: ${colours.cta};
      --font-heading: '${headingFont}', ${headingFallback};
      --font-body: '${bodyFont}', ${bodyFallback};
      --radius: ${cardRadius};
      --btn-radius: ${btnRadius};
      --img-radius: ${imgRadius};
      --max-width: 1100px;
      --section-padding: ${sectionPadding};
      --hero-padding: ${heroPadding};
      --card-padding: ${cardPadding};
      --gap: ${gap};
      --h1-size: ${h1Size};
      --h2-size: ${h2Size};
      --h3-size: ${h3Size};
      --body-size: ${bodySize};
      --tagline-size: ${taglineSize};
    }

    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font-body);
      color: var(--colour-text);
      background-color: var(--colour-bg);
      font-size: var(--body-size);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading);
      line-height: 1.2;
      color: var(--colour-primary);
    }

    a { color: var(--colour-primary); text-decoration: underline; }
    a:hover { opacity: 0.85; }

    /* Focus-visible styles for keyboard navigation (WCAG 2.4.7) */
    *:focus-visible {
      outline: 2px solid var(--colour-primary);
      outline-offset: 2px;
    }

    img { max-width: 100%; height: auto; display: block; }

    /* Skip link */
    .skip-link {
      position: absolute; left: -9999px; top: auto;
      padding: 0.5rem 1rem; background: var(--colour-primary); color: #fff;
      z-index: 1000; text-decoration: none;
    }
    .skip-link:focus { left: 1rem; top: 1rem; }

    /* Header */
    .site-header {
      background: var(--colour-bg);
      border-bottom: 1px solid var(--colour-accent);
      position: sticky; top: 0; z-index: 100;
    }
    .header-inner {
      max-width: var(--max-width); margin: 0 auto;
      padding: 1rem 1.5rem;
      display: flex; align-items: center; justify-content: space-between;
    }
    .wordmark-link { text-decoration: none; }
    .wordmark-link svg { display: block; }

    /* Mobile nav toggle (CSS-only hamburger) */
    .nav-toggle-checkbox { display: none; }
    .nav-toggle-label {
      display: none; cursor: pointer; padding: 0.5rem;
    }
    .nav-toggle-icon {
      display: block; width: 24px; height: 2px;
      background: var(--colour-text); position: relative;
    }
    .nav-toggle-icon::before, .nav-toggle-icon::after {
      content: ''; display: block; width: 24px; height: 2px;
      background: var(--colour-text); position: absolute; left: 0;
    }
    .nav-toggle-icon::before { top: -7px; }
    .nav-toggle-icon::after { top: 7px; }

    .nav-links { display: flex; gap: var(--gap); align-items: center; }
    .nav-link {
      text-decoration: none; font-weight: 500; font-size: 0.95rem;
      color: var(--colour-text); transition: color 0.2s;
    }
    .nav-link:hover, .nav-link--active { color: var(--colour-primary); }

    @media (max-width: 768px) {
      .nav-toggle-label { display: block; }
      .main-nav {
        display: none; position: absolute; top: 100%; left: 0; right: 0;
        background: var(--colour-bg); border-bottom: 1px solid var(--colour-accent);
        padding: 1rem 1.5rem;
      }
      .nav-toggle-checkbox:checked ~ .main-nav { display: block; }
      .nav-links { flex-direction: column; gap: 0.75rem; }
    }

    /* Sections */
    .section { padding: var(--section-padding); }
    .section-inner { max-width: var(--max-width); margin: 0 auto; }
    .section--alt { background: rgba(0,0,0,0.02); }
    .section-title { font-size: var(--h2-size); margin-bottom: var(--gap); }
    .section-subtitle { font-size: 1.1rem; color: var(--colour-text); opacity: 0.8; margin-bottom: 2rem; }

    /* Hero */
    .hero { padding: var(--hero-padding); text-align: center; }
    .hero-inner { max-width: var(--max-width); margin: 0 auto; }
    .hero h1 { font-size: var(--h1-size); margin-bottom: 1rem; }
    .hero .tagline { font-size: var(--tagline-size); opacity: 0.85; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }

    @media (min-width: 769px) {
      .hero h1 { font-size: calc(var(--h1-size) * 1.4); }
    }

    /* Buttons */
    .btn {
      display: inline-block; padding: 0.75rem 2rem;
      background: var(--colour-cta); color: #fff; text-decoration: none;
      border-radius: var(--btn-radius); font-weight: 600; font-size: var(--body-size);
      border: none; cursor: pointer; transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn--outline {
      background: transparent; color: var(--colour-cta);
      border: 2px solid var(--colour-cta);
    }
    .btn--outline:hover { background: var(--colour-cta); color: #fff; }

    /* Cards */
    .cards { display: grid; gap: var(--gap); }
    @media (min-width: 640px) { .cards { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 900px) { .cards { grid-template-columns: repeat(3, 1fr); } }
    .card {
      background: #fff; border-radius: var(--radius);
      padding: var(--card-padding); border: 1px solid var(--colour-accent);
    }
    .card h3 { margin-bottom: 0.75rem; font-size: var(--h3-size); }
    .card p { margin-bottom: 1rem; }
    .card .price { font-weight: 600; color: var(--colour-primary); margin-bottom: 1rem; display: block; }

    /* Testimonials */
    .testimonial {
      background: #fff; border-left: 4px solid var(--colour-accent);
      padding: var(--card-padding); margin-bottom: var(--gap); border-radius: var(--radius);
    }
    .testimonial blockquote { font-style: italic; font-size: 1.05rem; margin-bottom: 0.75rem; }
    .testimonial cite { font-style: normal; font-weight: 600; display: block; }
    .testimonial .context { font-size: 0.9rem; opacity: 0.7; }

    /* FAQ */
    .faq-item { border-bottom: 1px solid var(--colour-accent); }
    .faq-item summary {
      padding: 1.25rem 0; cursor: pointer; font-weight: 600;
      font-size: 1.05rem; list-style: none;
    }
    .faq-item summary::-webkit-details-marker { display: none; }
    .faq-item summary::before { content: '+'; margin-right: 0.75rem; font-size: 1.2rem; }
    .faq-item[open] summary::before { content: '\\2212'; }
    .faq-item .faq-answer { padding: 0 0 1.25rem; line-height: 1.7; }

    /* Contact form */
    .contact-form { max-width: 600px; }
    .form-group { margin-bottom: var(--gap); }
    .form-group label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
    .form-group input, .form-group textarea {
      width: 100%; padding: 0.75rem; border: 1px solid var(--colour-accent);
      border-radius: var(--radius); font-family: var(--font-body); font-size: var(--body-size);
    }
    .form-group textarea { min-height: 150px; resize: vertical; }
    .form-group input:focus, .form-group textarea:focus {
      outline: 2px solid var(--colour-primary); outline-offset: 2px;
    }

    /* Contact info */
    .contact-info { margin-top: 2rem; }
    .contact-info dt { font-weight: 600; margin-top: 1rem; }
    .contact-info dd { margin-left: 0; }

    /* About page */
    .about-grid { display: grid; gap: 2rem; }
    @media (min-width: 769px) { .about-grid { grid-template-columns: 2fr 1fr; } }
    .about-photo { border-radius: var(--img-radius); width: 100%; object-fit: cover; }
    .qualifications { margin-top: 2rem; padding: var(--card-padding); background: rgba(0,0,0,0.02); border-radius: var(--radius); }

    /* Schema.org JSON-LD does not need styles */

    /* Footer */
    .site-footer {
      background: var(--colour-primary); color: rgba(255,255,255,0.9);
      padding: 2rem 1.5rem; text-align: center;
    }
    .footer-inner { max-width: var(--max-width); margin: 0 auto; }
    .footer-social { margin-bottom: 1rem; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
    .footer-social a { color: rgba(255,255,255,0.9); text-decoration: none; font-weight: 500; }
    .footer-social a:hover { text-decoration: underline; }
    .footer-copyright { font-size: 0.9rem; margin-bottom: 0.25rem; }
    .footer-privacy { font-size: 0.8rem; opacity: 0.7; }

    /* Utility */
    .text-center { text-align: center; }
    .mt-2 { margin-top: 2rem; }
    .mt-3 { margin-top: 3rem; }
    .mb-2 { margin-bottom: 2rem; }
  `;
}
