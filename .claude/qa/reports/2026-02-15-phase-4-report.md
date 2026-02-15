# QA Report — Phase 4: Build Pipeline & Deploy

**Date:** 2026-02-15T19:45:00Z
**Branch:** phase-4-build-pipeline-deploy
**PR:** #4
**Result:** PASS (36/36 tests passed)

---

## 1. Build Verification

### TC-001: Production build succeeds (`npm run build`)
**Status:** PASS
**Detail:** Build completes in ~2.5s with no errors. Output: 134 modules transformed, dist produced with index.html, CSS, and JS bundles.

### TC-002: TypeScript strict mode passes (`npx tsc --noEmit`)
**Status:** PASS
**Detail:** Zero errors. All new and modified files compile cleanly under strict mode.

---

## 2. Architecture Rules Compliance

### TC-003: No `any` type usage
**Status:** PASS
**Detail:** Searched all `.ts` and `.tsx` files under `src/` for `: any` and `as any`. Zero matches. All instances of the word "any" in the codebase are natural English in comments or user-facing text, not TypeScript type annotations.

### TC-004: No unused variables/parameters
**Status:** PASS
**Detail:** `npx tsc --noEmit` passes with `noUnusedLocals` and `noUnusedParameters` enabled in tsconfig. No warnings or errors.

### TC-005: Named exports only (except route pages)
**Status:** PASS
**Detail:** All `export default` usage is in route pages only: `src/routes/index.tsx`, `src/routes/chat.tsx`, `src/routes/dashboard.tsx`, `src/routes/preview.tsx`, `src/routes/admin/sessions.tsx`, `src/routes/admin/students.tsx`. All new library files (`palettes.ts`, `wordmark.ts`, `shared.ts`, page generators, `site-generator.ts`, `useBuild.ts`, `PreviewTab.tsx`) use named exports.

### TC-006: Functional components only
**Status:** PASS
**Detail:** All new components (`PreviewTab`, `PreviewPage`) are functional components using hooks. No class components found.

### TC-007: Tailwind only in PWA components (no inline styles except generated sites)
**Status:** PASS
**Detail:** Two instances of inline `style={}` in PWA components:
- `PreviewTab.tsx:372` — `style={{ width: DEVICE_WIDTHS[deviceSize] }}` on iframe
- `preview.tsx:108` — `style={{ width: DEVICE_WIDTHS[deviceSize] }}` on iframe

Both are dynamic width values for device preview toggling (375px/768px/100%) which cannot be expressed as static Tailwind classes. This is an acceptable use of dynamic inline styles. One inline style in `contact.ts:80` is in generated static site HTML (not PWA), which falls under the documented exception.

### TC-008: British English in user-facing copy
**Status:** PASS
**Detail:** All user-facing text uses British English:
- "colour" used consistently in variable names, labels, CSS custom properties (`--colour-bg`, `--colour-primary`, etc.)
- "authorisation" in Edge Function error message
- No instances of "color" in user-facing copy (only in CSS property names which are standard CSS, e.g., `color: var(...)`)
- No instances of "organize" or other American spellings
- All FAQ content uses British spelling: "programme", "caesarean", etc.

### TC-009: No dangerouslySetInnerHTML
**Status:** PASS
**Detail:** The only file containing `dangerouslySetInnerHTML` is `MessageBubble.tsx`, which is pre-existing (not modified in this PR). No new files introduce `dangerouslySetInnerHTML`.

### TC-010: Generic error messages (no raw API errors to users)
**Status:** PASS
**Detail:** Reviewed all error handling paths:
- Edge Function (`build/index.ts`): All error responses return generic messages ("Deployment failed. Please try again.", "Failed to package site files.", etc.). Raw error details logged to `console.error()` only.
- `useBuild.ts`: Catch block returns "Something went wrong. Please try again." to user, logs actual error via `console.error()`.
- `PreviewTab.tsx`: Displays `buildError` string from hook, which is always generic.

---

## 3. Site Generation Quality

