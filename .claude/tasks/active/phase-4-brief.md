# Implementation Brief

**Task:** Build Pipeline & Deploy
**Phase:** 4
**Branch:** `phase-4-build-pipeline-deploy`
**PR Title:** `Phase 4: Build Pipeline & Deploy`
**Priority:** P0
**Created:** 2026-02-15T18:53:00Z
**Created by:** Coordinator

---

## Summary

Implement the full site generation and deployment pipeline. A build Edge Function receives a site_spec ID, validates completeness, generates static HTML/CSS/JS for all selected pages, creates a wordmark SVG, bundles into a zip, and deploys to Netlify via their Deploy API. Subdomain provisioning ensures each site gets a unique `[slug].birthbuild.com` URL. Build status is tracked in real-time via Supabase Realtime. The PreviewTab is enhanced with an active build button, subdomain input, and preview iframe. The preview route gets a full-page iframe view.

**Recommended architecture:** Client generates site HTML/CSS/JS using `src/lib/site-generator.ts`, sends the generated file list as JSON to the Edge Function. The Edge Function handles validation, zip creation, Netlify deploy, and status updates. This keeps generation logic DRY (one place, not duplicated in Deno runtime).

## Architecture Rules (MUST follow)

1. **TypeScript strict mode** — no `any`, `noUnusedLocals`, `noUnusedParameters`
2. **Functional components only** — no class components
3. **Named exports** — no default exports except route pages (preview.tsx)
4. **Custom hooks** for Supabase interactions — components never call Supabase directly
5. **Tailwind only** — no inline styles in PWA components, no CSS modules (exception: generated static sites use inline CSS since Tailwind unavailable)
6. **British English** in all user-facing copy — colour, organisation, labour, specialise
7. **Optimistic updates** — write to local state immediately, sync to Supabase, rollback on error
8. **Accessible by default** — labels, ARIA attributes, keyboard navigable
9. **No dangerouslySetInnerHTML** — React-based rendering only in the PWA admin
10. **Generic error messages** to users, detailed logs to console.error()
11. **RLS enforced** — students see only their own data; Edge Functions use service role only for tenant lookup + status updates
12. **Edge Functions as API proxy** — Netlify API key never exposed to client
13. **HTML escaping** — ALL user-provided text must be escaped before inserting into generated HTML via `escapeHtml()`. This is critical since user content becomes public web pages.

---

## Implementation Steps

### Loop 1: Palette/Typography Config & Wordmark Generator

**Create:**
- `src/lib/palettes.ts` — Shared palette and typography definitions
  - Export `PALETTES` array with 4 preset palettes (extract from PaletteSelector — same data, shared location):
    - sage_sand: { background: "#f5f0e8", primary: "#5f7161", accent: "#a8b5a0", text: "#2d2d2d", cta: "#5f7161" }
    - blush_neutral: { background: "#fdf6f0", primary: "#c9928e", accent: "#e8cfc4", text: "#3d3d3d", cta: "#c9928e" }
    - deep_earth: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a67c52", text: "#2b2b2b", cta: "#6b4c3b" }
    - ocean_calm: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#7ca5b8", text: "#2c3e50", cta: "#3d6b7e" }
  - Export `getPaletteColours(palette: PaletteOption, customColours: CustomColours | null): CustomColours`
  - Export `TYPOGRAPHY_CONFIG`: modern → Inter/Inter, classic → Playfair Display/Source Sans 3, mixed → DM Serif Display/Inter

- `src/lib/wordmark.ts` — Wordmark SVG generation
  - `generateWordmark(businessName: string, fontFamily: string, primaryColour: string, style: StyleOption): string`
  - Returns SVG string with `<text>` element, proper `viewBox`, `role="img"`, `<title>` for accessibility
  - Style variants: modern (clean), classic (decorative divider below text), minimal (thin weight)
  - XML-escape special characters in business name

**Modify:**
- `src/components/dashboard/PaletteSelector.tsx` — Import `PALETTES` from `src/lib/palettes.ts` instead of inline definition. Remove the local `PALETTES` array and `PaletteDefinition` interface. The component should import and use the shared `PALETTES` and the `PaletteDefinition` type from palettes.ts.

**Verify:**
- `npm run build && npx tsc --noEmit`
- PaletteSelector still works with extracted palette data

### Loop 2: Page Generators (Home, About, Services, Contact, Testimonials, FAQ)

