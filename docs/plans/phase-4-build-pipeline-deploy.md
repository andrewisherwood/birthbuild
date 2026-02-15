# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T18:52:00Z
**Total Phases:** 6

Phase 1: Foundation & Auth — ✅ Merged (PR #1)
Phase 2: Chatbot Onboarding — ✅ Merged (PR #2)
Phase 3: Dashboard Form Editor — ✅ Merged (PR #3)
Phase 4: Build Pipeline & Deploy — ⬅ Current
Phase 5: Instructor Admin — Pending
Phase 6: Polish & Integration Testing — Pending

---

# Detailed Plan: Phase 4 — Build Pipeline & Deploy

**Date:** 2026-02-15
**Status:** Approved
**Branch:** `phase-4-build-pipeline-deploy`

## Overview

Implement the full site generation and deployment pipeline. An Edge Function (`build`) receives a site_spec ID, validates completeness, generates static HTML/CSS/JS for all selected pages (home, about, services, contact, testimonials, FAQ), creates a wordmark SVG, bundles everything into a zip, and deploys to Netlify via their Deploy API. Subdomain provisioning ensures each site gets a unique `[slug].birthbuild.com` URL. Build status is tracked in real-time via Supabase Realtime subscriptions. The PreviewTab component is enhanced with an active build button, progress display, preview iframe, and subdomain input.

## Pre-existing Code

### Files to reference (patterns to follow)
- `supabase/functions/chat/index.ts` — Edge Function pattern: JWT auth, service role client, rate limiting, CORS, generic errors
- `src/hooks/useSiteSpec.ts` — Optimistic update + rollback pattern for updateSiteSpec
- `src/components/dashboard/PreviewTab.tsx` — Existing placeholder with build status badges and disabled build button
- `src/routes/preview.tsx` — Stub preview page
- `src/types/site-spec.ts` — Full SiteSpec interface with deploy fields (subdomain_slug, netlify_site_id, deploy_url, status)
- `src/components/dashboard/PaletteSelector.tsx` — PALETTES array with all 4 preset colour definitions
- `src/lib/supabase.ts` — Supabase client initialisation
- `src/lib/claude.ts` — Pattern for calling Edge Functions via `supabase.functions.invoke()`

### Key types already defined
- `SiteSpecStatus: "draft" | "building" | "live" | "error"` (src/types/site-spec.ts:35)
- `subdomain_slug: string | null` (src/types/site-spec.ts:107)
- `netlify_site_id: string | null` (src/types/site-spec.ts:108)
- `deploy_url: string | null` (src/types/site-spec.ts:109)
- `StyleOption`, `PaletteOption`, `TypographyOption` (src/types/site-spec.ts:36-43)
- `ServiceItem`, `Testimonial`, `SocialLinks`, `CustomColours` (src/types/site-spec.ts:5-33)

### Database fields ready (no migration needed)
- `site_specs.subdomain_slug` — text, unique constraint
- `site_specs.netlify_site_id` — text
- `site_specs.deploy_url` — text
- `site_specs.status` — text, default 'draft'

## Architecture Rules (MUST follow)

1. **TypeScript strict mode** — no `any`, `noUnusedLocals`, `noUnusedParameters`
2. **Functional components only** — no class components
3. **Named exports** — no default exports except route pages (preview.tsx)
4. **Custom hooks** for Supabase interactions — components never call Supabase directly
5. **Tailwind only** — no inline styles, no CSS modules, no styled-components (exception: inline styles in generated static site HTML since Tailwind is not available there)
6. **British English** in all user-facing copy — colour, organisation, labour, specialise
7. **Optimistic updates** — write to local state immediately, sync to Supabase, rollback on error
8. **Accessible by default** — labels, ARIA attributes, keyboard navigable
9. **No dangerouslySetInnerHTML** — React-based rendering only in the PWA admin
10. **Generic error messages** to users, detailed logs to console.error()
11. **RLS enforced** — students see only their own data; Edge Functions use service role only for tenant_secrets lookup
12. **Edge Functions as API proxy** — Netlify API key never exposed to client. All deploy calls go through Edge Functions.

---

## Loops

### Loop 1: Static Site Generator Utilities & Palette/Typography Config

**Create:**

- `src/lib/palettes.ts` — Shared palette definitions (extract from PaletteSelector to avoid duplication)
  - Export `PALETTES` array with all 4 preset palette definitions (sage_sand, blush_neutral, deep_earth, ocean_calm)
  - Export `getPaletteColours(palette: PaletteOption, customColours: CustomColours | null): CustomColours` — resolves palette name to actual colour values
  - Export `TYPOGRAPHY_CONFIG` map:
    - modern: { heading: "Inter", body: "Inter" }
    - classic: { heading: "Playfair Display", body: "Source Sans 3" }
    - mixed: { heading: "DM Serif Display", body: "Inter" }

- `src/lib/site-generator.ts` — Static site HTML/CSS/JS generation from a SiteSpec
  - `generateSite(spec: SiteSpec, photos: PhotoData[]): GeneratedSite`
  - `GeneratedSite` type: `{ pages: GeneratedPage[], css: string, sitemap: string, robots: string, manifest: string }`
  - `GeneratedPage` type: `{ filename: string, html: string }`
  - Generates semantic HTML5 with proper landmark structure (`<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`)
  - CSS generated from palette colours and typography as CSS custom properties
  - Responsive mobile-first layout
  - `<html lang="en-GB">` on all pages
  - `PhotoData` type: `{ purpose: string, publicUrl: string, altText: string }`

- `src/lib/wordmark.ts` — Wordmark SVG generation
  - `generateWordmark(businessName: string, fontFamily: string, primaryColour: string, style: StyleOption): string`
  - Returns SVG string
  - Style variants: modern (clean sans), classic (decorative divider below), minimal (thin weight)
  - Uses `<text>` element with the heading font
  - Includes `viewBox` for proper scaling
  - Accessible: `role="img"` and `<title>` element

**Modify:**

- `src/components/dashboard/PaletteSelector.tsx` — Import `PALETTES` from `src/lib/palettes.ts` instead of defining inline (remove duplication)

**Verify:**
- `npm run build && npx tsc --noEmit`
- PaletteSelector still works with extracted palette data

---

### Loop 2: Page Generators (Home, About, Services, Contact, Testimonials, FAQ)

**Create:**

- `src/lib/pages/home.ts` — Home page HTML generator
  - `generateHomePage(spec: SiteSpec, photos: PhotoData[], wordmark: string): string`
  - Hero section: h1 (business_name), tagline, CTA button linking to contact page
  - Services overview cards from spec.services (max 3 shown, "View all" link if more)
  - Featured testimonial (first from list, if any)
  - About teaser with headshot photo (if available)
  - CTA section at bottom
  - Schema.org LocalBusiness JSON-LD in `<script type="application/ld+json">`

- `src/lib/pages/about.ts` — About page HTML generator
  - `generateAboutPage(spec: SiteSpec, photos: PhotoData[], wordmark: string): string`
  - Full bio text
  - Professional photo (headshot purpose)
  - Philosophy section (if provided)
  - Qualifications: Doula UK badge (if doula_uk), training provider
  - CTA to contact page

- `src/lib/pages/services.ts` — Services page HTML generator
  - `generateServicesPage(spec: SiteSpec, wordmark: string): string`
  - Card per service: title, description, price (if provided)
  - CTA button per service card linking to contact page

- `src/lib/pages/contact.ts` — Contact page HTML generator
  - `generateContactPage(spec: SiteSpec, wordmark: string): string`
  - Contact form (Netlify Forms: `<form name="contact" method="POST" data-netlify="true">`)
  - Fields: name, email, message, hidden form-name field
  - Email, phone (if provided), booking link (if provided)
  - Service area text
  - Social media links with aria-labels

- `src/lib/pages/testimonials.ts` — Testimonials page HTML generator
  - `generateTestimonialsPage(spec: SiteSpec, wordmark: string): string`
  - Only generated if "testimonials" in spec.pages
  - Each testimonial as `<blockquote>` with `<cite>` for attribution
  - Context shown below name

- `src/lib/pages/faq.ts` — FAQ page HTML generator
  - `generateFaqPage(spec: SiteSpec, wordmark: string): string`
  - Only generated if spec.faq_enabled
  - Standard doula FAQ questions (hardcoded 6 questions with localised answers using spec.service_area):
    1. "What does a doula do?"
    2. "When should I hire a doula?"
    3. "How is a doula different from a midwife?"
    4. "What if I have a birth plan change?"
    5. "Does my partner still have a role?"
    6. "How much does a doula cost?"
  - `<details>` + `<summary>` for accessible accordion (no JS needed)

- `src/lib/pages/shared.ts` — Shared HTML fragments
  - `generateHead(spec: SiteSpec, pageTitle: string, pageDescription: string): string` — `<head>` with meta tags, OG tags, Google Fonts link, CSS link
  - `generateNav(spec: SiteSpec, wordmark: string, activePage: string): string` — `<nav>` with skip link, wordmark, page links, mobile hamburger (CSS-only)
  - `generateFooter(spec: SiteSpec): string` — `<footer>` with copyright, social links, privacy note
  - `generateCss(colours: CustomColours, headingFont: string, bodyFont: string, style: StyleOption): string` — Full CSS with custom properties, reset, typography, layout, responsive breakpoints
  - `escapeHtml(text: string): string` — Escape `<`, `>`, `&`, `"`, `'` for safe HTML insertion

**Verify:**
- `npm run build && npx tsc --noEmit`
- All generators return valid HTML strings

---

### Loop 3: Site Generator Integration & Zip Bundler

**Modify:**

- `src/lib/site-generator.ts` — Wire up all page generators
  - Import all page generators from `src/lib/pages/`
  - Import `generateWordmark` from `src/lib/wordmark.ts`
  - Import `getPaletteColours`, `TYPOGRAPHY_CONFIG` from `src/lib/palettes.ts`
  - `generateSite` implementation:
    1. Resolve palette colours via `getPaletteColours()`
    2. Resolve typography via `TYPOGRAPHY_CONFIG`
    3. Generate wordmark SVG
    4. Generate CSS
    5. Generate each page based on `spec.pages` array
    6. Generate `sitemap.xml` from page list + spec.deploy_url
    7. Generate `robots.txt` with sitemap reference
    8. Return `GeneratedSite` object

- `src/lib/site-bundler.ts` — Zip creation utility
  - `bundleSite(site: GeneratedSite): Uint8Array`
  - Implements minimal zip format (no external dependency needed — use the standard zip structure with Deflate-stored entries)
  - Alternatively: create a simple tar/concatenation format that the Edge Function can unpack
  - **Decision:** Use a simple file-list format that the Edge Function sends to Netlify's zip deploy endpoint. The zip creation will happen in the Edge Function (Deno has `compress` module) — the client sends the generated file list as JSON.

**Create:**

- `src/lib/build.ts` — Build pipeline client
  - `triggerBuild(siteSpecId: string): Promise<BuildResult>`
  - Calls `supabase.functions.invoke("build", { body: { site_spec_id: siteSpecId } })`
  - `BuildResult` type: `{ success: boolean, deployUrl?: string, error?: string }`
  - Error handling with generic user-facing messages

**Verify:**
- `npm run build && npx tsc --noEmit`

---

### Loop 4: Build Edge Function

**Create:**

- `supabase/functions/build/index.ts` — Build + Deploy Edge Function
  - Follow the same auth pattern as `supabase/functions/chat/index.ts`:
    - JWT auth via Authorization header
    - Rate limiting (5 builds/hour per user)
    - CORS handling
    - Generic error messages

  - **Request body:** `{ site_spec_id: string }`

  - **Flow:**
    1. Authenticate user via JWT
    2. Rate limit check (5 builds/hour)
    3. Fetch site_spec via service role client (to bypass RLS and validate ownership via user_id check)
    4. Validate spec completeness: business_name, doula_name, service_area, services.length >= 1, email all required
    5. Set status to "building": `UPDATE site_specs SET status = 'building' WHERE id = spec_id AND user_id = user.id`
    6. Generate subdomain slug if not set: slugify(doula_name) with uniqueness check
    7. Fetch photos from photos table for this site_spec_id, get public URLs from storage
    8. Generate the static site (inline the generation logic — cannot import from src/lib in Deno Edge Functions)
    9. **IMPORTANT**: The site generation logic must be self-contained within the Edge Function since Deno runtime cannot import from the Vite/React src/ directory. Duplicate the necessary generation functions in the Edge Function.
    10. Create zip file using Deno's compression utilities
    11. Create or update Netlify site via Netlify API
    12. Deploy zip to Netlify
    13. Update site_spec: status = "live", deploy_url, netlify_site_id, subdomain_slug
    14. Return success response with deploy_url

  - **Netlify API calls:**
    - `POST https://api.netlify.com/api/v1/sites` (create site with custom domain) — first build only
    - `POST https://api.netlify.com/api/v1/sites/{site_id}/deploys` (deploy zip) — all builds
    - Auth: `Authorization: Bearer {NETLIFY_API_TOKEN}` from environment variable

  - **Subdomain slug generation:**
    - `slugify(name)`: lowercase, replace spaces/special chars with hyphens, remove consecutive hyphens, trim hyphens, max 63 chars
    - Check uniqueness against `site_specs.subdomain_slug` column
    - If taken: append random 4 chars (e.g., "shellie-poulter-a3f2")

  - **Error handling:**
    - On any failure after status set to "building": set status to "error" before returning
    - Never leave a spec stuck in "building" state
    - Return generic errors to client, log details server-side

  - **Security:**
    - Validate site_spec_id is a UUID format
    - Verify spec belongs to authenticated user (user_id check)
    - Netlify API token stored as environment variable, never exposed
    - Sanitise all user content before inserting into HTML (escapeHtml on all text fields)
    - Rate limit to prevent abuse (5 builds/hour)
    - Validate file size of generated zip before uploading (max 50MB)

**Verify:**
- `npx tsc --noEmit` (Edge Functions have separate TypeScript checking, but we verify main project still compiles)
- Manual testing instructions in brief

---

### Loop 5: useBuild Hook & Realtime Subscription

**Create:**

- `src/hooks/useBuild.ts` — Build trigger + realtime status tracking
  - `useBuild(siteSpecId: string | null)`
  - Returns `{ buildStatus, building, error, triggerBuild, deployUrl }`
  - `triggerBuild()`:
    1. Set local building state to true
    2. Call `supabase.functions.invoke("build", { body: { site_spec_id: siteSpecId } })`
    3. Handle response (success → update local state, error → show message)
  - **Realtime subscription:**
    - Subscribe to `site_specs` table changes filtered by `id=eq.${siteSpecId}`
    - Watch for `status`, `deploy_url`, `subdomain_slug` changes
    - Update local state when realtime event received (draft → building → live/error)
    - Unsubscribe on unmount via cleanup function
  - Loading state derived from status === "building"
  - Error state from build failure or realtime error event

**Verify:**
- `npm run build && npx tsc --noEmit`

---

### Loop 6: Enhanced PreviewTab + Subdomain Input + Preview Iframe

**Modify:**

- `src/components/dashboard/PreviewTab.tsx` — Replace placeholder with full build UI
  - Add `useBuild` hook integration
  - **Build Status Card:**
    - Status badge (existing, keep)
    - Active "Build My Site" / "Rebuild" button (replace disabled button)
    - Button disabled while building (shows spinner)
    - Button text: "Build My Site" if status === "draft", "Rebuild" if status === "live" or "error"
    - Validation: show inline warning if required fields missing (business_name, doula_name, service_area, services, email)
    - Building state: show "Building your site..." with animated progress bar
    - Error state: show error message with "Try Again" button
  - **Subdomain Input:**
    - Input field for subdomain slug (auto-suggested from doula_name if empty)
    - Shows `{slug}.birthbuild.com` preview
    - Slugify on change (lowercase, hyphens, no special chars)
    - Saved via debouncedUpdate({ subdomain_slug: value })
    - Read-only after first successful build (subdomain locked)
  - **Preview Iframe:**
    - Only shown when deploy_url exists (status === "live")
    - `<iframe>` with deploy_url, sandboxed: `sandbox="allow-scripts allow-same-origin"`
    - Responsive container with aspect ratio
    - "Open in new tab" link
    - Device toggle buttons: mobile (375px) / tablet (768px) / desktop (100%)
  - **Site Summary** (keep existing, move below iframe)
  - **Return to Chat link** (keep existing)

- `src/routes/preview.tsx` — Replace stub with full-page preview
  - Reads siteSpecId from query params or uses useSiteSpec hook
  - Full-screen iframe with deploy_url
  - Toolbar at top: device toggles, "Edit in Dashboard" link, "Open in new tab" link
  - Back button to dashboard

**Verify:**
- `npm run build && npx tsc --noEmit`
- PreviewTab renders correctly with all states (draft, building, live, error)

---

### Loop 7: Build Verification & Integration

**Verify all acceptance criteria:**

- `npm run build` — 0 errors
- `npx tsc --noEmit` — passes
- Build Edge Function: compiles, follows auth pattern, rate limited, sanitises HTML output
- Static site generation: all page types produce valid HTML5
- Wordmark SVG: generates properly for all 3 styles
- Palette resolution: all 4 presets + custom work
- Typography config: all 3 options resolve to correct font families
- Subdomain slug: generated, slugified, uniqueness handled
- PreviewTab: build button works, subdomain input present, preview iframe renders
- Preview route: full-page iframe with device toggles
- useBuild hook: triggers build, listens to realtime, handles all status transitions
- Realtime subscription: cleans up on unmount
- Error handling: generic messages to user, detailed console.error
- Security: HTML escaping, UUID validation, rate limiting, no API keys in client

---

## Security Considerations

1. **HTML injection in generated sites**: All user-provided text (business_name, bio, tagline, service descriptions, testimonials, etc.) MUST be escaped with `escapeHtml()` before inserting into generated HTML. This is the #1 security priority — user content becomes public web pages.

2. **Netlify API token**: Stored as Deno.env variable in Edge Function, never sent to client. The client only calls `supabase.functions.invoke("build")` — the Edge Function handles all Netlify communication.

3. **Build rate limiting**: 5 builds/hour per user to prevent API abuse and Netlify quota exhaustion.

4. **Spec ownership validation**: Edge Function verifies `site_spec.user_id === authenticated_user.id` before building. Service role client used for the query to avoid RLS complexity, but ownership check is explicit.

5. **Subdomain slug injection**: Slug must be sanitised (alphanumeric + hyphens only, max 63 chars) before passing to Netlify API. Reject slugs containing reserved words.

6. **Generated zip size limit**: Cap at 50MB to prevent storage abuse.

7. **Photo URLs**: Public URLs from Supabase Storage are used in generated HTML. These are already controlled by storage policies (SEC-013).

8. **SEC-017 follow-up**: Custom colour values should be validated as hex format (#rrggbb) before rendering into generated CSS. Invalid values default to palette fallback.

9. **SEC-018 follow-up**: Social link URLs should be validated (must start with https://) before rendering as `<a href>` in generated HTML.

10. **Contact form**: Uses Netlify Forms (data-netlify="true") — submissions go to Netlify, not to our infrastructure. No injection risk since the form is standard HTML.

## Edge Cases

1. **Spec with missing optional fields**: Generator must gracefully handle null values. Don't render sections for empty fields (no empty testimonials section, no empty philosophy, etc.).

2. **Custom palette with invalid hex**: Default to sage_sand palette colours if custom_colours is null or contains invalid hex.

3. **No photos uploaded**: Generate site without images. Hero section uses a CSS gradient background instead of hero image. About section omits photo.

4. **Empty services array**: Should be caught by validation (minimum 1 service required), but generator should still produce a valid page if somehow empty.

5. **Very long text content**: Bio, philosophy, testimonials could be very long. CSS handles overflow with proper word-wrapping. No truncation.

6. **Subdomain already taken**: Generate unique variant by appending random suffix.

7. **Netlify API failure**: Set status to "error", return user-friendly message. User can retry.

8. **Build interrupted**: If Edge Function crashes mid-build, spec stays in "building" state. The Edge Function should have a timeout mechanism, and the client should show a "Taking longer than expected" message after 60 seconds.

9. **Realtime connection lost**: useBuild hook should handle Supabase channel disconnection gracefully — fall back to polling or show "Connection lost" message.

10. **Concurrent builds**: Rate limiter prevents rapid successive builds. If a build is already in progress (status === "building"), the button should be disabled.

11. **Special characters in business name**: Wordmark SVG must escape XML special characters (`<`, `>`, `&`, `"`, `'`).

## Sequencing Notes

- **Loop 1 must come first**: Palette/typography extraction and wordmark generation are dependencies for all page generators.
- **Loop 2 depends on Loop 1**: Page generators use shared utilities, palette colours, and typography config.
- **Loop 3 depends on Loop 2**: Site generator wires together all page generators.
- **Loop 4 is independent of Loops 1-3 for types/structure**: The Edge Function duplicates generation logic (cannot import from src/), but the approach and HTML templates should match what's defined in Loops 1-3. Write Loop 4 after Loops 1-3 so the generation patterns are established.
- **Loop 5 depends on Loop 4 existing**: The hook calls the Edge Function, but can be written in parallel if the API contract is defined.
- **Loop 6 depends on Loop 5**: Enhanced PreviewTab uses the useBuild hook.
- **Loop 7 is final verification**: Must come last.

**Critical note on Edge Function vs Client-side generation**: The Edge Function (Deno runtime) cannot import from the React/Vite `src/` directory. The site generation logic in the Edge Function must be self-contained. However, the HTML templates and approach should be consistent. The `src/lib/` generators are used for local preview / testing; the Edge Function contains the production generation logic. To minimize code duplication, keep generation logic simple and template-based.

**Alternative approach (simpler)**: Have the client generate the site HTML/CSS/JS using `src/lib/site-generator.ts`, send the generated files as JSON to the Edge Function, and have the Edge Function only handle zip creation + Netlify deploy. This avoids duplicating generation logic but sends more data over the wire. **This is the recommended approach** — it keeps generation logic DRY and the Edge Function thin.
