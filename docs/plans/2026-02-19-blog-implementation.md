# Blog Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static blog (index + article pages) for birthbuild.com with Markdown content, magazine-style index, sticky TOC articles, category filtering, and full SEO/agentic SEO structured data.

**Architecture:** Markdown files with YAML frontmatter compiled by a custom TypeScript build script (`blog/build-blog.ts`) into static HTML in `public/blog/`. Templates use the same design system as the landing page (Cormorant Garamond + Outfit, sage/sand/cream palette). No framework — pure static HTML + vanilla JS for interactivity.

**Tech Stack:** TypeScript (tsx runner), marked (Markdown), gray-matter (frontmatter), Node fs/path/glob

**Design doc:** `docs/plans/2026-02-19-blog-design.md`

---

### Task 1: Create Feature Branch and Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Create feature branch from main**

```bash
git checkout main
git pull origin main
git checkout -b feature/blog-pages
```

**Step 2: Install blog build dependencies**

```bash
npm install --save-dev marked gray-matter @types/marked tsx
```

Note: `tsx` is used to run the TypeScript build script directly. `glob` is not needed — we use `fs.readdirSync`.

**Step 3: Verify installation**

```bash
node -e "require('marked'); require('gray-matter'); console.log('OK')"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add blog build dependencies (marked, gray-matter, tsx)"
```

---

### Task 2: Create Directory Structure and Blog CSS

**Files:**
- Create: `blog/assets/blog.css`
- Create: `blog/content/_data/authors.json`

**Step 1: Create directory structure**

```bash
mkdir -p blog/content/_data blog/templates/partials blog/assets
```

**Step 2: Create `blog/content/_data/authors.json`**

```json
{
  "birthbuild": {
    "name": "BirthBuild",
    "role": "The BirthBuild Team"
  }
}
```

**Step 3: Create `blog/assets/blog.css`**

