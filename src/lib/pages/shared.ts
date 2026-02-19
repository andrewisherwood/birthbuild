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

  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' https://*.supabase.co data:",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  return `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
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
// Social icon SVGs
// ---------------------------------------------------------------------------

const SOCIAL_ICONS: Record<string, string> = {
  facebook: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  instagram: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  tiktok: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  linkedin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  twitter: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
};

function socialIconSvg(platform: string): string {
  return SOCIAL_ICONS[platform.toLowerCase()] ??
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1 17.5v-7l6 3.5-6 3.5z"/></svg>`;
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
                `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.platform)}">${socialIconSvg(link.platform)}</a>`,
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

    /* Hero (image overlay) */
    .hero {
      position: relative; min-height: 85vh;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .hero__bg {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; z-index: 0;
    }
    .hero__overlay {
      position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.15));
    }
    .hero__content {
      position: relative; z-index: 2; text-align: center;
      padding: 2rem 1.5rem; max-width: var(--max-width);
    }
    .hero__content h1 { font-size: var(--h1-size); margin-bottom: 1rem; color: #fff; }
    .hero__tagline {
      font-size: var(--tagline-size); color: #fff; font-weight: 300;
      margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto;
    }
    .btn--hero {
      background: var(--colour-cta); color: #fff; padding: 0.85rem 2.5rem;
      font-size: 1.05rem; border-radius: var(--btn-radius); font-weight: 600;
      text-decoration: none; display: inline-block;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25); transition: background 0.2s, color 0.2s, transform 0.2s;
    }
    .btn--hero:hover { background: #fff; color: var(--colour-cta); transform: translateY(-1px); opacity: 1; }

    @media (max-width: 768px) {
      .hero { min-height: 70vh; }
    }
    @media (min-width: 769px) {
      .hero__content h1 { font-size: calc(var(--h1-size) * 1.4); }
    }

    /* Hero (text-only fallback) */
    .hero--text-only { padding: var(--hero-padding); text-align: center; min-height: auto; display: block; }
    .hero--text-only .hero-inner { max-width: var(--max-width); margin: 0 auto; }
    .hero--text-only h1 { font-size: var(--h1-size); margin-bottom: 1rem; }
    .hero--text-only .tagline { font-size: var(--tagline-size); opacity: 0.85; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }
    @media (min-width: 769px) {
      .hero--text-only h1 { font-size: calc(var(--h1-size) * 1.4); }
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

    /* Service cards with images */
    .card--service { display: flex; flex-direction: column; overflow: hidden; padding: 0; }
    .card__image { height: 200px; overflow: hidden; }
    .card__image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
    .card--service:hover .card__image img { transform: scale(1.05); }
    .card__body { padding: var(--card-padding); }
    .card__link {
      color: var(--colour-cta); text-decoration: none; font-weight: 600;
      display: inline-block; margin-top: 0.5rem; transition: color 0.2s;
    }
    .card__link:hover { opacity: 0.85; }

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
    .about-photo { border-radius: var(--img-radius); width: 100%; max-height: 28rem; object-fit: cover; object-position: center top; }
    @media (max-width: 768px) { .about-photo { max-height: 20rem; aspect-ratio: 4/3; } }
    .qualifications { margin-top: 2rem; padding: var(--card-padding); background: rgba(0,0,0,0.02); border-radius: var(--radius); }

    /* Schema.org JSON-LD does not need styles */

    /* Footer */
    .site-footer {
      background: var(--colour-primary); color: rgba(255,255,255,0.9);
      padding: 2rem 1.5rem; text-align: center;
    }
    .footer-inner { max-width: var(--max-width); margin: 0 auto; }
    .footer-social { margin-bottom: 1.5rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; }
    .footer-social a {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      text-decoration: none; transition: background 0.2s, transform 0.2s;
    }
    .footer-social a:hover { background: rgba(255,255,255,0.25); transform: translateY(-2px); opacity: 1; }
    .footer-copyright { font-size: 0.9rem; margin-bottom: 0.25rem; }
    .footer-privacy { font-size: 0.8rem; opacity: 0.7; }

    /* Utility */
    .text-center { text-align: center; }
    .mt-2 { margin-top: 2rem; }
    .mt-3 { margin-top: 3rem; }
    .mb-2 { margin-bottom: 2rem; }
  `;
}
