# Security Review — Phase 4: Build Pipeline & Deploy

**Date:** 2026-02-15T20:15:00Z
**Branch:** phase-4-build-pipeline-deploy
**PR:** #4
**Reviewer:** Security Agent
**Result:** CLEAN (0 open Medium+ findings)

---

## Round 2 Review (2026-02-15)

The Dev Agent addressed all four Medium findings (SEC-019, SEC-020, SEC-021, SEC-022) in commit `e16e802`. All four fixes have been verified and are correct. No new vulnerabilities were introduced by the fixes. No regressions in prior findings (SEC-017, SEC-018).

### SEC-019 (Medium): UUID Format Validation on site_spec_id -- VERIFIED FIXED

**File:** `supabase/functions/build/index.ts`:444-453
**Verification:**
- UUID regex defined as `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` at line 444
- Case-insensitive flag (`i`) correctly handles both upper and lower hex digits
- Test runs immediately after the basic type/presence check, before any database query
- Returns 400 with generic error message "Invalid site specification ID." (does not echo the input)
- Positioned before the `.eq("id", body.site_spec_id)` query at line 527 and all subsequent uses

### SEC-020 (Medium): File Path Sanitisation in Zip Creation -- VERIFIED FIXED

**File:** `supabase/functions/build/index.ts`:476-508
**Verification:**
- `SAFE_PATH_REGEX` allowlist defined: `/^[a-zA-Z0-9_\-][a-zA-Z0-9_\-/]*\.(html|xml|txt|css|js|json|ico|svg|webmanifest)$/`
- Path must start with alphanumeric, underscore, or hyphen (no leading `/` or `.`)
- Extension allowlist covers all file types the site generator produces (html, xml, txt, css, js, json, ico, svg, webmanifest)
- Maximum path length of 100 characters enforced at line 496
- Explicit `..` traversal check at line 497
- Explicit leading `/` check at line 498
- Regex match required at line 499
- All four checks run before the path reaches `createZipBuffer()`
- Returns 400 with error message that includes the file path (note: this matches SEC-023 Low finding pattern, but path has already passed regex validation at this point so it is constrained to safe characters)

### SEC-021 (Medium): JSON-LD Script Tag Breakout XSS -- VERIFIED FIXED

**File:** `src/lib/pages/home.ts`:143, `src/lib/pages/faq.ts`:116
**Verification:**
- `home.ts` line 143: `const safeJson = JSON.stringify(schemaData).replace(/</g, "\\u003c");` -- replaces ALL `<` characters with their Unicode escape, which prevents `</script>` breakout entirely
- `faq.ts` line 116: `JSON.stringify(faqSchema).replace(/</g, "\\u003c")` -- identical pattern applied inline
- The `.replace(/</g, "\\u003c")` approach is the standard OWASP-recommended mitigation for JSON-in-HTML-script contexts
- Using `\\u003c` (replacing all `<`) is more conservative than the targeted `<\/` approach, which is correct -- it blocks all possible HTML tag injection, not just `</script>`
- The replacement runs after `JSON.stringify()`, so it cannot interfere with JSON structure (JSON strings represent `<` as a literal character, and `\u003c` is a valid JSON string escape)

### SEC-022 (Medium): booking_url Scheme Validation -- VERIFIED FIXED

**File:** `src/lib/pages/contact.ts`:57-63
**Verification:**
- Line 57: `const bookingUrl = spec.booking_url.trim();` -- trims whitespace to prevent bypass via `  javascript:...`
- Line 58: `if (bookingUrl.startsWith("https://") || bookingUrl.startsWith("http://"))` -- requires http or https scheme
- If scheme validation fails, the booking URL is silently omitted (no link rendered, no error) -- this is the correct approach since the URL simply is not displayed rather than being rendered unsafely
- The `escapeHtml(bookingUrl)` call at line 60 is preserved for the valid-scheme case, maintaining defence-in-depth against attribute breakout
- `javascript:`, `data:`, `vbscript:`, and all other non-http(s) schemes are now blocked