This file contains all blog-specific styles. It references the same CSS custom properties defined in `index.html` (which are re-declared in the blog templates' `<style>` block in the head partial).

```css
/* ── Blog shared styles ── */
/* Extends the BirthBuild landing page design system. */
/* CSS variables (--sage, --sand, --cream, etc.) declared in head partial. */

/* ── Blog header ── */
.blog-header {
  text-align: center;
  padding: 8rem 2rem 3rem;
}
.blog-header .section-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sage);
  margin-bottom: 1rem;
}
.blog-header .section-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text);
}
.blog-header .section-title em {
  font-style: italic;
  color: var(--sage);
  font-weight: 400;
}
.blog-header .section-desc {
  font-size: 1.1rem;
  color: var(--text-light);
  line-height: 1.65;
  max-width: 560px;
  margin: 1rem auto 0;
  font-weight: 300;
}

/* ── Category filter pills ── */
.category-filter {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 0 2rem 3rem;
  max-width: 900px;
  margin: 0 auto;
}
.category-pill {
  padding: 0.5rem 1.25rem;
  border: 1.5px solid var(--sage-pale);
  border-radius: 100px;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--sage);
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}
.category-pill:hover {
  background: var(--sage-pale);
  border-color: var(--sage);
}
.category-pill.active {
  background: var(--sage);
  color: white;
  border-color: var(--sage);
}

/* ── Featured post card ── */
.featured-post {
  background: var(--sage-pale);
  border-radius: 16px;
  padding: 2.5rem;
  margin-bottom: 3rem;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  text-decoration: none;
  display: block;
  color: inherit;
}
.featured-post:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.08);
}
.featured-post .post-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.featured-post .post-title {
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 400;
  line-height: 1.25;
  color: var(--text);
  margin-bottom: 0.75rem;
}
.featured-post .post-excerpt {
  font-size: 1rem;
  color: var(--text-light);
  line-height: 1.65;
  font-weight: 300;
  margin-bottom: 1.25rem;
  max-width: 640px;
}
.featured-post .post-link {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--sage);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.featured-post .post-link svg {
  transition: transform 0.3s;
}
.featured-post:hover .post-link svg {
  transform: translateX(3px);
}
.featured-post .post-date {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── Post card (grid) ── */
.post-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  padding: 0 2rem 4rem;
  max-width: 1200px;
  margin: 0 auto;
}
.post-card {
  background: white;
  border-radius: 16px;
  border: 1px solid rgba(95, 113, 97, 0.06);
  padding: 2rem;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  text-decoration: none;
  display: flex;
  flex-direction: column;
  color: inherit;
}
.post-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.06);
  border-color: rgba(95, 113, 97, 0.12);
}
.post-card .post-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.post-card .post-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--text);
  margin-bottom: 0.5rem;
}
.post-card .post-excerpt {
  font-size: 0.9rem;
  color: var(--text-light);
  line-height: 1.6;
  font-weight: 300;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}
.post-card .post-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Shared meta elements */
.pill {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: var(--sage-pale);
  color: var(--sage);
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.meta-separator {
  color: var(--text-muted);
  font-size: 0.75rem;
}
.read-time {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── Article page ── */
.article-header {
  max-width: 720px;
  margin: 0 auto;
  padding: 7rem 2rem 2rem;
}
.article-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--sage);
  text-decoration: none;
  margin-bottom: 2rem;
  font-weight: 400;
  transition: color 0.2s;
}
.article-back:hover {
  color: var(--sage-light);
}
.article-back svg {
  transition: transform 0.3s;
}
.article-back:hover svg {
  transform: translateX(-3px);
}
.article-header .post-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.article-header h1 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: 1rem;
}
.article-date {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.article-divider {
  border: none;
  border-top: 1px solid var(--sand-dark);
  margin: 2rem 0 0;
}

/* ── Article body layout (TOC + prose) ── */
.article-layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 720px) 1fr;
  gap: 2rem;
  max-width: 1100px;
  margin: 0 auto;
  padding: 3rem 2rem 4rem;
}

/* ── TOC sidebar ── */
.toc-sidebar {
  position: sticky;
  top: 6rem;
  align-self: start;
}
.toc-title {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 1rem;
}
.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.toc-link {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.2rem 0 0.2rem 0.75rem;
  border-left: 2px solid transparent;
  transition: all 0.2s;
  display: block;
  line-height: 1.4;
}
.toc-link:hover {
  color: var(--sage);
}
.toc-link.active {
  color: var(--sage);
  font-weight: 500;
  border-left-color: var(--sage);
}

/* ── TOC mobile ── */
.toc-mobile {
  display: none;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 2rem;
}
.toc-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--sage);
  background: var(--sage-pale);
  border: none;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  width: 100%;
  transition: background 0.2s;
}
.toc-toggle:hover {
  background: var(--sand-dark);
}
.toc-toggle svg {
  transition: transform 0.2s;
  margin-left: auto;
}
.toc-toggle.open svg {
  transform: rotate(180deg);
}
.toc-mobile-list {
  list-style: none;
  padding: 0.75rem 1rem;
  margin: 0;
  background: var(--sage-pale);
  border-radius: 0 0 10px 10px;
  display: none;
}
.toc-mobile-list.open {
  display: block;
}
.toc-mobile-list a {
  display: block;
  padding: 0.4rem 0;
  font-size: 0.85rem;
  color: var(--text-light);
  text-decoration: none;
}
.toc-mobile-list a:hover {
  color: var(--sage);
}

/* ── Article prose ── */
.article-prose {
  max-width: 720px;
  min-width: 0;
}
.article-prose h2 {
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 400;
  color: var(--sage);
  margin: 3rem 0 1rem;
  line-height: 1.25;
  scroll-margin-top: 6rem;
}
.article-prose h3 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--text);
  margin: 2rem 0 0.75rem;
  line-height: 1.3;
}
.article-prose p {
  font-size: 1.05rem;
  font-weight: 300;
  line-height: 1.8;
  color: var(--text);
  margin-bottom: 1.25rem;
}
.article-prose strong {
  font-weight: 500;
}
.article-prose a {
  color: var(--sage);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.article-prose a:hover {
  border-bottom-color: var(--sage);
}
.article-prose blockquote {
  border-left: 4px solid var(--sage);
  background: var(--sage-pale);
  padding: 1.5rem;
  margin: 2rem 0;
  border-radius: 0 8px 8px 0;
}
.article-prose blockquote p {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 300;
  font-style: italic;
  color: var(--text-light);
  margin: 0;
}
.article-prose code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  background: var(--sage-pale);
  padding: 2px 6px;
  border-radius: 4px;
}
.article-prose pre {
  background: var(--text);
  color: var(--cream);
  padding: 1.5rem;
  border-radius: 12px;
  overflow-x: auto;
  margin: 2rem 0;
}
.article-prose pre code {
  background: none;
  padding: 0;
  font-size: 0.85rem;
  color: inherit;
}
.article-prose ul,
.article-prose ol {
  padding-left: 1.5rem;
  margin-bottom: 1.25rem;
}
.article-prose li {
  font-size: 0.95rem;
  font-weight: 300;
  line-height: 1.8;
  color: var(--text);
  margin-bottom: 0.4rem;
}
.article-prose li::marker {
  color: var(--sage);
}
.article-prose img {
  max-width: min(900px, calc(100% + 180px));
  margin-left: 50%;
  transform: translateX(-50%);
  border-radius: 12px;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}
.article-prose .img-caption {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 300;
  margin-bottom: 2rem;
}
.article-prose hr {
  border: none;
  border-top: 1px solid var(--sand-dark);
  margin: 3rem 0;
}

/* ── CTA banner ── */
.cta-banner {
  background: var(--sage);
  color: white;
  border-radius: 16px;
  padding: 3rem;
  max-width: 720px;
  margin: 3rem auto;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.cta-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    ellipse at 20% 50%,
    rgba(255, 255, 255, 0.05) 0%,
    transparent 60%
  );
}
.cta-banner-inner {
  position: relative;
}
.cta-banner h2 {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 300;
  margin-bottom: 0.75rem;
}
.cta-banner p {
  font-size: 0.95rem;
  opacity: 0.8;
  line-height: 1.6;
  max-width: 480px;
  margin: 0 auto 1.5rem;
  font-weight: 300;
}
.cta-banner .btn-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 2rem;
  background: white;
  color: var(--sage);
  border: none;
  border-radius: 100px;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
}
.cta-banner .btn-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
.cta-banner .btn-cta svg {
  transition: transform 0.3s;
}
.cta-banner .btn-cta:hover svg {
  transform: translateX(3px);
}

/* ── Related posts ── */
.related-posts {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem 4rem;
}
.related-posts .section-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--sage);
  margin-bottom: 1.5rem;
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

/* ── FAQ section ── */
.faq-section {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 2rem 4rem;
}
.faq-section h2 {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 400;
  color: var(--text);
  margin-bottom: 1.5rem;
}
.faq-item {
  border-bottom: 1px solid var(--sand-dark);
}
.faq-item:first-child {
  border-top: 1px solid var(--sand-dark);
}
.faq-item summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 0;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text);
  list-style: none;
}
.faq-item summary::-webkit-details-marker {
  display: none;
}
.faq-item summary::after {
  content: '';
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--sage);
  border-bottom: 2px solid var(--sage);
  transform: rotate(-45deg);
  transition: transform 0.2s;
  flex-shrink: 0;
  margin-left: 1rem;
}
.faq-item[open] summary::after {
  transform: rotate(45deg);
}
.faq-item .faq-answer {
  padding: 0 0 1.25rem;
  font-size: 0.9rem;
  font-weight: 300;
  line-height: 1.7;
  color: var(--text-light);
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .article-layout {
    display: block;
    max-width: 720px;
    padding: 2rem 2rem 4rem;
  }
  .toc-sidebar {
    display: none;
  }
  .toc-mobile {
    display: block;
    margin-bottom: 2rem;
  }
}
@media (max-width: 768px) {
  .blog-header {
    padding: 7rem 1.25rem 2rem;
  }
  .category-filter {
    padding: 0 1.25rem 2rem;
  }
  .post-grid {
    grid-template-columns: 1fr;
    padding: 0 1.25rem 3rem;
  }
  .featured-post {
    padding: 1.5rem;
  }
  .article-header {
    padding: 6rem 1.25rem 1.5rem;
  }
  .article-layout {
    padding: 1.5rem 1.25rem 3rem;
  }
  .toc-mobile {
    padding: 0 1.25rem;
  }
  .cta-banner {
    margin-left: 1.25rem;
    margin-right: 1.25rem;
    padding: 2rem;
  }
  .related-posts {
    padding: 0 1.25rem 3rem;
  }
  .related-grid {
    grid-template-columns: 1fr;
  }
  .faq-section {
    padding: 0 1.25rem 3rem;
  }
  .article-prose img {
    max-width: 100%;
    margin-left: 0;
    transform: none;
  }
}
@media (min-width: 769px) and (max-width: 1024px) {
  .post-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .related-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

**Step 4: Commit**

```bash
git add blog/
git commit -m "feat(blog): add directory structure, CSS, and author data"
```

---

### Task 3: Create HTML Template Partials

**Files:**
- Create: `blog/templates/partials/head.html`
- Create: `blog/templates/partials/nav.html`
- Create: `blog/templates/partials/footer.html`
- Create: `blog/templates/partials/cta-banner.html`
- Create: `blog/templates/partials/post-card.html`

**Step 1: Create `blog/templates/partials/head.html`**

This is the shared `<head>` content. The build script replaces `{{TITLE}}`, `{{DESCRIPTION}}`, `{{CANONICAL_URL}}`, `{{OG_TYPE}}`, and `{{STRUCTURED_DATA}}` placeholders.

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}" />
<link rel="canonical" href="{{CANONICAL_URL}}" />

<!-- Open Graph -->
<meta property="og:title" content="{{TITLE}}" />
<meta property="og:description" content="{{DESCRIPTION}}" />
<meta property="og:type" content="{{OG_TYPE}}" />
<meta property="og:url" content="{{CANONICAL_URL}}" />
<meta property="og:site_name" content="BirthBuild" />
<meta property="og:locale" content="en_GB" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="{{TITLE}}" />
<meta name="twitter:description" content="{{DESCRIPTION}}" />

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&display=swap"
  rel="stylesheet"
/>

<!-- Blog CSS -->
<link rel="stylesheet" href="/blog/assets/blog.css" />

<!-- Design system variables (shared with landing page) -->
<style>
  :root {
    --sage: #5f7161;
    --sage-light: #7a8f7c;
    --sage-pale: #e8ede9;
    --sand: #f5f0e8;
    --sand-dark: #e8dfd3;
    --cream: #faf8f4;
    --warm-white: #fdfcfa;
    --text: #2d2d2d;
    --text-light: #5a5a5a;
    --text-muted: #8a8a7e;
    --blush: #c9928e;
    --blush-light: #e8cfc4;
    --earth: #6b4c3b;
    --ocean: #3d6b7e;
    --gold: #b8a088;
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-body: 'Outfit', system-ui, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; font-size: 16px; }
  body {
    font-family: var(--font-body);
    color: var(--text);
    background: var(--cream);
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
  }
</style>

<!-- Structured Data -->
{{STRUCTURED_DATA}}
```

**Step 2: Create `blog/templates/partials/nav.html`**

Same nav as the landing page with "Blog" added. Uses the same CSS from `index.html`.

```html
<nav id="blog-nav">
  <a href="/" class="nav-logo">Birth<span>Build</span></a>
  <div class="nav-links">
    <a href="/#how">How It Works</a>
    <a href="/#features">Features</a>
    <a href="/blog" class="nav-active">Blog</a>
    <a href="/#pricing">Pricing</a>
    <a href="/app" class="nav-cta">Get Started</a>
  </div>
</nav>
<style>
  nav {
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 100;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.4s ease;
    background: rgba(250, 248, 244, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 1px 0 rgba(95, 113, 97, 0.08);
  }
  .nav-logo {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 500;
    color: var(--sage);
    text-decoration: none;
    letter-spacing: -0.02em;
  }
  .nav-logo span { color: var(--text-muted); font-weight: 300; }
  .nav-links { display: flex; gap: 2rem; align-items: center; }
  .nav-links a {
    font-size: 0.875rem;
    color: var(--text-light);
    text-decoration: none;
    font-weight: 400;
    letter-spacing: 0.02em;
    transition: color 0.2s;
  }
  .nav-links a:hover, .nav-links a.nav-active { color: var(--sage); }
  .nav-cta {
    background: var(--sage) !important;
    color: white !important;
    padding: 0.6rem 1.5rem;
    border-radius: 100px;
    font-weight: 500 !important;
    transition: all 0.3s !important;
  }
  .nav-cta:hover {
    background: var(--sage-light) !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(95, 113, 97, 0.25);
  }
  @media (max-width: 768px) {
    nav { padding: 0.75rem 1.25rem; }
    .nav-links a:not(.nav-cta):not(.nav-active) { display: none; }
  }
</style>
```

**Step 3: Create `blog/templates/partials/footer.html`**

Same footer as landing page, with Blog added to Product links.

```html
<footer>
  <div class="footer-inner">
    <div>
      <div class="footer-brand">Birth<span>Build</span></div>
      <div class="footer-tagline">
        Beautiful websites for birth workers. Built with care by Dopamine Labs.
      </div>
    </div>
    <div class="footer-links">
      <div class="footer-col">
        <h4>Product</h4>
        <a href="/#features">Features</a>
        <a href="/#pricing">Pricing</a>
        <a href="/#instructors">For Instructors</a>
        <a href="/blog">Blog</a>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <a href="#">Help Centre</a>
        <a href="#">Contact</a>
        <a href="#">Status</a>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>&copy; 2026 Dopamine Labs. All rights reserved.</span>
    <span>Made with care in Wimbledon</span>
  </div>
</footer>
<style>
  footer {
    background: var(--text);
    color: rgba(255, 255, 255, 0.6);
    padding: 4rem 2rem 2rem;
  }
  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 2rem;
  }
  .footer-brand {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 500;
    color: white;
    margin-bottom: 0.5rem;
  }
  .footer-brand span { color: rgba(255, 255, 255, 0.4); font-weight: 300; }
  .footer-tagline { font-size: 0.85rem; max-width: 280px; line-height: 1.5; }
  .footer-links { display: flex; gap: 3rem; }
  .footer-col h4 {
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .footer-col a {
    display: block;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    margin-bottom: 0.6rem;
    transition: color 0.2s;
  }
  .footer-col a:hover { color: white; }
  .footer-bottom {
    max-width: 1200px;
    margin: 3rem auto 0;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
  }
  @media (max-width: 768px) {
    .footer-links { gap: 2rem; }
    .footer-bottom { flex-direction: column; gap: 0.5rem; }
  }
</style>
```

**Step 4: Create `blog/templates/partials/cta-banner.html`**

```html
<div class="cta-banner">
  <div class="cta-banner-inner">
    <h2>If you'd rather skip the DIY</h2>
    <p>BirthBuild creates a beautiful, SEO-ready website for your practice in minutes. Just have a chat.</p>
    <a href="/app" class="btn-cta">
      Build your site free
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
      </svg>
    </a>
  </div>
</div>
```

**Step 5: Create `blog/templates/partials/post-card.html`**

Template with `{{SLUG}}`, `{{CATEGORY_LABEL}}`, `{{CATEGORY_SLUG}}`, `{{READ_TIME}}`, `{{TITLE}}`, `{{EXCERPT}}`, `{{DATE_FORMATTED}}` placeholders.

```html
<a href="/blog/{{SLUG}}" class="post-card" data-category="{{CATEGORY_SLUG}}">
  <div class="post-meta">
    <span class="pill">{{CATEGORY_LABEL}}</span>
    <span class="meta-separator">&middot;</span>
    <span class="read-time">{{READ_TIME}} min read</span>
  </div>
  <h3 class="post-title">{{TITLE}}</h3>
  <p class="post-excerpt">{{EXCERPT}}</p>
  <div class="post-footer">
    <span>{{DATE_FORMATTED}}</span>
  </div>
</a>
```

**Step 6: Commit**

```bash
git add blog/templates/
git commit -m "feat(blog): add HTML template partials (head, nav, footer, cta, card)"
```

---

### Task 4: Create Index Page Template

**Files:**
- Create: `blog/templates/index.html`

**Step 1: Create `blog/templates/index.html`**

The build script replaces `{{HEAD}}`, `{{NAV}}`, `{{FEATURED_POST}}`, `{{POST_CARDS}}`, `{{CATEGORY_PILLS}}`, and `{{FOOTER}}`.

```html
<!doctype html>
<html lang="en-GB">
<head>
{{HEAD}}
</head>
<body>
{{NAV}}

<header class="blog-header">
  <div class="section-label">Blog</div>
  <h1 class="section-title">Resources for <em>birth workers</em></h1>
  <p class="section-desc">
    Practical guides on building your online presence, growing your practice, and navigating the world of birth work.
  </p>
</header>

<div class="category-filter" role="navigation" aria-label="Filter by category">
  {{CATEGORY_PILLS}}
</div>

<div class="container" style="max-width:1200px;margin:0 auto;">
  {{FEATURED_POST}}
</div>

<div class="post-grid" id="post-grid">
  {{POST_CARDS}}
</div>

<!-- Final CTA -->
<section style="text-align:center;padding:6rem 2rem;position:relative;">
  <h2 class="section-title" style="font-family:var(--font-display);font-size:clamp(2rem,4vw,3.2rem);font-weight:300;letter-spacing:-0.02em;margin-bottom:1rem;">
    Your clients are searching.<br/>Let them <em>find you</em>.
  </h2>
  <p style="font-size:1.1rem;color:var(--text-light);line-height:1.65;max-width:560px;margin:0 auto 2.5rem;font-weight:300;">
    You spent months training. You don't need to spend months building a website.
    Start a conversation with BirthBuild and be live in under an hour.
  </p>
  <a href="/app" style="display:inline-flex;align-items:center;gap:0.5rem;padding:1rem 2.25rem;background:var(--sage);color:white;border:none;border-radius:100px;font-family:var(--font-body);font-size:1rem;font-weight:500;text-decoration:none;transition:all 0.3s cubic-bezier(0.22,1,0.36,1);">
    Build your site free
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  </a>
</section>

{{FOOTER}}

<script>
// Category filtering
document.querySelectorAll('.category-pill').forEach(function(pill) {
  pill.addEventListener('click', function(e) {
    e.preventDefault();
    var cat = this.getAttribute('data-category');
    document.querySelectorAll('.category-pill').forEach(function(p) { p.classList.remove('active'); });
    this.classList.add('active');
    var cards = document.querySelectorAll('.post-card');
    var featured = document.querySelector('.featured-post');
    cards.forEach(function(card) {
      if (cat === 'all' || card.getAttribute('data-category') === cat) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
    if (featured) {
      if (cat === 'all' || featured.getAttribute('data-category') === cat) {
        featured.style.display = '';
      } else {
        featured.style.display = 'none';
      }
    }
    window.location.hash = cat === 'all' ? '' : cat;
  });
});
// Restore from hash on load
(function() {
  var hash = window.location.hash.replace('#', '');
  if (hash) {
    var pill = document.querySelector('.category-pill[data-category="' + hash + '"]');
    if (pill) pill.click();
  }
})();
</script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add blog/templates/index.html
git commit -m "feat(blog): add blog index page template with category filtering"
```

---

### Task 5: Create Post Page Template

**Files:**
- Create: `blog/templates/post.html`

**Step 1: Create `blog/templates/post.html`**

Placeholders: `{{HEAD}}`, `{{NAV}}`, `{{CATEGORY_LABEL}}`, `{{CATEGORY_SLUG}}`, `{{READ_TIME}}`, `{{TITLE}}`, `{{DATE_FORMATTED}}`, `{{DATE_ISO}}`, `{{TOC_ITEMS}}`, `{{ARTICLE_CONTENT}}`, `{{CTA_BANNER}}`, `{{RELATED_POSTS}}`, `{{FAQ_SECTION}}`, `{{FOOTER}}`.

```html
<!doctype html>
<html lang="en-GB">
<head>
{{HEAD}}
</head>
<body>
{{NAV}}

<header class="article-header">
  <a href="/blog" class="article-back">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
    </svg>
    Back to Blog
  </a>
  <div class="post-meta">
    <span class="pill">{{CATEGORY_LABEL}}</span>
    <span class="meta-separator">&middot;</span>
    <span class="read-time">{{READ_TIME}} min read</span>
  </div>
  <h1>{{TITLE}}</h1>
  <time class="article-date" datetime="{{DATE_ISO}}">{{DATE_FORMATTED}}</time>
  <hr class="article-divider" />
</header>

<!-- Mobile TOC -->
<div class="toc-mobile">
  <button class="toc-toggle" aria-expanded="false" aria-controls="toc-mobile-list">
    On this page
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  </button>
  <ul class="toc-mobile-list" id="toc-mobile-list">
    {{TOC_ITEMS}}
  </ul>
</div>

<!-- Article body with sidebar TOC -->
<div class="article-layout">
  <aside class="toc-sidebar" aria-label="Table of contents">
    <div class="toc-title">On this page</div>
    <ul class="toc-list">
      {{TOC_ITEMS}}
    </ul>
  </aside>

  <article class="article-prose">
    {{ARTICLE_CONTENT}}
  </article>

  <div><!-- right gutter --></div>
</div>

{{CTA_BANNER}}

{{RELATED_POSTS}}

{{FAQ_SECTION}}

{{FOOTER}}

<script>
// TOC scroll tracking
(function() {
  var headings = document.querySelectorAll('.article-prose h2[id]');
  var tocLinks = document.querySelectorAll('.toc-link');
  if (!headings.length || !tocLinks.length) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        tocLinks.forEach(function(link) { link.classList.remove('active'); });
        var active = document.querySelector('.toc-link[href="#' + entry.target.id + '"]');
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });

  headings.forEach(function(h) { observer.observe(h); });

  // Smooth scroll for TOC links
  document.querySelectorAll('.toc-link, .toc-mobile-list a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

// Mobile TOC toggle
(function() {
  var toggle = document.querySelector('.toc-toggle');
  var list = document.querySelector('.toc-mobile-list');
  if (!toggle || !list) return;
  toggle.addEventListener('click', function() {
    var isOpen = list.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });
})();
</script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add blog/templates/post.html
git commit -m "feat(blog): add article page template with sticky TOC and FAQ"
```

---

### Task 6: Create the Build Script

**Files:**
- Create: `blog/build-blog.ts`

**Step 1: Create `blog/build-blog.ts`**

```typescript
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
```

**Step 2: Commit**

```bash
git add blog/build-blog.ts
git commit -m "feat(blog): add build script for Markdown-to-HTML compilation"
```

---

### Task 7: Create Sample Articles for Testing

**Files:**
- Create: `blog/content/how-to-build-a-doula-website.md`
- Create: `blog/content/doula-website-checklist.md`
- Create: `blog/content/doula-website-examples.md`
- Create: `blog/content/doula-website-seo.md`

We need at least 3-4 articles to test the index grid, related posts, category filtering, and featured post. These are placeholder articles with real frontmatter matching the content plan.

**Step 1: Create `blog/content/how-to-build-a-doula-website.md`**

```markdown
---
title: "How to Build a Doula Website That Actually Books Clients"
slug: how-to-build-a-doula-website
description: "Step-by-step guide to building a doula website that converts visitors into booked clients. What every page needs and how to get it right."
category: website-building
date: "2026-02-19"
updated: "2026-02-19"
featured: true
keywords:
  - how to build a doula website
  - doula website
  - create doula website
faq:
  - q: "How much does it cost to build a doula website?"
    a: "Costs range from £0 (DIY with BirthBuild) to £100-300/year (Squarespace/Wix) to £2,000-5,000 for a custom designer. BirthBuild offers a free tier and a Pro plan at £9/month."
  - q: "Do I need technical skills to build a doula website?"
    a: "Not with BirthBuild. You just answer questions about your practice in a chat conversation and the AI builds your site. No coding, no drag-and-drop, no templates to wrestle with."
  - q: "How long does it take to build a doula website?"
    a: "With BirthBuild, most birth workers have a site ready to preview in under an hour. With DIY platforms like Squarespace or Wix, expect 2-4 weekends of work."
relatedSlugs:
  - doula-website-checklist
  - doula-website-examples
---

You trained for months. Maybe years. You have the skills, the empathy, the passion for supporting families through one of the most transformative experiences of their lives.

But when someone searches "doula near me" you are invisible.

That changes today.

## Why every doula needs a website

Word of mouth is wonderful. It got you your first three clients. But it does not scale. And it does not work at 2am when an anxious first-time parent is Googling "birth doula Bristol" from their phone.

A website works for you around the clock. It explains what you do. It shows families who you are. It builds trust before you have even met.

> The research is clear. 87% of consumers search online before making a local purchasing decision. Your website is your most important marketing tool.

## What every page needs

Your doula website needs five core pages. Each one has a specific job.

### Homepage

Your homepage has three seconds to make an impression. It needs:

- A clear headline that says what you do and where
- A warm, professional photo of you
- A visible call to action (book a free call, get in touch)
- Social proof (testimonials, qualifications, Doula UK badge)

### About page

This is the most visited page on every doula website. Families want to know who will be in the room with them.

Write your about page for them, not for you. Start with what they get, then share your story.

### Services page

List your packages clearly. Birth doula support, postnatal packages, antenatal sessions. Include what is in each package and ideally the price.

### Testimonials

Nothing builds trust like hearing from other families. Aim for 3-5 testimonials. Include the name (first name is fine) and context.

### Contact page

Make it ridiculously easy to get in touch. Email, phone, a simple contact form. Include your service area.

## Getting found on Google

A beautiful website is useless if nobody can find it. You need basic SEO.

- Include your location in your page titles ("Birth Doula in Bristol")
- Set up a Google Business Profile
- Get listed in doula directories (Doula UK, Find My Doula)
- Write a blog (like this one)

## Skip the DIY

If you would rather not spend weekends wrestling with Squarespace, BirthBuild does all of this for you. Chat with our AI, answer a few questions about your practice, and have a professional website live in under an hour.
```

**Step 2: Create `blog/content/doula-website-checklist.md`**

```markdown
---
title: "What Every Doula Website Needs: The Complete Checklist"
slug: doula-website-checklist
description: "A comprehensive checklist of everything your doula website needs. Homepage anatomy, about page, services, testimonials, SEO essentials."
category: website-building
date: "2026-02-17"
keywords:
  - doula website checklist
  - what to put on doula website
faq:
  - q: "What pages should a doula website have?"
    a: "At minimum: homepage, about page, services page, testimonials page, and contact page. A blog and FAQ page are excellent additions for SEO."
  - q: "Should I include pricing on my doula website?"
    a: "Yes. Research shows that including pricing helps with SEO, qualifies leads, and reduces time-wasting enquiries. You can list starting-from prices or package ranges."
relatedSlugs:
  - how-to-build-a-doula-website
  - doula-website-examples
---

Building a doula website can feel overwhelming. What goes where. What to write. What to leave out.

This checklist breaks it down. Print it off. Work through it section by section. Tick things off as you go.

## Homepage essentials

Your homepage is your shop window. Most visitors decide within three seconds whether to stay or leave.

- Clear headline stating what you do and where you are based
- Professional photo of yourself
- One primary call to action above the fold
- Brief summary of your services
- At least one testimonial
- Your service area mentioned clearly

## About page must-haves

Your about page will be the most visited page on your site. Write it for your clients, not for yourself.

- Opening paragraph focused on what families get from working with you
- Your personal story and what drew you to birth work
- Your training and qualifications
- A warm, approachable photo
- Doula UK badge or other accreditation logos

## Services page

Be specific. Vague service descriptions do not convert.

- Each service listed with clear description
- What is included in each package
- Pricing or starting-from prices
- How to book or next steps
- Any extras or add-ons

## Contact page

Make it as easy as possible for families to reach you.

- Contact form with name, email, and message fields
- Email address (visible, not just the form)
- Phone number if you are happy to share
- Service area or areas you cover
- Response time expectation

## SEO basics

A beautiful site is pointless if families cannot find it.

- Unique page title for every page
- Meta description for every page
- Your location mentioned on every page
- Google Business Profile set up and verified
- Listed in at least two doula directories
- Schema.org structured data for local business

If this feels like a lot, BirthBuild handles every item on this checklist automatically. Just chat with the AI and your site is built to best practice from the start.
```

**Step 3: Create `blog/content/doula-website-examples.md`**

```markdown
---
title: "Doula Website Examples: 10 Sites That Work and Why"
slug: doula-website-examples
description: "A curated collection of doula website examples with annotations on what works. Real inspiration for your own birth work website."
category: website-building
date: "2026-02-15"
keywords:
  - doula website examples
  - doula website inspiration
  - doula website design
faq:
  - q: "What makes a good doula website?"
    a: "A good doula website clearly states who you are, what you offer, and where you are based. It loads fast, works on mobile, includes testimonials, and makes it easy to get in touch."
relatedSlugs:
  - how-to-build-a-doula-website
  - doula-website-checklist
---

Looking at other doula websites is the fastest way to figure out what you want yours to look and feel like.

We have reviewed dozens of birth worker websites. Here are ten that work particularly well and why.

## What the best doula websites have in common

Before we get to the examples, there are clear patterns across the sites that perform best.

- Warm, earthy colour palettes (sage greens, soft pinks, cream)
- Professional photos that feel approachable, not corporate
- Clear headlines that say what they do and where
- Testimonials front and centre
- Simple navigation with no more than six menu items
- Mobile-first design

## The examples

Every website below gets the basics right. But each one also does something particularly well that is worth learning from.

### Clear messaging

The best sites answer "what do you do and who is it for" within three seconds of landing on the homepage. No jargon. No clever wordplay. Just clarity.

### Trust signals

Doula UK badges, training provider logos, testimonials with real names. These small details make a measurable difference in how many visitors get in touch.

### Easy contact

The top-performing doula websites make it almost impossible not to find the contact information. Sticky headers with phone numbers. Contact buttons on every page. No hunting required.

## Build your own

If any of these sites inspired you, BirthBuild can help you create something just as polished. The AI asks you the right questions and builds your site around your unique practice.
```

**Step 4: Create `blog/content/doula-website-seo.md`**

```markdown
---
title: "Doula Website SEO: How to Rank Locally Without the Tech Overwhelm"
slug: doula-website-seo
description: "Local SEO simplified for doulas. Keywords, Google Business Profile, directory listings, and what actually moves the needle."
category: marketing-seo
date: "2026-02-13"
keywords:
  - doula website SEO
  - SEO for doulas
  - doula SEO tips
faq:
  - q: "Does SEO really matter for doulas?"
    a: "Yes. Most families start their search for a doula online. If your website does not appear when someone searches 'doula near me' or 'birth doula [your city]' you are invisible to those families."
  - q: "How long does SEO take to work?"
    a: "For a new doula website targeting local keywords, expect to see meaningful results in 3-6 months. Some improvements like Google Business Profile can drive traffic within weeks."
relatedSlugs:
  - how-to-build-a-doula-website
  - doula-website-checklist
---

SEO sounds technical. It sounds like something you need a specialist for. It sounds expensive.

For a local doula business, it is none of those things.

## What SEO actually means for doulas

SEO stands for search engine optimisation. For a doula, it means one thing: showing up when families in your area search for support.

The searches that matter to you are local. "Doula near me." "Birth doula Bristol." "Postnatal doula South London." These are the searches you want to appear for.

## The three things that actually matter

You do not need to understand algorithms or build backlinks. For a local doula business, three things drive 90% of your results.

### Google Business Profile

This is the single most important thing you can do for local SEO. It is free. It takes 20 minutes to set up. And it is what powers the map results when someone searches "doula near me."

### Location keywords on your website

Make sure your website mentions your location on every page. In your page titles. In your headings. In your service descriptions. "Birth doula support in Bristol and surrounding areas."

### Directory listings

Get listed in every relevant directory. Doula UK. Find My Doula. The Doula Directory. NCT. Each listing is a signal to Google that your business is real and operates where you say it does.

## What you can skip

You do not need to blog every week. You do not need to obsess over meta tags. You do not need to hire an SEO consultant.

Get the three basics right and let time do its work.

BirthBuild builds local SEO into every site automatically. Schema markup, location-specific content, semantic HTML, and unique meta tags on every page. One less thing to think about.
```

**Step 5: Commit**

```bash
git add blog/content/
git commit -m "feat(blog): add sample articles for build testing"
```

---

### Task 8: Wire Up npm Script and Test the Build

**Files:**
- Modify: `package.json` (add `build:blog` script)

**Step 1: Add npm script to `package.json`**

Add to the `"scripts"` section:

```json
"build:blog": "tsx blog/build-blog.ts"
```

The full scripts block should be:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "build:blog": "tsx blog/build-blog.ts",
  "preview": "vite preview"
}
```

**Step 2: Run the build**

```bash
npm run build:blog
```

Expected output:

```
Building blog...
Found 4 posts
Built: /blog/index.html
Built: /blog/how-to-build-a-doula-website/index.html
Built: /blog/doula-website-checklist/index.html
Built: /blog/doula-website-examples/index.html
Built: /blog/doula-website-seo/index.html
Built: /blog/sitemap.xml

