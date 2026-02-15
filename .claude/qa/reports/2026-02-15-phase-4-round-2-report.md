# QA Report -- Phase 4: Build Pipeline & Deploy (Round 2 -- Security Fixes)

**Date:** 2026-02-15T22:45:00Z
**Branch:** phase-4-build-pipeline-deploy
**PR:** #4
**Round:** 2 (post-security fixes for SEC-019, SEC-020, SEC-021, SEC-022)
**Result:** PASS (36/36 tests passed)

---

## Security Fix Verification

### SEC-FIX-001: JSON-LD `</script>` XSS prevention (SEC-021)
**Status:** PASS
**Files:** `src/lib/pages/home.ts` (line 143), `src/lib/pages/faq.ts` (line 116)
**Verification:**
- `home.ts` line 143: `const safeJson = JSON.stringify(schemaData).replace(/</g, "\\u003c");` -- correctly escapes `<` to `\u003c` after `JSON.stringify`, preventing `</script>` injection inside JSON-LD blocks.
- `faq.ts` line 116: `${JSON.stringify(faqSchema).replace(/</g, "\\u003c")}` -- same pattern applied inline.
- Both JSON-LD script tags now use the sanitised output.

### SEC-FIX-002: booking_url scheme validation (SEC-022)
**Status:** PASS
**File:** `src/lib/pages/contact.ts` (lines 56-63)
**Verification:**
- Line 57: `const bookingUrl = spec.booking_url.trim();`
- Line 58: `if (bookingUrl.startsWith("https://") || bookingUrl.startsWith("http://"))` -- only renders the booking link when the URL has a safe http/https scheme.
- Prevents `javascript:` and `data:` scheme injection in href attributes.
- The URL is also passed through `escapeHtml()` before rendering (line 60).

### SEC-FIX-003: UUID format validation on site_spec_id (SEC-019)
**Status:** PASS
**File:** `supabase/functions/build/index.ts` (lines 443-453)
**Verification:**
- Line 444: `const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`
- Line 445: `if (!UUID_REGEX.test(body.site_spec_id))` -- rejects non-UUID values before they reach the database query.
- Returns a 400 error with a generic "Invalid site specification ID." message.
- Prevents SQL injection or unexpected query behaviour from malformed IDs.

### SEC-FIX-004: File path sanitisation in zip creation (SEC-020)
**Status:** PASS
**File:** `supabase/functions/build/index.ts` (lines 475-508)
**Verification:**
- Line 476: `const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-][a-zA-Z0-9_\-/]*\.(html|xml|txt|css|js|json|ico|svg|webmanifest)$/;`
- Line 477: `const MAX_PATH_LENGTH = 100;`
- Lines 496-499: Rejects paths containing `..`, starting with `/`, exceeding 100 chars, or not matching the safe regex.
- Whitelisted extensions: html, xml, txt, css, js, json, ico, svg, webmanifest.
- Prevents directory traversal attacks and arbitrary file writes in the zip.

---

## Full Regression Test Results

### TC-001: Production build succeeds
**Status:** PASS
**Steps:** `npm run build` in QA worktree
**Result:** `tsc -b && vite build` completed with 0 errors, 134 modules transformed, output to dist/.

### TC-002: TypeScript strict mode passes
**Status:** PASS
**Steps:** `npx tsc --noEmit` in QA worktree
**Result:** Exit code 0 with no output (no errors).

### TC-003: No `any` type usage in Phase 4 files
**Status:** PASS
**Steps:** Grep for `\bany\b` across all .ts/.tsx files.
**Result:** All matches are in string literals (prose text like "any stage", "any scenario", "any of the contact details"), not TypeScript type annotations. No `any` type usage found.

### TC-004: Functional components only (no class components)
**Status:** PASS
**Steps:** Grep for `class\s+\w+\s+extends\s+(React\.)?Component` in src/.
**Result:** No matches found. All components use function declarations.

### TC-005: Named exports (default exports only for route pages)
**Status:** PASS
**Steps:** Grep for `export default` across src/.
**Result:** Default exports found only in route pages: `index.tsx`, `chat.tsx`, `dashboard.tsx`, `preview.tsx`, `admin/sessions.tsx`, `admin/students.tsx`. All lib, hooks, and component files use named exports.

### TC-006: No `dangerouslySetInnerHTML` in Phase 4 code
**Status:** PASS
**Steps:** Grep for `dangerouslySetInnerHTML` in src/.
**Result:** One match in `MessageBubble.tsx` -- a comment (SEC-007) explaining React-based rendering is used instead. No actual usage anywhere.

### TC-007: British English in user-facing copy
**Status:** PASS
**Steps:** Verified "Colour" spelling in PaletteSelector, "Enquire" in services/home page generators, "organisation" patterns.
**Result:** User-facing copy consistently uses British English: "Colour Palette", "Enquire", etc.