**Create:**
- `src/lib/pages/shared.ts` — Shared HTML generation utilities
  - `escapeHtml(text: string): string` — Escape `<`, `>`, `&`, `"`, `'`
  - `generateHead(spec: SiteSpec, pageTitle: string, pageDescription: string): string` — `<head>` with charset, viewport, title, meta description, OG tags, Google Fonts `<link>`, inline `<style>`
  - `generateNav(spec: SiteSpec, wordmark: string, activePage: string): string` — `<header>` with skip-to-content link, wordmark, `<nav>` with page links. Mobile: CSS-only hamburger using checkbox+label pattern.
  - `generateFooter(spec: SiteSpec): string` — copyright, social links (with aria-labels), privacy note
  - `generateCss(colours: CustomColours, headingFont: string, bodyFont: string, style: StyleOption): string` — CSS with custom properties (`--colour-bg`, `--colour-primary`, etc.), reset, typography, responsive layout, sections
  - `PhotoData` type: `{ purpose: string, publicUrl: string, altText: string }`

- `src/lib/pages/home.ts` — `generateHomePage(spec, photos, wordmark): string`
  - Hero section: h1 (business_name), tagline, CTA → contact page
  - Services overview cards (max 3, "View all" link if more)
  - Featured testimonial (first, if any)
  - About teaser with headshot photo (if uploaded)
  - Schema.org LocalBusiness JSON-LD
  - CTA section at bottom

- `src/lib/pages/about.ts` — `generateAboutPage(spec, photos, wordmark): string`
  - Bio text, headshot photo, philosophy (if provided)
  - Qualifications: Doula UK badge, training provider
  - CTA to contact

- `src/lib/pages/services.ts` — `generateServicesPage(spec, wordmark): string`
  - Card per service: title, description, price
  - CTA to contact per card

- `src/lib/pages/contact.ts` — `generateContactPage(spec, wordmark): string`
  - Netlify form: `<form name="contact" method="POST" data-netlify="true">` with name, email, message fields + hidden form-name
  - Email, phone, booking link, service area, social links

- `src/lib/pages/testimonials.ts` — `generateTestimonialsPage(spec, wordmark): string`
  - Only generated if "testimonials" in spec.pages and testimonials.length > 0
  - `<blockquote>` with `<cite>` per testimonial

- `src/lib/pages/faq.ts` — `generateFaqPage(spec, wordmark): string`
  - Only generated if faq_enabled
  - 6 hardcoded doula FAQ questions with `<details>`+`<summary>` accordion
  - Localised answers using spec.service_area

**Verify:**
- `npm run build && npx tsc --noEmit`

### Loop 3: Site Generator Integration

**Create:**
- `src/lib/site-generator.ts` — Master site generator
  - Types:
    - `GeneratedPage`: `{ filename: string, html: string }`
    - `GeneratedSite`: `{ pages: GeneratedPage[], sitemap: string, robots: string }`
  - `generateSite(spec: SiteSpec, photos: PhotoData[]): GeneratedSite`
    1. Resolve palette via `getPaletteColours()` (validate hex if custom, fallback to sage_sand on invalid)
    2. Resolve typography via `TYPOGRAPHY_CONFIG`
    3. Generate wordmark SVG
    4. For each page in spec.pages: call the corresponding page generator
    5. Generate `sitemap.xml` from page list
    6. Generate `robots.txt` with sitemap reference
    7. Return `GeneratedSite`
  - Validate custom colour hex values (SEC-017): regex `/^#[0-9a-fA-F]{6}$/`
  - Validate social link URLs (SEC-018): must start with `https://`, max 500 chars

**Verify:**
- `npm run build && npx tsc --noEmit`

### Loop 4: Build Edge Function (Deploy to Netlify)

