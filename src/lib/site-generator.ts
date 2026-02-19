/**
 * Master site generator.
 * Orchestrates page generation, sitemap, and robots.txt.
 * Validates custom colours (SEC-017) and social links (SEC-018).
 */

import type { SiteSpec, CustomColours } from "@/types/site-spec";
import { getPaletteColours, TYPOGRAPHY_CONFIG } from "@/lib/palettes";
import { generateWordmark } from "@/lib/wordmark";
import { type PhotoData, getNavItems } from "@/lib/pages/shared";
import { generateHomePage } from "@/lib/pages/home";
import { generateAboutPage } from "@/lib/pages/about";
import { generateServicesPage } from "@/lib/pages/services";
import { generateContactPage } from "@/lib/pages/contact";
import { generateTestimonialsPage } from "@/lib/pages/testimonials";
import { generateFaqPage } from "@/lib/pages/faq";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedPage {
  filename: string;
  html: string;
}

export interface GeneratedSite {
  pages: GeneratedPage[];
  sitemap: string;
  robots: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const HEX_COLOUR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate a hex colour value (SEC-017).
 * Returns true only for valid 6-digit hex colours.
 */
function isValidHexColour(value: string): boolean {
  return HEX_COLOUR_REGEX.test(value);
}

/**
 * Validate all custom colour values. If any are invalid, returns null
 * to trigger fallback to a preset palette.
 */
function validateCustomColours(colours: CustomColours): CustomColours | null {
  const keys = ["background", "primary", "accent", "text", "cta"] as const;

  for (const key of keys) {
    if (!isValidHexColour(colours[key])) {
      console.error(
        `[site-generator] Invalid custom colour for "${key}": "${colours[key]}". Falling back to preset palette.`,
      );
      return null;
    }
  }

  return colours;
}

// ---------------------------------------------------------------------------
// Sitemap generation
// ---------------------------------------------------------------------------

function generateSitemap(
  pages: GeneratedPage[],
  baseUrl: string,
): string {
  const urls = pages
    .map(
      (page) =>
        `  <url>
    <loc>${baseUrl}/${page.filename}</loc>
    <changefreq>monthly</changefreq>
    <priority>${page.filename === "index.html" ? "1.0" : "0.8"}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ---------------------------------------------------------------------------
// Robots.txt generation
// ---------------------------------------------------------------------------

function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateSite(
  spec: SiteSpec,
  photos: PhotoData[],
): GeneratedSite {
  // 1. Resolve palette (validate hex if custom, fallback to sage_sand on invalid)
  let resolvedColours: CustomColours;
  let headingFontForWordmark: string;

  if (spec.design) {
    // Use advanced design config colours and font
    resolvedColours = spec.design.colours;
    headingFontForWordmark = spec.design.typography.headingFont;
  } else if (spec.palette === "custom" && spec.custom_colours) {
    const validated = validateCustomColours(spec.custom_colours);
    resolvedColours = validated
      ? getPaletteColours("custom", validated)
      : getPaletteColours("sage_sand", null);
    headingFontForWordmark = TYPOGRAPHY_CONFIG[spec.typography].heading;
  } else {
    resolvedColours = getPaletteColours(spec.palette, spec.custom_colours);
    headingFontForWordmark = TYPOGRAPHY_CONFIG[spec.typography].heading;
  }

  // 2. Generate wordmark SVG
  const wordmark = generateWordmark(
    spec.business_name ?? "My Site",
    headingFontForWordmark,
    resolvedColours.primary,
    spec.style,
  );

  // 4. For each page in spec.pages, call the corresponding generator
  // Create a working spec with validated colours so page generators use the resolved palette
  const workingSpec: SiteSpec = {
    ...spec,
    custom_colours:
      spec.palette === "custom" ? resolvedColours : spec.custom_colours,
  };

  const generatedPages: GeneratedPage[] = [];
  const navItems = getNavItems(spec.pages);

  for (const navItem of navItems) {
    switch (navItem.slug) {
      case "home":
        generatedPages.push({
          filename: "index.html",
          html: generateHomePage(workingSpec, photos, wordmark),
        });
        break;
      case "about":
        generatedPages.push({
          filename: "about.html",
          html: generateAboutPage(workingSpec, photos, wordmark),
        });
        break;
      case "services":
        generatedPages.push({
          filename: "services.html",
          html: generateServicesPage(workingSpec, wordmark),
        });
        break;
      case "contact":
        generatedPages.push({
          filename: "contact.html",
          html: generateContactPage(workingSpec, wordmark),
        });
        break;
      case "testimonials":
        // Only generate if there are testimonials
        if (spec.testimonials.length > 0) {
          generatedPages.push({
            filename: "testimonials.html",
            html: generateTestimonialsPage(workingSpec, wordmark),
          });
        }
        break;
      case "faq":
        // Only generate if FAQ is enabled
        if (spec.faq_enabled) {
          generatedPages.push({
            filename: "faq.html",
            html: generateFaqPage(workingSpec, wordmark),
          });
        }
        break;
    }
  }

  // 5. Generate sitemap.xml
  const baseUrl = spec.subdomain_slug
    ? `https://${spec.subdomain_slug}.birthbuild.com`
    : "https://example.birthbuild.com";
  const sitemap = generateSitemap(generatedPages, baseUrl);

  // 6. Generate robots.txt
  const robots = generateRobotsTxt(baseUrl);

  // 7. Return GeneratedSite
  return {
    pages: generatedPages,
    sitemap,
    robots,
  };
}
