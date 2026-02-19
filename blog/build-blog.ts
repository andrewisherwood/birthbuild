import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaqItem {
  q: string;
  a: string;
}

interface PostFrontmatter {
  title: string;
  slug: string;
  description: string;
  category: string;
  date: string;
  updated?: string;
  readingTime?: number;
  featured?: boolean;
  keywords?: string[];
  faq?: FaqItem[];
  relatedSlugs?: string[];
}

interface Post {
  frontmatter: PostFrontmatter;
  content: string;
  html: string;
  toc: TocEntry[];
  excerpt: string;
  readingTime: number;
}

interface TocEntry {
  id: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "blog", "content");
const TEMPLATE_DIR = path.join(ROOT, "blog", "templates");
const ASSETS_DIR = path.join(ROOT, "blog", "assets");
const OUTPUT_DIR = path.join(ROOT, "public", "blog");
const BASE_URL = "https://birthbuild.com";

const CATEGORIES: Record<string, string> = {
  "website-building": "Website Building",
  "marketing-seo": "Marketing & SEO",
  "website-strategy": "Website Strategy",
  "starting-out": "Starting Out",
  "birth-education": "Birth Education",
  "industry-tech": "Industry & Tech",
  "community": "Community",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPartial(name: string): string {
  return fs.readFileSync(
    path.join(TEMPLATE_DIR, "partials", name),
    "utf-8",
  );
}

function readTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), "utf-8");
}

function computeReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 230));
}

function extractExcerpt(html: string, maxLength = 160): string {
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, "") + "...";
}

function extractToc(html: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    toc.push({ id: match[1], text: match[2].replace(/<[^>]+>/g, "") });
  }
  return toc;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Markdown setup — add IDs to h2/h3 headings
// ---------------------------------------------------------------------------

const renderer = new marked.Renderer();

renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const id = slugify(text.replace(/<[^>]+>/g, ""));
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};

marked.setOptions({ renderer });

// ---------------------------------------------------------------------------
// Structured data generators
// ---------------------------------------------------------------------------

