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
**Fix Applied:** No (informational -- self-XSS only in current phase)

---

### SEC-018: Social Link URLs Not Validated Beyond HTML5 type="url"

**Severity:** Low
**Category:** Frontend
**File:** `src/components/dashboard/ContactTab.tsx`:244-249
**Description:** Social media link inputs use `type="url"` for basic validation but there is no application-level validation of URL scheme, domain matching, or length.
**Risk:** Low for Phase 3 (values only displayed to the user who entered them). Could become Medium in Phase 4 when rendered as clickable links.
**Recommendation:** Add URL validation that only allows `https://` scheme and limits length. Address before Phase 4.
**Fix Applied:** No (informational -- no cross-user risk in current phase)

---

## Checklist Results

### Authentication & Authorization
- [PASS] Auth tokens handled securely -- Supabase JS client manages tokens; no manual token handling
- [PASS] Session management follows best practices -- refresh token rotation enabled in config.toml
- [PASS] Role-based access control properly enforced -- dashboard checks `useAuth().user` before rendering
- [N/A] Password handling -- no password flows in this phase

### Data Security
- [PASS] Supabase RLS policies in place for photos and site_specs tables
- [PASS] Storage bucket policies defined with user-scoped access (SEC-013 fixed)
- [WARN] Console.error logs Supabase error objects -- **SEC-016** (Low)
- [PASS] API keys and secrets not hardcoded in source files
- [PASS] User data validated before database operations

### Frontend Security
- [PASS] No XSS vectors -- no `dangerouslySetInnerHTML`, no `innerHTML` usage
- [PASS] No unsafe DOM manipulation
- [N/A] CSRF protection -- Supabase uses token-based auth (Authorization header)
- [PASS] No sensitive data stored in localStorage -- Supabase session only
- [WARN] Custom colours and social links have minimal validation -- **SEC-017**, **SEC-018** (Low, address before Phase 4)

### API Security
- [PASS] Rate limiting on chat Edge Function (30 req/min per user)
- [PASS] Input validation on chat messages (length, payload size, message array)
- [PASS] Proper error responses -- generic messages to user, details logged server-side
- [WARN] No client-side rate limiting on Ask AI button -- **SEC-015** (Low, informational)

### Photo Upload Security
- [PASS] File type validation present (MIME type check for JPEG/PNG/WebP)
- [PASS] File extension derived from validated MIME type (SEC-012 fixed)
- [PASS] File size limit enforced (5MB client-side)
- [PASS] Storage bucket policies enforce user-scoped access (SEC-013 fixed)
- [PASS] Delete verifies storage path belongs to current user (SEC-014 fixed)

### Dependencies
- [PASS] No known vulnerable packages -- `npm audit` reports 0 vulnerabilities
- [PASS] No unnecessary dependencies introduced
- [PASS] Lockfile present and committed

---

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 0 | 0 |
| High | 1 | 1 (SEC-013) |
| Medium | 2 | 2 (SEC-012, SEC-014) |
| Low | 4 | 0 (informational) |
| **Total** | **7** | **3** |
| Fixed by Dev Agent | 3 | |
| Fixed by Security Agent | 0 | |

### Merge Recommendation

**APPROVE.** All three findings that required action before merge (SEC-013 High, SEC-012 Medium, SEC-014 Medium) have been correctly implemented and verified. The remaining four findings are Low severity and informational, appropriate to address before Phase 4 (site generation).
