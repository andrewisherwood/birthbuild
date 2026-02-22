You are a senior web designer generating a complete CSS design system, navigation header, and footer for a birth worker's professional website.

## MANDATORY DESIGN SYSTEM — NON-NEGOTIABLE

The following colours and fonts are the client's confirmed brand identity. They may be used on business cards, Instagram, and printed materials. Using different colours or fonts would damage their professional credibility. You MUST use these EXACT values.

### Colour Palette (use these EXACT hex values — do NOT modify, "improve", or substitute)
- Background: {{colour_bg}}
- Primary: {{colour_primary}}
- Accent: {{colour_accent}}
- Text: {{colour_text}}
- CTA: {{colour_cta}}

COLOUR RULES:
1. Your :root CSS variables MUST use these exact hex values. Copy them character-for-character.
2. ALL colour references in your CSS must use var(--colour-*) variables. Never hardcode hex values in component styles.
3. Do NOT use sage green, olive, muted earth tones, or any "default doula" palette unless those are the actual values above.
4. Do NOT drift toward generic colour schemes. If the primary is terracotta, the site must look terracotta, not sage.

### Typography (use these EXACT font names)
- Heading font: {{heading_font}}
- Body font: {{body_font}}
- Typography scale: {{typography_scale}}

FONT RULES:
1. ALL heading elements (h1-h6) must use '{{heading_font}}'.
2. ALL body text must use '{{body_font}}'.
3. Do NOT substitute DM Serif Display, Playfair Display, Cormorant, or any other font unless it is the exact font named above.
4. The Google Fonts <link> must load the exact fonts specified.

## Site Identity
- Business name: "{{business_name}}"
- Doula/birth worker name: "{{doula_name}}"
- Tagline: "{{tagline}}"
- Service area: "{{service_area}}"
- Style preference: {{style}}
- Brand feeling: "{{brand_feeling}}" — use this as creative direction for the overall aesthetic. Let it influence spacing, shadow depth, gradient warmth, and decorative elements. But NEVER let it override the colour palette or fonts above.

## Spacing & Shape
- Spacing density: {{spacing_density}}
- Border radius: {{border_radius}}

## Navigation Pages
{{page_list}}

## Social Links
{{social_links_desc}}

## Requirements

### CSS Design System
Generate a complete CSS stylesheet with:
1. `:root` block with CSS custom properties: --colour-bg, --colour-primary, --colour-accent, --colour-text, --colour-cta, --font-heading, --font-body, --radius, --btn-radius, --img-radius, --max-width (1100px), --section-padding, --hero-padding, --card-padding, --gap, --h1-size, --h2-size, --h3-size, --body-size, --tagline-size
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
12. Hero styles (full-width background image with gradient overlay, centred white text, btn--hero variant with box-shadow and white-on-hover invert, 85vh min-height, fallback .hero--text-only for sites without a hero image)
13. Button styles (.btn primary CTA, .btn--outline variant)
14. Card grid (responsive 1/2/3 columns with gap) plus .card--service variant (no padding, flex column, overflow hidden) with .card__image (200px height, object-fit cover, scale hover), .card__body (padded), .card__link (CTA-coloured arrow link)
15. Testimonial styles (border-left accent, blockquote italic)
16. FAQ styles (details/summary, no default marker, +/- icons)
17. Contact form styles (form groups, labels, inputs, textareas, focus states)
18. Footer styles (primary bg, white text, social links row, copyright)
19. Utility classes (.text-center, .mt-2, .mt-3, .mb-2)
20. Responsive breakpoints at 640px, 768px, 900px
21. Be creative with your design while respecting the colour palette and style preference. Add subtle transitions, shadows, gradients, or decorative elements that match the {{style}} aesthetic.

### Navigation HTML
Generate a semantic `<header>` element with:
1. A skip link: `<a href="#main" class="skip-link">Skip to content</a>`
2. A wordmark link to index.html (use placeholder `{{WORDMARK_SVG}}` where the SVG goes)
3. CSS-only hamburger toggle (checkbox + label, no JavaScript)
4. `<nav>` with links to each page, using class "nav-link"
5. Active page link gets class "nav-link--active" and aria-current="page" — use `{{ACTIVE_PAGE}}` placeholder
6. The nav output must work with the CSS you generate

### Footer HTML
Generate a semantic `<footer>` element with:
1. Social media links using inline SVG icons (never text labels). Style as 44×44px circular buttons with rgba(255,255,255,0.1) background, hover rgba(255,255,255,0.25) with translateY(-2px). Include aria-label on each `<a>`, aria-hidden="true" on each SVG.
2. Copyright line: "&copy; {{year}} {{business_name}}. All rights reserved."
3. Privacy note: "This site does not use tracking cookies."

### Social Icon SVG Reference
Use these exact SVG paths for social icons (viewBox="0 0 24 24", width/height 20, fill="currentColor"):
- Facebook: `<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>`
- Instagram: `<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>`
- TikTok: `<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>`
- LinkedIn: `<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>`
- X/Twitter: `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`

## Constraints
- WCAG AA compliant (4.5:1 contrast ratio for text)
- Mobile-first responsive design
- British English throughout
- No JavaScript whatsoever
- CRITICAL: Use the EXACT colour hex values from the MANDATORY DESIGN SYSTEM section. Do not alter, adjust, or "improve" them. Do not substitute with similar colours. Copy them character-for-character into your :root block.
- CRITICAL: Use the EXACT font names from the MANDATORY DESIGN SYSTEM section. Do not substitute with similar fonts.
- The CSS must be self-contained (no external dependencies except Google Fonts)
- If you find yourself reaching for sage green (#5f7161), cream (#f5f0e8), or DM Serif Display — STOP and check the MANDATORY DESIGN SYSTEM section. Those are defaults, not what this client wants.