**Create:**
- `supabase/functions/build/index.ts` — Build + Deploy Edge Function
  - **Auth pattern:** Same as chat/index.ts (JWT via Authorization header, getUser(), rate limit)
  - **Rate limit:** 5 builds/hour per user (separate from chat rate limit)
  - **CORS:** Same allowed origins as chat
  - **Request body:** `{ site_spec_id: string, files: Array<{ path: string, content: string }> }`
    - The client generates site files and sends them as JSON
    - Edge Function validates, creates zip, deploys to Netlify
  - **Flow:**
    1. Authenticate user via JWT
    2. Rate limit check
    3. Parse and validate request body
    4. Fetch site_spec via service role client, verify user_id matches
    5. Validate spec completeness: business_name, doula_name, service_area, services.length >= 1, email required
    6. Set status to "building": `UPDATE site_specs SET status = 'building'`
    7. Generate subdomain slug if not set: slugify(doula_name), check uniqueness, append random suffix if taken
    8. Create zip from files array (use Deno compression — `https://deno.land/x/zipjs/index.js` or manual zip creation)
    9. Create Netlify site if no netlify_site_id (POST `/api/v1/sites`), or update existing
    10. Deploy zip (POST `/api/v1/sites/{id}/deploys` with zip body)
    11. Update site_spec: status = "live", deploy_url = `https://{slug}.birthbuild.com`, netlify_site_id, subdomain_slug
    12. Return `{ success: true, deploy_url }`
  - **On error:** Set status to "error" before returning generic error message
  - **Environment vars required:** `NETLIFY_API_TOKEN`
  - **Subdomain slugify:** lowercase, replace non-alphanumeric with hyphens, collapse consecutive hyphens, trim, max 63 chars
  - **Zip size limit:** Max 50MB

**Verify:**
- `npx tsc --noEmit` (main project still compiles)

### Loop 5: useBuild Hook with Realtime Status

**Create:**
- `src/hooks/useBuild.ts` — Build trigger + realtime status tracking
  - `useBuild(siteSpec: SiteSpec | null)`
  - Returns `{ building, buildError, triggerBuild, lastBuildStatus }`
  - `triggerBuild()`:
    1. Validate required fields locally first (business_name, doula_name, service_area, services.length >= 1, email)
    2. If validation fails, set buildError with missing fields message, return
    3. Fetch photos from Supabase for this siteSpec.id, get public URLs
    4. Call `generateSite(siteSpec, photos)` from `src/lib/site-generator.ts`
    5. Convert GeneratedSite to files array (pages as .html, sitemap.xml, robots.txt)
    6. Call `supabase.functions.invoke("build", { body: { site_spec_id, files } })`
    7. Handle response
  - **Realtime subscription:**
    - `useEffect` subscribes to `postgres_changes` on `site_specs` table, filter `id=eq.${siteSpec.id}`
    - On change: update `lastBuildStatus` (status, deploy_url, subdomain_slug)
    - Cleanup: unsubscribe on unmount
  - `building` derived from lastBuildStatus === "building"

**Verify:**
- `npm run build && npx tsc --noEmit`

### Loop 6: Enhanced PreviewTab + Preview Route

**Modify:**
- `src/components/dashboard/PreviewTab.tsx` — Replace placeholder with full build UI
  - Props: add `onFieldChange: (partial: Partial<SiteSpec>) => void` to existing PreviewTabProps
  - Add `useBuild(siteSpec)` hook
  - **Build Status Card** (enhanced):
    - Active "Build My Site" button (status === "draft" or "error") / "Rebuild" button (status === "live")
    - Disabled + spinner while building
    - Validation check before build: show inline warning listing missing required fields
    - Building animation: "Building your site..." with a pulsing progress bar
    - Error: show error message + "Try Again" button
    - Live: show success message with link to live site
  - **Subdomain Input** (new section):
    - Input showing subdomain slug, auto-suggested from doula_name if empty
    - Preview: `{slug}.birthbuild.com`
    - Slugify on change, save via onFieldChange({ subdomain_slug: value })
    - Read-only after successful deploy (status === "live")
  - **Preview Iframe** (new section, only when deploy_url exists):
    - Sandboxed iframe: `sandbox="allow-scripts allow-same-origin"`
    - Responsive container
    - Device toggle buttons: Mobile (375px), Tablet (768px), Desktop (100%)
    - "Open in new tab" link
  - Keep existing Site Summary section below
  - Keep existing "Return to Chat" link

- `src/routes/preview.tsx` — Replace stub with full-page preview
  - Uses `useAuth()` and `useSiteSpec()` hooks
  - If no siteSpec or no deploy_url: show message "No site built yet" with link to dashboard
  - Full-screen iframe with deploy_url
  - Top toolbar: back to dashboard, device toggles, "Open in new tab"

**Verify:**
- `npm run build && npx tsc --noEmit`
- PreviewTab renders in all states (draft, building, live, error)
- Preview route shows full-page iframe when deploy_url exists

### Loop 7: Build Verification

**Verify:**
- `npm run build` — 0 errors
- `npx tsc --noEmit` — passes
- All new files compile cleanly
- No unused imports or variables
- PaletteSelector still works with extracted shared palettes
- Type-safe throughout: no `any` types

---

## Files Summary

