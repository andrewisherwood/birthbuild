/**
 * Shared robots.txt and sitemap.xml generators.
 * Used by both site-generator.ts (template path) and useBuild.ts (LLM path).
 */

interface SitemapPage {
  filename: string;
}

/**
 * Generate a robots.txt with explicit AI crawler allows.
 */
export function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}

/**
 * Generate a sitemap.xml with lastmod dates.
 */
export function generateSitemap(
  pages: SitemapPage[],
  baseUrl: string,
): string {
  const today = new Date().toISOString().split("T")[0];
  const urls = pages
    .map(
      (page) =>
        `  <url>
    <loc>${baseUrl}/${page.filename}</loc>
    <lastmod>${today}</lastmod>
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