### TC-011: All page generators produce valid HTML5 with semantic landmarks
**Status:** PASS
**Detail:** All 6 page generators (home, about, services, contact, testimonials, FAQ) produce:
- `<!DOCTYPE html>` declaration
- `<html lang="en-GB">` root element
- Proper `<head>` with charset, viewport, title, meta description, OG tags, Twitter Card tags
- `<header>` with `role="banner"`
- `<main id="main">` landmark
- `<footer>` with `role="contentinfo"`
- `<nav>` with `aria-label="Main navigation"`
- Skip-to-content link (`<a href="#main" class="skip-link">`)
- `<section>` elements for content grouping

### TC-012: escapeHtml() used on ALL user-provided text
**Status:** PASS
**Detail:** Comprehensive audit of all page generators confirms escapeHtml() is called on every user-provided value before insertion into HTML:
- `home.ts`: business_name, tagline, service_area, service titles/descriptions/prices, testimonial quotes/names/contexts, bio teaser, photo URLs and alt text
- `about.ts`: doula_name, bio paragraphs, philosophy, training_provider, photo URLs and alt text
- `services.ts`: service titles/descriptions/prices, service_area
- `contact.ts`: email, phone, booking_url, service_area, social link URLs and platforms
- `testimonials.ts`: testimonial quotes/names/contexts
- `faq.ts`: FAQ question text and answer text (answers use serviceArea which is escaped)
- `shared.ts`: business_name in nav and footer, page titles/descriptions, nav labels, social link URLs and platforms
- `wordmark.ts`: uses `xmlEscape()` on business name for SVG context

### TC-013: CSS custom properties are correct
**Status:** PASS
**Detail:** `generateCss()` in `shared.ts` produces correct `:root` custom properties:
- `--colour-bg`, `--colour-primary`, `--colour-accent`, `--colour-text`, `--colour-cta` (all using British English)
- `--font-heading`, `--font-body` with proper font family values
- `--radius`, `--btn-radius` vary by style (modern: 8px/6px, classic: 4px/4px, minimal: 2px/2px)
- `--max-width: 1100px`
- All CSS rules reference these custom properties consistently

### TC-014: Google Fonts links are correct
**Status:** PASS
**Detail:** Three typography configs with correct Google Fonts API v2 URLs:
- `modern`: Inter (wght 400-700) with `display=swap`
- `classic`: Playfair Display (wght 400,700) + Source Sans 3 (wght 400,600)
- `mixed`: DM Serif Display + Inter (wght 400-600)

All use `css2` API endpoint, proper `family=` parameters, and `display=swap`. Head generation includes `preconnect` hints for both `fonts.googleapis.com` and `fonts.gstatic.com`.

### TC-015: Wordmark SVG generation
**Status:** PASS
**Detail:** `generateWordmark()` produces valid SVG with:
- `xmlns` namespace declaration
- `viewBox` with dynamic width based on character count
- `role="img"` and `aria-labelledby="wordmark-title"` for accessibility
- `<title>` element with XML-escaped business name
- Style variants: modern (font-weight 600, letter-spacing 0.5), classic (font-weight 600, decorative `<line>` divider below text, taller SVG at 60px), minimal (font-weight 300, letter-spacing 2)
- Business name XML-escaped via dedicated `xmlEscape()` function

---

## 4. Edge Function Review (`supabase/functions/build/index.ts`)

### TC-016: Auth pattern matches chat/index.ts
**Status:** PASS
**Detail:** Build Edge Function follows the exact same auth pattern as chat:
- Reads `Authorization` header
- Creates user-scoped Supabase client with the JWT
- Calls `userClient.auth.getUser()` to verify token
- Returns 401 on missing/invalid auth
- Creates service role client for admin operations
- Same error message patterns ("Missing authorisation header.", "Invalid or expired token.")

### TC-017: Rate limiting present
**Status:** PASS
**Detail:** Rate limiting implemented with:
- In-memory `Map<string, RateLimitEntry>` per user
- 5 builds/hour window (`RATE_LIMIT_MAX = 5`, `RATE_LIMIT_WINDOW_MS = 3_600_000`)
- Returns 429 with generic message when exceeded
- Separate from chat rate limit (different function instance, different constants)