Done! 4 posts built to /path/to/public/blog
```

**Step 3: Verify output files exist**

```bash
ls -la public/blog/
ls -la public/blog/how-to-build-a-doula-website/
cat public/blog/sitemap.xml
```

Expected: `index.html` in each directory, valid sitemap XML.

**Step 4: Check HTML for structured data**

```bash
grep -c "application/ld+json" public/blog/how-to-build-a-doula-website/index.html
```

Expected: `3` (Article, FAQPage, BreadcrumbList)

**Step 5: Check HTML for TOC**

```bash
grep "toc-link" public/blog/how-to-build-a-doula-website/index.html | head -5
```

Expected: Several `<a class="toc-link"` entries matching the H2 headings.

**Step 6: Add `public/blog/` to `.gitignore`**

The built output is generated and should not be committed. Add to `.gitignore`:

```
# Blog build output
public/blog/
```

**Step 7: Commit**

```bash
git add package.json .gitignore
git commit -m "feat(blog): add build:blog npm script and ignore build output"
```

---

### Task 9: Visual QA in Browser

**Step 1: Rebuild and serve**

```bash
npm run build:blog && npx serve public
```

**Step 2: Check blog index**

Open `http://localhost:3000/blog` in a browser. Verify:

- Nav renders with "Blog" highlighted
- Section header with title and subtitle
- Category filter pills are visible and clickable
- Featured post card renders with correct content
- Post grid shows remaining 3 articles
- Clicking a category filters the grid
- Footer renders correctly
- Mobile responsive (resize to 375px width)

