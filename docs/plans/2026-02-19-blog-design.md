# Blog Design — Index & Article Pages

**Date:** 2026-02-19
**Status:** Approved
**Branch:** feature/blog-pages

## Overview

Static blog for birthbuild.com supporting 50 articles published over 3 months. Markdown source files compiled to static HTML via a custom TypeScript build script. Design inherits the landing page's visual language (Cormorant Garamond + Outfit fonts, sage/sand/cream palette, organic warmth, generous whitespace).

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Content management | Markdown + build step | Easy to author 50 articles, no CMS dependency, pure static output |
| Index layout | Magazine layout | Featured hero post, category filter pills, 3-column card grid |
| Article layout | Centred prose + sticky TOC | Best for SEO (jump links in SERPs), agentic SEO (structured H2 passages), and reading UX |
| Categories | Reader-friendly labels | Maps funnel stages (BOFU/MOFU/TOFU) to human labels |
| Build tooling | Custom TypeScript script | No framework dependency, matches hand-crafted landing page philosophy |
| URL structure | `/blog/{slug}` clean URLs | `public/blog/{slug}/index.html` on disk, Netlify serves as clean URLs |

## Categories

| Label | Funnel Stage | Articles |
|---|---|---|
| Website Building | BOFU | 1-11 |
| Marketing & SEO | MOFU (marketing) | 12-20 |
| Website Strategy | MOFU (strategy) | 21-24 |
| Starting Out | TOFU (business) | 25-30 |
| Birth Education | TOFU (education) | 31-38 |
| Industry & Tech | Agentic + Partners | 39-47 |
| Community | Seasonal | 48-50 |

## File Structure

```
blog/
├── content/                          # Markdown source files
│   ├── best-website-builder-for-doulas.md
│   ├── birthbuild-vs-squarespace.md
│   ├── ...
│   └── _data/
│       └── authors.json              # Author metadata
├── templates/
│   ├── partials/
│   │   ├── head.html                 # Shared <head>
│   │   ├── nav.html                  # Landing page nav + Blog link
│   │   ├── footer.html               # Landing page footer
│   │   ├── cta-banner.html           # Post-article CTA
│   │   └── post-card.html            # Reusable article card
│   ├── index.html                    # Blog index template
│   └── post.html                     # Single article template
├── assets/
│   └── blog.css                      # Blog-specific styles
└── build-blog.ts                     # Build script
```

**Output** (generated into public/):

```
public/
├── blog/
│   ├── index.html                                    # Blog index
│   ├── sitemap.xml                                   # Blog sitemap
│   ├── how-to-build-a-doula-website/index.html       # Article
│   ├── birthbuild-vs-squarespace/index.html          # Article
│   └── ...
```

## Frontmatter Schema

```yaml
---
title: "How to Build a Doula Website That Actually Books Clients"
slug: how-to-build-a-doula-website
description: "Step-by-step guide to building a doula website that converts."
category: website-building
date: 2026-02-19
updated: 2026-02-19
readingTime: 8
featured: true
keywords:
  - how to build a doula website
  - doula website
faq:
  - q: "How much does it cost to build a doula website?"
    a: "Costs range from £0 (DIY) to £2,000-5,000 for a custom designer."
relatedSlugs:
  - doula-website-checklist
  - doula-website-examples
---
```

## Blog Index Page

### Header
- Shared nav from landing page with "Blog" link added and highlighted
- Section label: "BLOG" (uppercase, sage, 0.75rem, letter-spacing 0.12em)
- Title: "Resources for birth workers" (Cormorant Garamond, same sizing as landing page section-title)
- Subtitle: descriptive paragraph (Outfit, text-light, font-weight 300)

### Category Filter
- Horizontal scrollable pill buttons
- Styled like landing page `.chat-choice` buttons
- Active: sage bg, white text (like `.nav-cta`)
- Inactive: white bg, sage-pale border, sage text
- Filtering via vanilla JS, state in URL hash (`/blog#marketing-seo`)
- "All" selected by default

### Featured Post
- Full-width card, sage-pale background, 16px border-radius, 2.5rem padding
- Category pill + reading time meta
- Title in Cormorant Garamond, 1.8rem
- Excerpt in Outfit, text-light
- Date + "Read article ->" link in sage
- Hover: translateY(-4px) + box-shadow

