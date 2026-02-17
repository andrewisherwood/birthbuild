/**
 * CSS editor — pure functions for editing CSS variables in checkpoint HTML.
 *
 * Operates on the <style> block within the HTML to update :root custom
 * properties (colours, fonts) and the Google Fonts <link> tag.
 */

import { HEADING_FONTS, BODY_FONTS, findFont, buildGoogleFontsUrl } from "@/lib/design-tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CssVariables {
  background: string;
  primary: string;
  accent: string;
  text: string;
  cta: string;
  fontHeading: string;
  fontBody: string;
}

// ---------------------------------------------------------------------------
// Extract CSS variables from HTML
// ---------------------------------------------------------------------------

/**
 * Extract the current CSS custom property values from the <style> block.
 */
export function extractCssVariables(html: string): CssVariables {
  const defaults: CssVariables = {
    background: "#f5f0e8",
    primary: "#5f7161",
    accent: "#c9b99a",
    text: "#3d3d3d",
    cta: "#5f7161",
    fontHeading: "Inter",
    fontBody: "Inter",
  };

  const colourMap: Record<string, keyof CssVariables> = {
    "--colour-bg": "background",
    "--colour-primary": "primary",
    "--colour-accent": "accent",
    "--colour-text": "text",
    "--colour-cta": "cta",
  };

  // Extract colour variables
  for (const [varName, key] of Object.entries(colourMap)) {
    const re = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(#[0-9a-fA-F]{6})`, "i");
    const match = html.match(re);
    if (match?.[1]) {
      defaults[key] = match[1];
    }
  }

  // Extract heading font
  const headingMatch = html.match(/--font-heading\s*:\s*'([^']+)'/);
  if (headingMatch?.[1]) {
    defaults.fontHeading = headingMatch[1];
  }

  // Extract body font
  const bodyMatch = html.match(/--font-body\s*:\s*'([^']+)'/);
  if (bodyMatch?.[1]) {
    defaults.fontBody = bodyMatch[1];
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Update CSS variables
// ---------------------------------------------------------------------------

/**
 * Update CSS custom properties in the <style> block.
 * Only updates provided keys; omitted keys are left unchanged.
 */
export function updateCssVariables(html: string, partial: Partial<CssVariables>): string {
  let result = html;

  const colourUpdates: Array<{ varName: string; key: keyof CssVariables }> = [
    { varName: "--colour-bg", key: "background" },
    { varName: "--colour-primary", key: "primary" },
    { varName: "--colour-accent", key: "accent" },
    { varName: "--colour-text", key: "text" },
    { varName: "--colour-cta", key: "cta" },
  ];

  for (const { varName, key } of colourUpdates) {
    if (partial[key]) {
      const re = new RegExp(
        `(${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*)#[0-9a-fA-F]{6}`,
        "gi",
      );
      result = result.replace(re, `$1${partial[key]}`);
    }
  }

  // Update heading font
  if (partial.fontHeading) {
    const headingDef = findFont(partial.fontHeading);
    const fallback = headingDef?.category === "serif" ? "serif" : "sans-serif";
    result = result.replace(
      /--font-heading\s*:\s*'[^']+',\s*(?:serif|sans-serif|display)/g,
      `--font-heading: '${partial.fontHeading}', ${fallback}`,
    );
  }

  // Update body font
  if (partial.fontBody) {
    const bodyDef = findFont(partial.fontBody);
    const fallback = bodyDef?.category === "serif" ? "serif" : "sans-serif";
    result = result.replace(
      /--font-body\s*:\s*'[^']+',\s*(?:serif|sans-serif|display)/g,
      `--font-body: '${partial.fontBody}', ${fallback}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Update Google Fonts link
// ---------------------------------------------------------------------------

/**
 * Update the Google Fonts <link> tag in the <head> to match new font choices.
 */
export function updateGoogleFontsLink(
  html: string,
  headingFont: string,
  bodyFont: string,
): string {
  const newUrl = buildGoogleFontsUrl(headingFont, bodyFont);

  // Match the Google Fonts stylesheet link
  return html.replace(
    /(<link\s+href=")https:\/\/fonts\.googleapis\.com\/css2\?[^"]*(")/g,
    `$1${newUrl}$2`,
  );
}

// ---------------------------------------------------------------------------
// Apply updates across all pages
// ---------------------------------------------------------------------------

/**
 * Apply CSS variable and font updates to all pages in a checkpoint.
 * Returns the updated pages array.
 */
export function updateAllPages(
  pages: Array<{ filename: string; html: string }>,
  partial: Partial<CssVariables>,
): Array<{ filename: string; html: string }> {
  return pages.map((page) => {
    let html = updateCssVariables(page.html, partial);

    if (partial.fontHeading || partial.fontBody) {
      const current = extractCssVariables(html);
      html = updateGoogleFontsLink(
        html,
        partial.fontHeading ?? current.fontHeading,
        partial.fontBody ?? current.fontBody,
      );
    }

    return { filename: page.filename, html };
  });
}

// ---------------------------------------------------------------------------
// Font lists for UI
// ---------------------------------------------------------------------------

export const AVAILABLE_HEADING_FONTS = HEADING_FONTS.map((f) => f.name);
export const AVAILABLE_BODY_FONTS = BODY_FONTS.map((f) => f.name);