**Step 3: Check article page**

Open `http://localhost:3000/blog/how-to-build-a-doula-website`. Verify:

- "Back to Blog" link works
- Category pill and reading time display
- Title, date render correctly
- Sticky TOC visible on left (desktop)
- TOC highlights update on scroll
- TOC links smooth-scroll to sections
- Article prose typography matches design spec
- Blockquotes styled correctly
- CTA banner renders with sage background
- Related posts show 2 cards
- FAQ section with collapsible details
- Mobile: TOC collapses to dropdown

**Step 4: Check structured data**

Use browser DevTools > Elements > search for `ld+json`. Verify Article, FAQPage, and BreadcrumbList scripts are present and contain correct data.

**Step 5: Fix any visual issues found during QA**

Adjust CSS or templates as needed. Re-run `npm run build:blog` to test changes.

**Step 6: Commit any fixes**

```bash
git add blog/
git commit -m "fix(blog): visual QA adjustments"
```

---

### Task 10: Update Landing Page Nav and Add Blog Link

**Files:**
- Modify: `index.html` (add Blog link to nav and footer)

**Step 1: Add "Blog" to the landing page nav links**

In `index.html`, find the `.nav-links` div and add a Blog link:

```html
<div class="nav-links">
  <a href="#how">How It Works</a>
  <a href="#features">Features</a>
  <a href="/blog">Blog</a>
  <a href="#instructors">For Instructors</a>
  <a href="#pricing">Pricing</a>
  <a href="/app" class="nav-cta">Get Started</a>
</div>
```