### TC-008: All generated HTML uses `<html lang="en-GB">`
**Status:** PASS
**Steps:** Grep for `en-GB` in src/lib/pages/.
**Result:** All 6 page generators (home, about, services, contact, testimonials, faq) use `<html lang="en-GB">`.

### TC-009: escapeHtml applied to all user-provided text
**Status:** PASS
**Steps:** Grep for `escapeHtml` across all page generators.
**Result:** All user-provided fields are escaped: business_name, doula_name, tagline, service_area, bio, philosophy, testimonial quotes/names/contexts, service titles/descriptions/prices, email, phone, booking_url, social link URLs/platforms, photo URLs/alt text, training_provider. The `escapeHtml` function correctly replaces `&`, `<`, `>`, `"`, `'`.

### TC-010: Palette definitions shared between PaletteSelector and site generator
**Status:** PASS
**Steps:** Read PaletteSelector.tsx and palettes.ts.
**Result:** PaletteSelector imports `PALETTES` from `@/lib/palettes`. No inline palette definitions in the component. All 4 palettes match the brief (sage_sand, blush_neutral, deep_earth, ocean_calm) with correct colour values.

### TC-011: Typography config with 3 variants
**Status:** PASS
**Steps:** Read palettes.ts TYPOGRAPHY_CONFIG.
**Result:** Three variants defined: modern (Inter/Inter), classic (Playfair Display/Source Sans 3), mixed (DM Serif Display/Inter). Each includes a Google Fonts URL.

### TC-012: Wordmark SVG generation for all 3 styles
**Status:** PASS
**Steps:** Read wordmark.ts.
**Result:** `generateWordmark()` handles modern (clean, weight 600), classic (decorative divider line below text), minimal (thin weight 300). SVG includes `role="img"`, `aria-labelledby="wordmark-title"`, `<title>` element. Business name is XML-escaped.

### TC-013: Home page generates hero, services, testimonial, about teaser, JSON-LD, CTA
**Status:** PASS
**Steps:** Read home.ts.
**Result:** All sections present: hero (h1 + tagline + CTA), services overview (max 3 cards + "View all" link), featured testimonial (first), about teaser (headshot + truncated bio), Schema.org LocalBusiness JSON-LD, CTA section.

### TC-014: About page generates bio, headshot, philosophy, qualifications, CTA
**Status:** PASS
**Steps:** Read about.ts.
**Result:** Bio with paragraph splitting, headshot photo, philosophy section (conditional), qualifications (Doula UK badge, training provider), CTA to contact.

### TC-015: Services page generates card per service
**Status:** PASS
**Steps:** Read services.ts.
**Result:** Each service renders as a card with title, description, price, and "Enquire" CTA linking to contact page.

### TC-016: Contact page generates Netlify form + contact details + social links
**Status:** PASS
**Steps:** Read contact.ts.
**Result:** Netlify form with `data-netlify="true"`, hidden `form-name` field, name/email/message inputs with labels. Contact info (email, phone, booking URL, service area) rendered as `<dl>`. Social links rendered with `getValidSocialLinks` filter.

### TC-017: Testimonials page generates blockquotes
**Status:** PASS
**Steps:** Read testimonials.ts.
**Result:** Each testimonial rendered as `<blockquote>` with `<cite>`. Only generated when testimonials array has entries.

### TC-018: FAQ page generates details/summary accordion
**Status:** PASS
**Steps:** Read faq.ts.
**Result:** 6 hardcoded doula FAQ items using `<details>` + `<summary>`. Answers localised with `spec.service_area`. FAQ JSON-LD Schema.org markup included.

### TC-019: Site generator validates custom hex colours (SEC-017)
**Status:** PASS
**Steps:** Read site-generator.ts.
**Result:** `isValidHexColour` uses regex `/^#[0-9a-fA-F]{6}$/`. `validateCustomColours` checks all 5 colour keys. Invalid custom colours fall back to sage_sand palette.

### TC-020: Site generator validates social link URLs (SEC-018)
**Status:** PASS
**Steps:** Read shared.ts `isValidSocialLink` and `getValidSocialLinks`.
**Result:** Social links must start with `https://` and be 500 chars or fewer. Invalid links filtered out via `getValidSocialLinks`.

### TC-021: Site generator produces sitemap.xml and robots.txt
**Status:** PASS
**Steps:** Read site-generator.ts.
**Result:** `generateSitemap()` produces valid XML with `<url>` entries per page, priority 1.0 for index.html. `generateRobotsTxt()` includes User-agent, Allow, and Sitemap directive.

### TC-022: Build Edge Function authenticates via JWT
**Status:** PASS
**Steps:** Read build/index.ts.
**Result:** Extracts Authorization header, creates user client with JWT, calls `getUser()`. Returns 401 on missing/invalid token.