### New Findings or Regressions: NONE

No new security findings or regressions were introduced by the fix commit. The fix commit (`e16e802`) only touches the four files identified in Round 1 findings plus `CHANGES-REQUESTED.md` and `tsconfig.tsbuildinfo` (build artifact).

### Prior Findings Regression Check

- **SEC-017 (Custom colour hex validation):** Still intact in `src/lib/site-generator.ts`:37-69. `isValidHexColour()` with `/^#[0-9a-fA-F]{6}$/` and `validateCustomColours()` still present. No regression.
- **SEC-018 (Social link URL validation):** Still intact in `src/lib/pages/shared.ts`:37-54. `isValidSocialLink()` with `https://` prefix check and 500-char limit still present. No regression.

---

## Round 2 Verdict

**Result:** CLEAN (0 new findings, 4/4 requested fixes verified)

**APPROVE for merge.** All four Medium findings from Round 1 have been correctly addressed. The five Low/informational findings (SEC-023 through SEC-027) remain open and can be addressed in future iterations. No regressions in Phase 3 findings (SEC-017, SEC-018). The Phase 4 implementation is now clear of all Medium+ security findings.

---

## Round 1 Findings (Original Review)

### SEC-019: Missing UUID Format Validation on site_spec_id in Build Edge Function

**Severity:** Medium -- **RESOLVED in Round 2** (commit `e16e802`)
**Category:** API
**File:** `supabase/functions/build/index.ts`:427-428
**Description:** The `site_spec_id` field is validated as a non-empty string (`typeof body.site_spec_id !== "string"`), but there is no check that it conforms to UUID v4 format. The value is passed directly to a Supabase `.eq("id", body.site_spec_id)` query. While Supabase/Postgres will reject malformed UUIDs at the database layer, validating the format before the query prevents unnecessary database calls and provides clearer error messages. Additionally, the unvalidated `site_spec_id` is used directly in a subsequent `.eq("id", body.site_spec_id)` update at lines 556 and 615 via the service role client (which bypasses RLS), so any unexpected string shapes should be rejected early.
**Risk:** Low. The database column type (uuid) provides backend protection, but defence-in-depth recommends client validation.
**Recommendation:** Add a UUID regex check: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.site_spec_id)`. Reject with 400 if invalid.
**Fix Applied:** Yes (by Dev Agent in commit `e16e802`) -- **VERIFIED ROUND 2**

---

### SEC-020: No File Path Sanitisation in Zip Creation (Path Traversal)

**Severity:** Medium -- **RESOLVED in Round 2** (commit `e16e802`)
**Category:** API
**File:** `supabase/functions/build/index.ts`:134-135
**Description:** The `createZipBuffer()` function writes `file.path` directly into the ZIP archive without sanitising it. While the files currently originate from the client-side `generateSite()` function which produces known filenames (e.g., `index.html`, `about.html`), a modified client could send arbitrary paths such as `../../../etc/passwd` or absolute paths. The Edge Function accepts whatever file paths are POSTed in the `files` array. The validation loop at lines 464-486 checks that `file.path` is a string and `file.content` is within size limits, but does not validate the path value itself.
**Risk:** Medium. Although Netlify's deploy API processes the zip safely (extracting to its own deploy directory), a malicious path in the ZIP could cause unexpected behaviour depending on the extraction tool used. This is a defence-in-depth concern.
**Recommendation:** Validate that each `file.path`: (1) does not contain `..`, (2) does not start with `/`, (3) matches an allowlist of expected patterns (e.g., `/^[a-z0-9_-]+\.(html|xml|txt)$/`), and (4) has a maximum length. Reject with 400 if any path is invalid.
**Fix Applied:** Yes (by Dev Agent in commit `e16e802`) -- **VERIFIED ROUND 2**

---

### SEC-021: Unescaped User Content in JSON-LD Schema Script Tags

**Severity:** Medium -- **RESOLVED in Round 2** (commit `e16e802`)
**Category:** Frontend
**File:** `src/lib/pages/home.ts`:143, `src/lib/pages/faq.ts`:116
**Description:** The Schema.org JSON-LD blocks use `JSON.stringify(schemaData)` to embed user-provided values (business_name, tagline, service_area, email, phone, social link URLs) directly into `<script type="application/ld+json">` tags. While `JSON.stringify` handles most special characters, it does NOT escape the sequence `</script>`. If a user enters a value containing the literal string `</script>`, this would prematurely close the script tag, enabling HTML injection in the generated page.

For example, if `business_name` is set to `My </script><script>alert(1)</script> Business`, the resulting HTML would be:
```html
<script type="application/ld+json">{"@context":"https://schema.org","name":"My </script><script>alert(1)</script> Business"}</script>
```
This breaks out of the JSON-LD script block and executes arbitrary JavaScript.

The FAQ page (faq.ts:116) has the same issue with `serviceArea` (derived from `spec.service_area`) embedded in the FAQ schema's answer text via `item.answer(serviceArea)`.

**Risk:** High. This is a stored XSS vector. Any user who sets their business name, tagline, service area, or email to contain `</script>` can inject arbitrary JavaScript into the generated public website. The generated site is served to the public from a birthbuild.com subdomain. The escapeHtml() function is correctly applied to all HTML-context user data, but the JSON-LD script tags are a separate injection context.
**Recommendation:** After `JSON.stringify()`, replace all occurrences of `</` with `<\/` to prevent script tag breakout. This is the standard mitigation:
```typescript
const safeJson = JSON.stringify(schemaData).replace(/</g, "\\u003c");
```
Alternatively, use `.replace(/<\//g, "<\\/")` which is more targeted.
**Fix Applied:** Yes (by Dev Agent in commit `e16e802`) -- **VERIFIED ROUND 2**

---

### SEC-022: booking_url Rendered as href Without Scheme Validation

**Severity:** Medium -- **RESOLVED in Round 2** (commit `e16e802`)
**Category:** Frontend
**File:** `src/lib/pages/contact.ts`:57-58
**Description:** The `booking_url` value is rendered as an `<a href="...">` link in the contact page. While `escapeHtml()` prevents attribute breakout, the URL scheme is not validated. A user could set `booking_url` to `javascript:alert(1)` (which escapeHtml would preserve since it contains no HTML special characters), resulting in:
```html
<a href="javascript:alert(1)" target="_blank" rel="noopener noreferrer">Schedule a consultation</a>
```
The `target="_blank"` attribute causes most browsers to open a new tab/window, which typically blocks `javascript:` URIs. However, this is browser-dependent behaviour, not a security guarantee.

Note: Social links are already validated via `isValidSocialLink()` which requires `https://` prefix. The same validation pattern should be applied to `booking_url`.
**Risk:** Medium. A `javascript:` URI in booking_url could execute JavaScript on the generated public site, depending on browser behaviour.
**Recommendation:** Validate that `booking_url` starts with `https://` (or `http://`) before rendering it as a clickable link. If invalid, either omit the link or render the URL as plain text.
**Fix Applied:** Yes (by Dev Agent in commit `e16e802`) -- **VERIFIED ROUND 2**

---

### SEC-023: Edge Function Error Response Echoes User-Supplied File Path

**Severity:** Low
**Category:** API
**File:** `supabase/functions/build/index.ts`:479
**Description:** The error message at line 479 includes the user-supplied `file.path` value directly in the JSON response:
```typescript
JSON.stringify({ error: `File "${file.path}" exceeds maximum size.` })
```
While this is a 400 response to the authenticated user who submitted the request, echoing unsanitised user input in error messages is generally inadvisable and could be an XSS vector if the error message is rendered without escaping in the frontend. The frontend does render `buildError` in `PreviewTab.tsx`:248 within a React JSX expression (`{buildError}`), which is safe because React auto-escapes JSX expressions.
**Risk:** Low. React's JSX auto-escaping prevents exploitation in the current frontend. However, if the error were logged or displayed in any non-React context, it could be exploitable.
**Recommendation:** Use a generic error message like "One or more files exceed the maximum size limit" that does not echo user input.
**Fix Applied:** No (requires Dev Agent -- changes error response)

---

### SEC-024: Custom Colour Validation Only Applied in site-generator, Not in generateCss/generateHead

**Severity:** Low
**Category:** Frontend
**File:** `src/lib/pages/shared.ts`:205-209
**Description:** The `generateCss()` function inserts colour values directly into CSS custom properties without hex validation:
```css
--colour-bg: ${colours.background};
--colour-primary: ${colours.primary};
```
The validation happens in `site-generator.ts` via `validateCustomColours()` before colours reach page generators. However, `generateCss()` and `generateHead()` are exported public functions that could be called independently from other code paths without the validation gate. The `getPaletteColours()` function in `palettes.ts` also passes through custom colours without validation when `palette === "custom"`.

In the current codebase, all calls flow through `generateSite()` which validates first. But this is a fragile pattern -- future callers of `generateHead()` or `generateCss()` could bypass validation.

This finding verifies that SEC-017 (Phase 3) has been addressed for the `generateSite()` code path. The hex regex `/^#[0-9a-fA-F]{6}$/` correctly prevents CSS injection via colour values. The validation correctly falls back to sage_sand preset when any custom colour is invalid.
**Risk:** Low. CSS injection via custom colours is blocked in the current call path. Only a concern if generateCss/generateHead are called from a new code path without validation.
**Recommendation:** Move hex validation into `getPaletteColours()` or `generateCss()` itself so it is enforced regardless of call site.
**Fix Applied:** No (informational -- current code path is safe, defence-in-depth suggestion)

---

### SEC-025: Social Link Validation Allows Non-URL https:// Strings

**Severity:** Low
**Category:** Frontend
**File:** `src/lib/pages/shared.ts`:39-40
**Description:** The `isValidSocialLink()` function checks `url.startsWith("https://") && url.length <= 500`. This prevents `javascript:` scheme attacks and limits length, which addresses SEC-018 from Phase 3. However, it allows any string that starts with `https://` up to 500 chars -- including strings with spaces, newlines, or other characters that are not valid URLs. For example, `https://example.com" onclick="alert(1)` would pass validation. The `escapeHtml()` call on the URL when rendering prevents attribute breakout (the `"` is escaped to `&quot;`), so this is not exploitable in practice.
**Risk:** Low. escapeHtml prevents exploitation. The validation is a defence-in-depth layer that could be strengthened.
**Recommendation:** Use a stricter URL validation that checks for valid URL structure, or at minimum reject URLs containing characters that are never valid in URLs (newlines, spaces, quotes).
**Fix Applied:** No (informational -- escapeHtml prevents exploitation)

---

### SEC-026: No Build Timeout / Stuck "building" State Recovery

**Severity:** Low
**Category:** API
**File:** `supabase/functions/build/index.ts`:553-556
**Description:** The Edge Function sets `status: "building"` at line 555 before beginning the Netlify API calls. If the Edge Function crashes, times out, or the Deno runtime terminates unexpectedly between setting "building" and the final status update (lines 718-726), the site_spec will be stuck in "building" state permanently. The user would see an endless "Building..." state with no way to retry (the UI only shows "Build My Site" for "draft" or "error" states, line 271 of PreviewTab.tsx).

The Edge Function does correctly set `status: "error"` in both the zip failure catch (line 614) and the Netlify failure catch (line 698). However, it does not protect against Edge Function timeout, OOM, or other runtime termination scenarios.
**Risk:** Low. Edge Function timeouts are rare but possible. A stuck "building" state would require manual database intervention to fix.
**Recommendation:** Add a "building" timeout mechanism: either (1) a scheduled function that resets specs stuck in "building" for more than 5 minutes, or (2) check for stale "building" status at the start of a new build request and reset it. This is a resilience concern, not a security vulnerability per se.
**Fix Applied:** No (requires Dev Agent -- changes status management logic)

---

### SEC-027: Subdomain Slug Collision After Random Suffix Still Possible

**Severity:** Low
**Category:** API
**File:** `supabase/functions/build/index.ts`:575-593
**Description:** The subdomain slug generation checks for uniqueness against existing site_specs, and appends a 4-character random suffix if a collision is found. However: (1) the random suffix is only 4 characters from a 36-char alphabet (1.6M combinations), meaning collisions are possible at scale, and (2) after appending the suffix, uniqueness is not re-checked. If two users simultaneously create slugs that collide, the second uniqueness check might pass for both before either writes. This is a TOCTOU (time-of-check-time-of-use) race condition.
**Risk:** Low. At the current expected scale (hundreds to low thousands of sites), the probability of collision is negligible. The Netlify site name would also fail to create if it already exists, providing an additional guard.
**Recommendation:** Add a unique constraint on `subdomain_slug` in the database schema and handle the constraint violation error with a retry loop. This provides database-level guarantees regardless of race conditions.
**Fix Applied:** No (requires Dev Agent -- changes database interaction logic)

---

## Prior Findings Follow-Up

### SEC-017 (Phase 3): Custom Colour Hex Validation -- ADDRESSED

The Phase 3 finding recommended validating custom colours as hex before Phase 4. This has been implemented in `src/lib/site-generator.ts`:43-70 via `isValidHexColour()` with regex `/^#[0-9a-fA-F]{6}$/` and `validateCustomColours()`. Invalid custom colours trigger a fallback to the sage_sand preset. This correctly prevents CSS injection via colour values in the generated site output.

### SEC-018 (Phase 3): Social Link URL Validation -- ADDRESSED

The Phase 3 finding recommended validating social links to require `https://` and limit length. This has been implemented in `src/lib/pages/shared.ts`:37-54 via `isValidSocialLink()` which requires `https://` prefix and enforces a 500-character limit. The `getValidSocialLinks()` function filters out invalid entries before they reach page generators. Links are also escaped via `escapeHtml()` when rendered.

---

## Checklist Results

### Authentication & Authorization
- [PASS] JWT authentication properly validated via `userClient.auth.getUser()` in build Edge Function
- [PASS] User ownership verification: `siteSpec.user_id !== user.id` check at line 510
- [PASS] Service role key used only server-side, never returned in responses
- [PASS] Netlify API token read from env, never exposed in client responses

### Data Security
- [PASS] Build Edge Function uses service role only for status updates and spec fetching; user auth is validated first
- [PASS] Error messages are generic, no internal details exposed (except SEC-023 file path echo)
- [PASS] API keys (NETLIFY_API_TOKEN, SUPABASE_SERVICE_ROLE_KEY) not hardcoded
- [PASS] Generated site files are produced client-side from the user's own spec data

### Frontend Security (Generated Sites)
- [PASS] escapeHtml() covers all 5 required characters: `<` `>` `&` `"` `'`
- [PASS] escapeHtml() applied to: business_name, doula_name, tagline, bio, philosophy, service title/description/price, testimonial quote/name/context, training_provider, service_area, email, phone, booking_url, social link URLs and platform names, photo publicUrl and altText
- [PASS] JSON-LD script tags sanitised via `.replace(/</g, "\\u003c")` -- **SEC-021 RESOLVED**
- [PASS] booking_url scheme-validated (http/https only) -- **SEC-022 RESOLVED**
- [PASS] No `dangerouslySetInnerHTML` or `innerHTML` usage
- [PASS] Iframe sandbox attributes present (`allow-scripts allow-same-origin`)
- [PASS] All external links have `rel="noopener noreferrer"`

### Frontend Security (Admin Dashboard)
- [PASS] React JSX auto-escaping prevents XSS in dashboard components
- [PASS] build error messages displayed via JSX expression (auto-escaped)
- [PASS] deploy_url used as iframe src and href -- server constructs this as `https://{slug}.birthbuild.com`, safe pattern

### API Security (Build Edge Function)
- [PASS] Rate limiting: 5 builds/hour per user (in-memory per-instance)
- [PASS] File count limit: 50 files maximum
- [PASS] File size limit: 5MB per file
- [PASS] ZIP size limit: 50MB total
- [PASS] CORS properly configured with allowlist
- [PASS] Method restricted to POST only
- [PASS] UUID format validation on site_spec_id -- **SEC-019 RESOLVED**
- [PASS] File path sanitisation for zip entries (regex allowlist + traversal checks) -- **SEC-020 RESOLVED**
- [WARN] Error response echoes user file path -- **SEC-023** (Low)

### Subdomain & Slug Security
- [PASS] slugify() strips all non-alphanumeric characters, enforces lowercase, 63-char limit
- [PASS] Reserved slug list prevents takeover of system subdomains
- [PASS] Uniqueness check against existing site_specs
- [WARN] No re-check after suffix append, TOCTOU race -- **SEC-027** (Low)

### Zip Creation Security
- [PASS] Total zip size checked against MAX_ZIP_SIZE_BYTES
- [PASS] File paths in zip validated via SAFE_PATH_REGEX allowlist -- **SEC-020 RESOLVED**

### Dependencies
- [PASS] `npm audit` reports 0 vulnerabilities
- [PASS] No unnecessary dependencies introduced (all new code is custom)
- [PASS] Lockfile present and committed

---

## Summary

| Severity | Count | Resolved | Open |
|----------|-------|----------|------|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 4 | 4 (SEC-019, SEC-020, SEC-021, SEC-022) | 0 |
| Low | 5 | 0 | 5 (SEC-023, SEC-024, SEC-025, SEC-026, SEC-027) |
| **Total** | **9** | **4** | **5** |

### Prior Finding Follow-Up
| Finding | Status |
|---------|--------|
| SEC-017 (Custom colour hex validation) | ADDRESSED in site-generator.ts -- no regression |
| SEC-018 (Social link URL validation) | ADDRESSED in shared.ts -- no regression |

---

### Merge Recommendation

**APPROVE.** All four Medium findings from Round 1 have been correctly fixed by the Dev Agent in commit `e16e802` and verified in Round 2. The Phase 4 implementation demonstrates strong security awareness: comprehensive HTML escaping via escapeHtml(), JSON-LD script sanitisation, URL scheme validation, UUID input validation, file path allowlisting, JWT authentication, ownership verification, rate limiting, file size/count limits, CORS configuration, and proper secret isolation. The prior Phase 3 findings (SEC-017, SEC-018) have both been addressed with no regressions.

**Remaining Low/informational findings (do not block merge):**

- SEC-023 (Low): Error response echoes user file path (mitigated by React JSX auto-escaping)
- SEC-024 (Low): Custom colour validation only in site-generator (current call path is safe)
- SEC-025 (Low): Social link validation allows non-URL https:// strings (mitigated by escapeHtml)
- SEC-026 (Low): No build timeout / stuck building state recovery (resilience concern, not security)
- SEC-027 (Low): Subdomain slug collision after suffix (negligible at current scale)

---

## Previous Review (Phase 3)

The Phase 3 security review is preserved below for reference.

---

# Security Review — Phase 3: Dashboard Form Editor

**Date:** 2026-02-15T19:30:00Z
**Branch:** phase-3-dashboard-form-editor
**PR:** #3
**Reviewer:** Security Agent
**Result:** ISSUES FOUND (7 findings)

---

## Round 2 Review (2026-02-15)

The Dev Agent addressed the three findings that required action before merge (SEC-013, SEC-012, SEC-014) in commit `a262313`. All three fixes have been verified and are correct.

### SEC-013 (High): Supabase Storage Bucket Policies -- VERIFIED FIXED

**File:** `supabase/migrations/002_storage_policies.sql`
**Verification:**
- Bucket created as private (`public = false`) with `ON CONFLICT` for idempotency
- INSERT policy (`users_upload_own_photos`): scoped to `authenticated` role, `WITH CHECK` verifies `bucket_id = 'photos'`, `foldername(name)[1] = 'photos'`, and `foldername(name)[2] = auth.uid()::text`
- SELECT policy (`users_read_own_photos`): same scoping with `USING` clause
- DELETE policy (`users_delete_own_photos`): same scoping with `USING` clause
- All three policies correctly enforce that users can only access objects under `photos/{their_user_id}/`, matching the upload path structure in `usePhotoUpload.ts`

### SEC-012 (Medium): File Extension Derived from MIME Type -- VERIFIED FIXED

**File:** `src/hooks/usePhotoUpload.ts`
**Verification:**
- `MIME_TO_EXT` mapping defined at lines 10-14 covering all three allowed types (`image/jpeg` -> `jpg`, `image/png` -> `png`, `image/webp` -> `webp`)
- Extension lookup at line 102 uses `MIME_TO_EXT[file.type]` instead of the previous `file.name.split(".").pop()`
- Unknown MIME types are rejected (lines 103-107) with early return and user-facing error message, rather than falling back to a default extension. This is more secure than the suggested `?? "jpg"` fallback
- No remaining reference to filename-based extension derivation

### SEC-014 (Medium): Storage Path Verified Before Delete -- VERIFIED FIXED

**File:** `src/hooks/usePhotoUpload.ts`
**Verification:**
- Path verification at lines 159-163 checks `!user || !storagePath.startsWith(\`photos/${user.id}/\`)`
- Check runs before any database or storage operations
- Rejects with "Invalid storage path." error and returns early on failure
- `useCallback` dependency array correctly updated from `[]` to `[user]` to reflect the new `user` reference inside the callback

### New Findings or Regressions: NONE

No new security findings or regressions were introduced by the fix commit.

---

## Round 2 Verdict

**Result:** CLEAN (0 new findings, 3/3 requested fixes verified)

The three findings that required action before merge (SEC-013, SEC-012, SEC-014) have all been correctly addressed. The remaining four findings from Round 1 (SEC-015, SEC-016, SEC-017, SEC-018) are all Low severity, informational, and do not block merge. They should be addressed before Phase 4 (site generation) when user-provided values will be rendered to the public.

---

## Round 1 Findings (Original Review)

### SEC-012: Photo Upload File Extension Derived from User-Controlled Filename

**Severity:** Medium
**Category:** API
**File:** `src/hooks/usePhotoUpload.ts`:94
**Description:** The file extension for the storage path is extracted directly from the user-supplied filename using `file.name.split(".").pop()`. While the `file.type` is validated against `ALLOWED_TYPES` (JPEG, PNG, WebP), the extension itself is not validated. A user could upload a valid JPEG file renamed to `photo.svg` or `photo.html`, and the storage path would be `photos/{userId}/headshot-{timestamp}.svg`. This creates a mismatch between the validated MIME type and the stored file extension.
**Risk:** Low-to-medium depending on Supabase Storage Content-Type handling.
**Recommendation:** Derive the extension from the validated MIME type rather than the filename.
**Fix Applied:** Yes (by Dev Agent in commit `a262313`) -- **VERIFIED ROUND 2**

---

### SEC-013: No Supabase Storage Bucket Policies Defined in Migration

**Severity:** High
**Category:** Data
**File:** `supabase/migrations/001_initial_schema.sql` (missing section)
**Description:** The migration creates a `photos` table with proper RLS policies, but there are no Supabase Storage bucket policies defined anywhere in the codebase. Without explicit storage policies, the bucket may not exist in production, or could be publicly readable/writable.
**Risk:** High. Without proper storage bucket policies, uploaded photos may be publicly accessible to unauthenticated users, or users may be able to read/write/delete files belonging to other users.
**Recommendation:** Add a storage bucket migration with private bucket creation and user-scoped policies.
**Fix Applied:** Yes (by Dev Agent in commit `a262313`) -- **VERIFIED ROUND 2**

---

### SEC-014: Photo Delete Accepts Client-Supplied Storage Path Without Verification

**Severity:** Medium
**Category:** Data
**File:** `src/hooks/usePhotoUpload.ts`:142-162
**Description:** The `deletePhoto` function accepts a `storagePath` parameter directly from the calling component and passes it to storage deletion without verifying it belongs to the current user.
**Risk:** Medium. Without path verification, a modified client could pass an arbitrary storage path to delete another user's files.
**Recommendation:** Verify that the storage path starts with `photos/{user.id}/` before proceeding.
**Fix Applied:** Yes (by Dev Agent in commit `a262313`) -- **VERIFIED ROUND 2**

---

### SEC-015: No Client-Side Rate Limiting on "Ask AI" Button

**Severity:** Low
**Category:** API
**File:** `src/components/dashboard/AskAiButton.tsx`:35-56
**Description:** The "Ask AI" button calls `sendChatMessage()` on every click with no client-side debounce or cooldown. The button does have a `loading` state that prevents re-clicking while a request is in flight.
**Risk:** Low. Server-side rate limiting (30 req/min per user) provides adequate protection.
**Recommendation:** Add a brief cooldown after successful AI generation. Informational only.
**Fix Applied:** No (informational -- server-side rate limiting provides adequate protection)

---

### SEC-016: Console.error Logs Supabase Error Objects in Photo Upload Hook

**Severity:** Low
**Category:** Data
**File:** `src/hooks/usePhotoUpload.ts`:49, 106, 126, 152, 175
**Description:** The `usePhotoUpload` hook logs full Supabase error objects to the browser console in five places. These error objects may contain internal details such as table names, column names, and RLS policy error messages.
**Risk:** Low. Information disclosure via browser DevTools only.
**Recommendation:** Replace with development-only logging using `import.meta.env.DEV`.
**Fix Applied:** No (informational -- low priority)

---

### SEC-017: Custom Colour Values Used in Inline Styles Without Validation

**Severity:** Low
**Category:** Frontend
**File:** `src/components/dashboard/PaletteSelector.tsx`:79, `src/components/dashboard/CustomColourPicker.tsx`:49
**Description:** Custom colour values from `siteSpec.custom_colours` are used directly in inline `style` attributes. The values originate from native `<input type="color">` elements but could be modified directly via Supabase client.
**Risk:** Low for Phase 3 (self-XSS only). Could become Medium in Phase 4 when colours are rendered into generated sites.
**Recommendation:** Validate that colour values conform to hex format (`/^#[0-9a-fA-F]{6}$/`) before rendering. Address before Phase 4.
**Fix Applied:** ADDRESSED in Phase 4 via `validateCustomColours()` in `src/lib/site-generator.ts`

---

### SEC-018: Social Link URLs Not Validated Beyond HTML5 type="url"

**Severity:** Low
**Category:** Frontend
**File:** `src/components/dashboard/ContactTab.tsx`:244-249
**Description:** Social media link inputs use `type="url"` for basic validation but there is no application-level validation of URL scheme, domain matching, or length.
**Risk:** Low for Phase 3 (values only displayed to the user who entered them). Could become Medium in Phase 4 when rendered as clickable links.
**Recommendation:** Add URL validation that only allows `https://` scheme and limits length. Address before Phase 4.
**Fix Applied:** ADDRESSED in Phase 4 via `isValidSocialLink()` in `src/lib/pages/shared.ts`