**Step 2: Add "Blog" to the landing page footer**

In `index.html`, find the Product footer column and add Blog:

```html
<div class="footer-col">
  <h4>Product</h4>
  <a href="#features">Features</a>
  <a href="#pricing">Pricing</a>
  <a href="#instructors">For Instructors</a>
  <a href="/blog">Blog</a>
  <a href="#">Examples</a>
</div>
```

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Blog link to landing page nav and footer"
```

---

### Task 11: Integrate Blog Build into Main Build Pipeline

**Files:**
- Modify: `package.json` (update `build` script)

**Step 1: Update the `build` script to include blog**

Change the build script to run the blog build after the Vite build:

```json
"build": "tsc -b && vite build && tsx blog/build-blog.ts"
```

This ensures the blog is built alongside the app when deploying. The blog output goes to `public/blog/` which Vite copies to `dist/blog/` during build.

Wait — Vite copies `public/` contents to `dist/` at build time. But we generate into `public/blog/` *after* Vite runs. We need to reverse the order or run blog build first:

```json
"build": "tsx blog/build-blog.ts && tsc -b && vite build"
```

This way:
1. Blog builds into `public/blog/`
2. Vite copies `public/` (including `public/blog/`) into `dist/`

**Step 2: Remove `public/blog/` from `.gitignore`**

Actually, since `vite build` copies from `public/`, and we run blog build *before* vite build, the output will be in `dist/blog/`. The `public/blog/` files are intermediate. We should keep them in `.gitignore`.

But wait: `npm run dev` (Vite dev server) also serves `public/` directly. So if we pre-build the blog, it will be served during development too. This is correct behaviour.

The build order is:

```json
"build": "tsx blog/build-blog.ts && tsc -b && vite build",
"build:blog": "tsx blog/build-blog.ts"
```

**Step 3: Test the full build**

```bash
npm run build
```

Expected: Blog builds first, then TypeScript checks, then Vite bundles everything. `dist/blog/` should contain the blog HTML files.

**Step 4: Verify blog in dist output**

```bash
ls dist/blog/
ls dist/blog/how-to-build-a-doula-website/
```

**Step 5: Commit**

```bash
git add package.json
git commit -m "feat: integrate blog build into main build pipeline"
```

---

## Summary

| Task | Description | Commit |
|---|---|---|
| 1 | Feature branch + dependencies | `chore: add blog build dependencies` |
| 2 | Directory structure + CSS | `feat(blog): add directory structure, CSS, and author data` |
| 3 | Template partials | `feat(blog): add HTML template partials` |
| 4 | Index page template | `feat(blog): add blog index page template` |
| 5 | Post page template | `feat(blog): add article page template with sticky TOC and FAQ` |
| 6 | Build script | `feat(blog): add build script for Markdown-to-HTML compilation` |
| 7 | Sample articles | `feat(blog): add sample articles for build testing` |
| 8 | npm script + test build | `feat(blog): add build:blog npm script` |
| 9 | Visual QA in browser | `fix(blog): visual QA adjustments` |
| 10 | Landing page nav/footer update | `feat: add Blog link to landing page nav and footer` |
| 11 | Integrate into main build | `feat: integrate blog build into main build pipeline` |
