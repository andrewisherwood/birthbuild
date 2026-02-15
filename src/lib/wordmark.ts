/**
 * Wordmark SVG generation for generated sites.
 * Produces an accessible SVG with the business name as a text element.
 */

import type { StyleOption } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// XML escaping for SVG text content
// ---------------------------------------------------------------------------

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Wordmark generator
// ---------------------------------------------------------------------------

/**
 * Generate a wordmark SVG string.
 *
 * @param businessName - The business name to display
 * @param fontFamily - The CSS font-family to use
 * @param primaryColour - The primary colour for the text
 * @param style - The site style (modern, classic, minimal)
 * @returns An SVG string suitable for embedding in HTML
 */
export function generateWordmark(
  businessName: string,
  fontFamily: string,
  primaryColour: string,
  style: StyleOption,
): string {
  const escaped = xmlEscape(businessName);
  const titleText = xmlEscape(businessName);

  // Approximate width: ~10px per character at font-size 28, with padding
  const estimatedWidth = Math.max(200, businessName.length * 16 + 40);
  const height = style === "classic" ? 60 : 48;

  const fontWeight = style === "minimal" ? "300" : "600";
  const fontSize = style === "minimal" ? "24" : "28";
  const letterSpacing = style === "modern" ? "0.5" : style === "minimal" ? "2" : "0";

  const textY = style === "classic" ? "30" : "32";

  // Classic style adds a decorative divider line below the text
  const divider =
    style === "classic"
      ? `<line x1="${estimatedWidth * 0.3}" y1="46" x2="${estimatedWidth * 0.7}" y2="46" stroke="${primaryColour}" stroke-width="1" opacity="0.6" />`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${estimatedWidth} ${height}" role="img" aria-labelledby="wordmark-title" width="${estimatedWidth}" height="${height}"><title id="wordmark-title">${titleText}</title><text x="50%" y="${textY}" text-anchor="middle" font-family="'${fontFamily}', sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}" fill="${primaryColour}">${escaped}</text>${divider}</svg>`;
}