### TC-023: Build Edge Function rate-limits (5 builds/hour)
**Status:** PASS
**Steps:** Read build/index.ts rate limiter.
**Result:** In-memory `rateLimitMap` per user ID. `RATE_LIMIT_MAX = 5`, `RATE_LIMIT_WINDOW_MS = 3_600_000`. Returns 429 when exceeded.

### TC-024: Build Edge Function validates spec completeness
**Status:** PASS
**Steps:** Read build/index.ts lines 557-580.
**Result:** Checks business_name, doula_name, service_area, services array length >= 1, email. Returns 400 with list of missing fields.

### TC-025: Build Edge Function verifies user_id ownership
**Status:** PASS
**Steps:** Read build/index.ts lines 543-551.
**Result:** Fetches spec via service role client, compares `siteSpec.user_id !== user.id`. Returns 403 on mismatch.

### TC-026: Subdomain slug generation and uniqueness
**Status:** PASS
**Steps:** Read build/index.ts `slugify` function and subdomain logic.
**Result:** `slugify()` lowercases, replaces non-alphanumeric with hyphens, collapses, trims, max 63 chars. Checks reserved words list. Checks uniqueness via DB query. Appends random suffix if taken.

### TC-027: Build Edge Function creates zip and deploys to Netlify
**Status:** PASS
**Steps:** Read build/index.ts zip creation and Netlify API calls.
**Result:** `createZipBuffer()` creates valid ZIP with Store method. Deploys via POST to `/api/v1/sites/{id}/deploys`. Creates new site if no `netlify_site_id` exists.

### TC-028: Build Edge Function updates status through lifecycle
**Status:** PASS
**Steps:** Read build/index.ts status updates.
**Result:** Sets "building" before deploy (line 588), "live" on success (line 752), "error" on zip failure (line 647) or Netlify failure (line 730). Returns `{ success: true, deploy_url }` on success.

### TC-029: Netlify API token never exposed to client
**Status:** PASS
**Steps:** Grep for `NETLIFY_API_TOKEN` in src/ (client code).
**Result:** No matches. Token only accessed via `Deno.env.get()` in the Edge Function.

### TC-030: CORS headers match allowed origins
**Status:** PASS
**Steps:** Read build/index.ts CORS config.
**Result:** `ALLOWED_ORIGINS` includes localhost:5173, birthbuild.com, www.birthbuild.com. Same pattern as chat Edge Function.

### TC-031: useBuild hook validates locally before API call
**Status:** PASS
**Steps:** Read useBuild.ts.
**Result:** `validateRequiredFields()` checks same 5 fields as Edge Function. Sets `buildError` with missing fields message without making API call.

### TC-032: useBuild hook subscribes to Supabase Realtime
**Status:** PASS
**Steps:** Read useBuild.ts useEffect.
**Result:** Subscribes to `postgres_changes` on `site_specs` table filtered by `id=eq.${siteSpec.id}`. Updates `lastBuildStatus` on change. Cleans up channel on unmount.

### TC-033: PreviewTab shows build button with validation warnings
**Status:** PASS
**Steps:** Read PreviewTab.tsx.
**Result:** "Build My Site" button shown when status is draft/error. Validation warnings shown as role="alert" with list of missing fields. Button disabled when fields are missing.

### TC-034: PreviewTab shows building progress animation
**Status:** PASS
**Steps:** Read PreviewTab.tsx lines 231-239.
**Result:** "Building your site..." text with `aria-live="polite"` and pulsing progress bar (`animate-pulse`). Shown when `building` is true.

### TC-035: PreviewTab shows preview iframe with device toggles
**Status:** PASS
**Steps:** Read PreviewTab.tsx lines 337-376.
**Result:** Iframe rendered only when `deployUrl` exists. Sandboxed with `allow-scripts allow-same-origin`. Device toggles: Mobile (375px), Tablet (768px), Desktop (100%). "Open in new tab" link. Device buttons use `aria-pressed`.

### TC-036: Preview route shows full-page iframe
**Status:** PASS
**Steps:** Read preview.tsx.
**Result:** Uses `useAuth()` and `useSiteSpec()`. Shows "No site built yet" with dashboard link when no deploy_url. Full-screen iframe when deploy_url exists. Top toolbar with back link, device toggles (`aria-pressed`), "Open in new tab". Uses `export default` (route page exception).

---

## Summary

- **Passed:** 36
- **Failed:** 0
- **Total:** 36

All 4 security fixes (SEC-019, SEC-020, SEC-021, SEC-022) are correctly implemented. Full regression passes with no regressions found. The build compiles cleanly under TypeScript strict mode and produces a valid production bundle.