### Post Grid
- 3 columns desktop, 2 tablet, 1 mobile
- gap: 2rem
- Cards: white bg, 16px radius, 1px border rgba(95,113,97,0.06), 2rem padding
- Category pill: sage-pale bg, sage text, 100px radius, 0.75rem
- Title: Cormorant Garamond, 1.2rem, font-weight 500
- Excerpt: Outfit, 0.9rem, text-light, 2-line clamp
- Date + read time: text-muted, 0.8rem
- Hover: translateY(-4px), shadow, border-color darken

### Bottom CTA
- Same as landing page `.final-cta` section

### Footer
- Shared with landing page

## Single Article Page

### Article Header
- max-width 720px, centred
- "Back to Blog" link (sage, small, left arrow)
- Category pill + reading time
- Title: Cormorant Garamond, clamp(2rem, 4vw, 3rem), font-weight 300
- Date: text-muted, 0.85rem
- 1px divider in sand-dark

### TOC Sidebar (Desktop)
- ~200px wide, positioned left of article column
- `position: sticky; top: 6rem`
- "On this page" heading (0.75rem, uppercase, text-muted)
- Links: 0.8rem, text-muted
- Active link: sage, font-weight 500, 2px left border sage
- Tracks scroll position via IntersectionObserver on H2s
- Smooth scroll on click

### TOC Mobile (< 1024px)
- Collapsible dropdown below article header
- "On this page ▾" toggle
- Expands to show full list

### Article Prose
- max-width: 720px, centred
- H2: Cormorant Garamond, 1.6rem, weight 400, sage colour, 3rem top / 1rem bottom margin
- H3: Cormorant Garamond, 1.25rem, weight 500, text colour, 2rem top margin
- Body: Outfit, 1.05rem, weight 300, text colour, line-height 1.8
- Bold: Outfit, weight 500
- Links: sage, underline on hover
- Blockquote: Cormorant Garamond italic, 1.1rem, text-light, 4px left border sage, sage-pale bg, 1.5rem padding
- Code inline: monospace, 0.9rem, sage-pale bg, 2px 6px padding, 4px radius
- Lists: Outfit 0.95rem, sage-coloured disc/number
- Images: break out to ~900px max-width, with caption below (0.8rem, text-muted, centred)

### CTA Banner
- sage (#5f7161) background, white text
- 16px border-radius, 3rem padding, max-width 720px
- Heading: Cormorant Garamond, 1.4rem, white, weight 300
- Body: Outfit, 0.95rem, white 0.8 opacity
- Button: white bg, sage text, pill shape

### Related Posts
- "Related Posts" section label
- 3-column grid using same post-card component as index
- Driven by `relatedSlugs` frontmatter, fallback to same-category

### FAQ Section
- Collapsible `<details>`/`<summary>` for no-JS fallback
- FAQ JSON-LD schema in `<head>`
- Borders: 1px sand-dark
- Question: Outfit 0.95rem, weight 500
- Answer: Outfit 0.9rem, weight 300, text-light
- Toggle arrow: sage, rotates on open

### SEO & Structured Data
- `<title>`: "{Article Title} | BirthBuild Blog"
- `<meta name="description">`: from frontmatter
- Open Graph: og:title, og:description, og:type=article, og:url
- Twitter Card: summary_large_image
- `<link rel="canonical">`: `https://birthbuild.com/blog/{slug}`
- JSON-LD Article: @type Article, headline, datePublished, dateModified, author
- JSON-LD FAQPage: Question/Answer pairs from frontmatter
- JSON-LD BreadcrumbList: Home > Blog > Article Title

## Responsive Breakpoints

| Breakpoint | Index Grid | TOC | Article Width |
|---|---|---|---|
| > 1200px | 3 columns | Sticky sidebar left | 720px centred |
| 768-1200px | 2 columns | Sticky sidebar left | 720px centred |
| < 768px | 1 column | Collapsible dropdown | Full width - padding |

## Build Script Responsibilities

1. Read all `.md` files from `blog/content/`
2. Parse YAML frontmatter with `gray-matter`
3. Convert Markdown to HTML with `marked`
4. Extract H2 headings to generate TOC
5. Compute reading time from word count
6. Inject into HTML templates (partials composed together)
7. Generate FAQ JSON-LD and Article JSON-LD
8. Output to `public/blog/{slug}/index.html`
9. Generate `public/blog/index.html` with all posts sorted by date
10. Generate `public/blog/sitemap.xml`
11. npm script: `"build:blog": "npx tsx blog/build-blog.ts"`

## Dependencies (new)

- `marked` — Markdown to HTML
- `gray-matter` — YAML frontmatter parsing
- `glob` — file discovery (or use Node's built-in `fs.glob` in Node 22+)