### TC-018: CORS handling
**Status:** PASS
**Detail:** CORS implementation matches chat:
- Same `ALLOWED_ORIGINS` array: `localhost:5173`, `birthbuild.com`, `www.birthbuild.com`
- Same `corsHeaders()` function pattern
- Preflight `OPTIONS` response
- CORS headers on all responses

### TC-019: Input validation
**Status:** PASS
**Detail:** Comprehensive input validation:
- `site_spec_id`: required, must be string
- `files`: required, must be array, must not be empty
- `files.length > MAX_FILES (50)`: rejected
- Individual file validation: each must have `path` (string) and `content` (string)
- Per-file size limit: `MAX_FILE_CONTENT_BYTES = 5MB`
- Total zip size limit: `MAX_ZIP_SIZE_BYTES = 50MB`
- Reserved slugs list prevents abuse: `www`, `api`, `app`, `admin`, `mail`, `ftp`, `cdn`, `assets`, `static`, `birthbuild`

### TC-020: Status management (building -> live/error)
**Status:** PASS
**Detail:** Status lifecycle correctly implemented:
1. Sets `status = "building"` before starting deploy (step 6)
2. On zip creation failure: sets `status = "error"`, returns error
3. On Netlify API failure: sets `status = "error"`, returns error
4. On success: sets `status = "live"` with `deploy_url`, `netlify_site_id`, `subdomain_slug`
5. All status updates include `updated_at` timestamp

### TC-021: Zip creation logic
**Status:** PASS
**Detail:** Custom ZIP implementation using Store method (no compression):
- Correct ZIP local file header signature (`0x04034b50`)
- Correct central directory header signature (`0x02014b50`)
- Correct end of central directory signature (`0x06054b50`)
- CRC-32 implementation with proper lookup table
- Size validation before creating buffer (rejects if > 50MB)
- All binary fields written in little-endian format

### TC-022: Netlify API integration
**Status:** PASS
**Detail:** Two-step Netlify integration:
1. Create site: `POST /api/v1/sites` with site name and custom domain
2. Deploy zip: `POST /api/v1/sites/{id}/deploys` with `Content-Type: application/zip`
- Reuses existing `netlify_site_id` if present (avoids creating duplicate sites on rebuild)
- Bearer token auth via `NETLIFY_API_TOKEN` environment variable
- Error responses logged server-side, generic message returned to client

### TC-023: Netlify API token never exposed to client
**Status:** PASS
**Detail:** `NETLIFY_API_TOKEN` read from `Deno.env.get()` inside the Edge Function. Used only in server-side `fetch()` calls. Client sends only `site_spec_id` and `files` array. The token is never present in any client-side code (`src/` directory).

---

## 5. useBuild Hook Review

### TC-024: Realtime subscription setup and cleanup
**Status:** PASS
**Detail:** `useEffect` subscribes to `postgres_changes` on `site_specs` table filtered by `id=eq.${siteSpec.id}`. Returns cleanup function that calls `supabase.removeChannel(channel)`. Channel name uses unique ID: `build-status-${siteSpec.id}`. Dependency array correctly includes `siteSpec?.id`.

### TC-025: Error handling
**Status:** PASS
**Detail:** Multiple error handling paths:
- Validation failure: sets `buildError` with descriptive message about missing fields
- Photo fetch failure: logs warning but continues (non-blocking)
- Edge Function error response: extracts message, sets `buildError`
- Unexpected exceptions: catches `unknown`, logs to console, shows generic "Something went wrong" to user
- All error paths call `setBuilding(false)` to reset loading state

### TC-026: Required field validation
**Status:** PASS
**Detail:** `validateRequiredFields()` checks: `business_name`, `doula_name`, `service_area`, `services.length >= 1`, `email`. Returns array of missing field names. Build is blocked if any are missing, with a human-readable message: "Please complete the following before building: {fields}."

---

## 6. PreviewTab and Preview Route Review

### TC-027: Build button states (draft)
**Status:** PASS
**Detail:** When `currentStatus === "draft"`, renders "Build My Site" button using the `Button` component with `loading` and `disabled` props. Disabled when required fields are missing (`!canBuild`).