### Files to Modify
- `src/components/dashboard/PreviewTab.tsx` — Replace placeholder with build button, subdomain input, preview iframe
- `src/components/dashboard/PaletteSelector.tsx` — Import PALETTES from shared lib instead of inline
- `src/routes/preview.tsx` — Replace stub with full-page preview iframe

### Files to Create
- `src/lib/palettes.ts`
- `src/lib/wordmark.ts`
- `src/lib/pages/shared.ts`
- `src/lib/pages/home.ts`
- `src/lib/pages/about.ts`
- `src/lib/pages/services.ts`
- `src/lib/pages/contact.ts`
- `src/lib/pages/testimonials.ts`
- `src/lib/pages/faq.ts`
- `src/lib/site-generator.ts`
- `src/lib/build.ts`
- `src/hooks/useBuild.ts`
- `supabase/functions/build/index.ts`

---

## Acceptance Criteria

- [ ] Static site generator produces valid HTML5 with semantic landmarks for all page types
- [ ] Generated sites use correct palette colours and typography as CSS custom properties
- [ ] Wordmark SVG generated correctly for all 3 styles (modern, classic, minimal)
- [ ] Build Edge Function: authenticates, rate-limits, validates spec, deploys to Netlify
- [ ] Subdomain slug generated from doula_name, slugified, uniqueness enforced
- [ ] Build status tracked in real-time via Supabase Realtime (draft → building → live/error)
- [ ] PreviewTab shows active build button with validation warnings for missing fields
- [ ] PreviewTab shows building progress animation during build
- [ ] PreviewTab shows preview iframe with device toggles when site is live
- [ ] Preview route shows full-page iframe view
- [ ] All user-provided text escaped in generated HTML (escapeHtml)
- [ ] Custom colour values validated as hex format before rendering
- [ ] Social link URLs validated before rendering in generated HTML
- [ ] Netlify API token never exposed to client (Edge Function only)
- [ ] TypeScript strict mode passes: `npx tsc --noEmit`
- [ ] Production build succeeds: `npm run build`

---

## Security Notes

1. **HTML escaping is critical**: All user text (business_name, bio, tagline, service descriptions, testimonials, social links) MUST be escaped via `escapeHtml()` before inserting into generated HTML. User content becomes public web pages — XSS prevention is mandatory.
2. **Netlify API token**: Stored as `NETLIFY_API_TOKEN` environment variable in Edge Function. Never sent to client.
3. **Build rate limiting**: 5 builds/hour per user to prevent abuse.
4. **Spec ownership**: Edge Function verifies `site_spec.user_id === user.id` before building.
5. **Subdomain sanitisation**: Only allow `[a-z0-9-]`, max 63 chars. No reserved words.
6. **Zip size limit**: Cap at 50MB to prevent storage abuse.
7. **Custom colour validation** (SEC-017): Validate hex format `/^#[0-9a-fA-F]{6}$/` before rendering to CSS. Invalid values fallback to sage_sand palette.
8. **Social link validation** (SEC-018): Must start with `https://`, max 500 chars. Invalid links omitted from generated HTML.
9. **Photo URLs**: Already protected by storage policies (SEC-013). Public URLs used in generated HTML.

---

## Context

### Existing patterns to follow
- `supabase/functions/chat/index.ts` — Edge Function pattern: JWT auth, service role client, rate limiting, CORS, generic errors
- `src/hooks/useSiteSpec.ts` — Optimistic update + rollback pattern
- `src/components/dashboard/PreviewTab.tsx` — Existing build status badges and summary layout
- `src/components/dashboard/PaletteSelector.tsx` — PALETTES array with colour definitions (to be extracted)
- `src/lib/claude.ts` — Pattern for calling Edge Functions: `supabase.functions.invoke("name", { body })`
- `src/components/ui/Button.tsx` — variant/size/loading pattern for build button

### Key function locations
- `useSiteSpec().updateSiteSpec(partial)` — src/hooks/useSiteSpec.ts:60 — optimistic update with rollback
- `useAuth()` — src/hooks/useAuth.ts — user, profile, role
- `sendChatMessage({ messages })` — src/lib/claude.ts:54 — Edge Function invoke pattern to follow
- `supabase` client — src/lib/supabase.ts — typed Supabase client
- `PALETTES` array — src/components/dashboard/PaletteSelector.tsx:17 (to be extracted to lib/palettes.ts)
- `SiteSpec` type — src/types/site-spec.ts:61

### Build command
```bash
npm run build && npx tsc --noEmit
```