function articleJsonLd(post: Post): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.frontmatter.title,
    description: post.frontmatter.description,
    datePublished: post.frontmatter.date,
    dateModified: post.frontmatter.updated ?? post.frontmatter.date,
    author: {
      "@type": "Organization",
      name: "BirthBuild",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "BirthBuild",
      url: BASE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${post.frontmatter.slug}`,
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function faqJsonLd(faq: FaqItem[]): string {
  if (!faq.length) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function breadcrumbJsonLd(title: string, slug: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${BASE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: `${BASE_URL}/blog/${slug}`,
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

// ---------------------------------------------------------------------------
// Build posts
// ---------------------------------------------------------------------------

function loadPosts(): Post[] {
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      const fm = data as PostFrontmatter;
      const html = marked.parse(content) as string;
      const toc = extractToc(html);
      const readingTime = fm.readingTime ?? computeReadingTime(content);
      const excerpt = extractExcerpt(html);

      return { frontmatter: fm, content, html, toc, excerpt, readingTime };
    })
    .sort(
      (a, b) =>
        new Date(b.frontmatter.date).getTime() -
        new Date(a.frontmatter.date).getTime(),
    );
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderTocItems(toc: TocEntry[]): string {
  return toc
    .map(
      (entry) =>
        `<li><a href="#${entry.id}" class="toc-link">${entry.text}</a></li>`,
    )
    .join("\n");
}

function renderPostCard(post: Post): string {
  const template = readPartial("post-card.html");
  const categoryLabel = CATEGORIES[post.frontmatter.category] ?? post.frontmatter.category;
  return template
    .replace(/\{\{SLUG\}\}/g, post.frontmatter.slug)
    .replace(/\{\{CATEGORY_LABEL\}\}/g, categoryLabel)
    .replace(/\{\{CATEGORY_SLUG\}\}/g, post.frontmatter.category)
    .replace(/\{\{READ_TIME\}\}/g, String(post.readingTime))
    .replace(/\{\{TITLE\}\}/g, post.frontmatter.title)
    .replace(/\{\{EXCERPT\}\}/g, post.excerpt)
    .replace(/\{\{DATE_FORMATTED\}\}/g, formatDate(post.frontmatter.date));
}

function renderFeaturedPost(post: Post): string {
  const categoryLabel = CATEGORIES[post.frontmatter.category] ?? post.frontmatter.category;
  return `<a href="/blog/${post.frontmatter.slug}" class="featured-post" data-category="${post.frontmatter.category}">
  <div class="post-meta">
    <span class="pill">${categoryLabel}</span>
    <span class="meta-separator">&middot;</span>
    <span class="read-time">${post.readingTime} min read</span>
  </div>
  <h2 class="post-title">${post.frontmatter.title}</h2>
  <p class="post-excerpt">${post.excerpt}</p>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <span class="post-date">${formatDate(post.frontmatter.date)}</span>
    <span class="post-link">Read article <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>
  </div>
</a>`;
}

function renderFaqSection(faq: FaqItem[]): string {
  if (!faq.length) return "";
  const items = faq
    .map(
      (item) => `<details class="faq-item">
  <summary>${item.q}</summary>
  <div class="faq-answer">${item.a}</div>
</details>`,
    )
    .join("\n");

  return `<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  ${items}
</section>`;
}

function renderRelatedPosts(
  post: Post,
  allPosts: Post[],
): string {
  const slugs = post.frontmatter.relatedSlugs ?? [];
  let related: Post[];

  if (slugs.length > 0) {
    related = slugs
      .map((s) => allPosts.find((p) => p.frontmatter.slug === s))
      .filter((p): p is Post => p !== undefined)
      .slice(0, 3);
  } else {
    related = allPosts
      .filter(
        (p) =>
          p.frontmatter.slug !== post.frontmatter.slug &&
          p.frontmatter.category === post.frontmatter.category,
      )
      .slice(0, 3);
  }

  if (!related.length) return "";

  const cards = related.map(renderPostCard).join("\n");
  return `<section class="related-posts">
  <div class="section-label">Related Posts</div>
  <div class="related-grid">${cards}</div>
</section>`;
}

function renderCategoryPills(): string {
  let html = `<button class="category-pill active" data-category="all">All</button>\n`;
  for (const [slug, label] of Object.entries(CATEGORIES)) {
    html += `<button class="category-pill" data-category="${slug}">${label}</button>\n`;
  }
  return html;
}

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

function buildHead(
  title: string,
  description: string,
  canonicalUrl: string,
  ogType: string,
  structuredData: string,
): string {
  return readPartial("head.html")
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{DESCRIPTION\}\}/g, description)
    .replace(/\{\{CANONICAL_URL\}\}/g, canonicalUrl)
    .replace(/\{\{OG_TYPE\}\}/g, ogType)
    .replace(/\{\{STRUCTURED_DATA\}\}/g, structuredData);
}

function buildIndexPage(posts: Post[]): string {
  const featured = posts.find((p) => p.frontmatter.featured) ?? posts[0];
  const remaining = posts.filter((p) => p !== featured);

  const head = buildHead(
    "Blog | BirthBuild — Resources for Birth Workers",
    "Practical guides on building your doula website, growing your practice, and navigating birth work.",
    `${BASE_URL}/blog`,
    "website",
    "",
  );

  const template = readTemplate("index.html");
  return template
    .replace("{{HEAD}}", head)
    .replace("{{NAV}}", readPartial("nav.html"))
    .replace("{{FEATURED_POST}}", featured ? renderFeaturedPost(featured) : "")
    .replace("{{POST_CARDS}}", remaining.map(renderPostCard).join("\n"))
    .replace("{{CATEGORY_PILLS}}", renderCategoryPills())
    .replace("{{FOOTER}}", readPartial("footer.html"));
}

function buildPostPage(post: Post, allPosts: Post[]): string {
  const faq = post.frontmatter.faq ?? [];
  const structuredData = [
    articleJsonLd(post),
    faqJsonLd(faq),
    breadcrumbJsonLd(post.frontmatter.title, post.frontmatter.slug),
  ].join("\n");

  const head = buildHead(
    `${post.frontmatter.title} | BirthBuild Blog`,
    post.frontmatter.description,
    `${BASE_URL}/blog/${post.frontmatter.slug}`,
    "article",
    structuredData,
  );

  const categoryLabel =
    CATEGORIES[post.frontmatter.category] ?? post.frontmatter.category;

  const template = readTemplate("post.html");
  return template
    .replace("{{HEAD}}", head)
    .replace("{{NAV}}", readPartial("nav.html"))
    .replace(/\{\{CATEGORY_LABEL\}\}/g, categoryLabel)
    .replace(/\{\{CATEGORY_SLUG\}\}/g, post.frontmatter.category)
    .replace(/\{\{READ_TIME\}\}/g, String(post.readingTime))
    .replace(/\{\{TITLE\}\}/g, post.frontmatter.title)
    .replace(
      /\{\{DATE_FORMATTED\}\}/g,
      formatDate(post.frontmatter.date),
    )
    .replace(/\{\{DATE_ISO\}\}/g, post.frontmatter.date)
    .replace(/\{\{TOC_ITEMS\}\}/g, renderTocItems(post.toc))
    .replace("{{ARTICLE_CONTENT}}", post.html)
    .replace("{{CTA_BANNER}}", readPartial("cta-banner.html"))
    .replace("{{RELATED_POSTS}}", renderRelatedPosts(post, allPosts))
    .replace("{{FAQ_SECTION}}", renderFaqSection(faq))
    .replace("{{FOOTER}}", readPartial("footer.html"));
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function buildSitemap(posts: Post[]): string {
  const urls = [
    `  <url>
    <loc>${BASE_URL}/blog</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    ...posts.map(
      (p) => `  <url>
    <loc>${BASE_URL}/blog/${p.frontmatter.slug}</loc>
    <lastmod>${p.frontmatter.updated ?? p.frontmatter.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Building blog...");

  // Clean output
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Copy assets
  const assetsOut = path.join(OUTPUT_DIR, "assets");
  fs.mkdirSync(assetsOut, { recursive: true });
  fs.copyFileSync(
    path.join(ASSETS_DIR, "blog.css"),
    path.join(assetsOut, "blog.css"),
  );

  // Load posts
  const posts = loadPosts();
  console.log(`Found ${posts.length} posts`);

  // Build index
  const indexHtml = buildIndexPage(posts);
  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), indexHtml);
  console.log("Built: /blog/index.html");

  // Build each post
  for (const post of posts) {
    const postDir = path.join(OUTPUT_DIR, post.frontmatter.slug);
    fs.mkdirSync(postDir, { recursive: true });
    const postHtml = buildPostPage(post, posts);
    fs.writeFileSync(path.join(postDir, "index.html"), postHtml);
    console.log(`Built: /blog/${post.frontmatter.slug}/index.html`);
  }

  // Build sitemap
  const sitemap = buildSitemap(posts);
  fs.writeFileSync(path.join(OUTPUT_DIR, "sitemap.xml"), sitemap);
  console.log("Built: /blog/sitemap.xml");

  console.log(`\nDone! ${posts.length} posts built to ${OUTPUT_DIR}`);
}

main();