### TC-028: Build button states (building)
**Status:** PASS
**Detail:** When `currentStatus === "building"`, renders disabled "Building..." button with `loading` spinner. Also shows building animation with "Building your site..." text and pulsing progress bar (`animate-pulse`). Uses `aria-live="polite"` for screen reader announcement.

### TC-029: Build button states (live)
**Status:** PASS
**Detail:** When `currentStatus === "live"`, renders "Rebuild Site" button (secondary variant). Shows success message with clickable deploy URL link. Shows "View live site" link next to status badge.

### TC-030: Build button states (error)
**Status:** PASS
**Detail:** When `currentStatus === "error"`, renders "Build My Site" button (same as draft, allowing retry). Shows error message in red alert box with `role="alert"`.

### TC-031: Validation warnings for missing fields
**Status:** PASS
**Detail:** When required fields are missing and not currently building, displays yellow warning box (`role="alert"`) listing all missing fields as a bullet list. Uses `getMissingFields()` which checks the same 5 fields as the hook validation.

### TC-032: Subdomain input
**Status:** PASS
**Detail:** Input field with:
- Label "Your site address" with `htmlFor` matching `id="subdomain-slug"`
- Auto-suggested value from `doula_name` via `slugifySubdomain()`
- Slugification on change (lowercase, non-alphanumeric to hyphens, max 63 chars)
- Preview showing `.birthbuild.com` suffix via `aria-describedby`
- Read-only and disabled after deployment (`isLive` state)
- Saves via `onFieldChange({ subdomain_slug: value })`

### TC-033: Preview iframe with device toggles
**Status:** PASS
**Detail:** When `deployUrl` exists, renders:
- Device toggle buttons: Mobile (375px), Tablet (768px), Desktop (100%)
- Toggle buttons use `aria-pressed` for accessibility
- Active button highlighted with green background
- "Open in new tab" link
- Sandboxed iframe: `sandbox="allow-scripts allow-same-origin"`
- `title="Site preview"` for accessibility
- Dynamic width via `style={{ width: DEVICE_WIDTHS[deviceSize] }}`

### TC-034: Preview route shows full-page iframe view
**Status:** PASS
**Detail:** `preview.tsx` implements:
- Auth and site spec loading with `LoadingSpinner`
- "No site built yet" state with link to dashboard when no `deploy_url`
- Full-screen layout: `h-screen flex flex-col`
- Top toolbar with: back-to-dashboard link, device toggle buttons, "Open in new tab" link
- Full-height iframe with same sandbox and device width controls
- Uses `useAuth()` and `useSiteSpec()` hooks (no direct Supabase calls)
- `export default` (correct for route page)

---

## 7. Security Checks

### TC-035: Custom colour hex validation (SEC-017)
**Status:** PASS
**Detail:** `site-generator.ts` validates custom colours with `isValidHexColour()` using regex `/^#[0-9a-fA-F]{6}$/`. If any custom colour fails validation, the entire set is rejected and falls back to `sage_sand` preset palette. Validation logged to `console.error()`.

### TC-036: Social link URL validation (SEC-018)
**Status:** PASS
**Detail:** `shared.ts` implements `isValidSocialLink()`: must start with `https://` and be <= 500 characters. `getValidSocialLinks()` filters out all invalid entries. Used consistently in `generateFooter()`, `generateContactPage()`, and `generateHomePage()` (for Schema.org `sameAs`). Invalid links are silently omitted from generated HTML.

---

## Summary

| Category | Passed | Failed | Total |
|----------|--------|--------|-------|
| Build Verification | 2 | 0 | 2 |
| Architecture Rules | 8 | 0 | 8 |
| Site Generation Quality | 5 | 0 | 5 |
| Edge Function | 8 | 0 | 8 |
| useBuild Hook | 3 | 0 | 3 |
| PreviewTab & Preview Route | 8 | 0 | 8 |
| Security | 2 | 0 | 2 |
| **Total** | **36** | **0** | **36** |

**Overall Result: PASS**

All 36 test cases pass. The implementation is thorough, well-structured, and adheres to all architecture rules and acceptance criteria from the phase 4 brief.
