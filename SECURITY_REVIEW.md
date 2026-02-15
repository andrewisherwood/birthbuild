# Security Review — Phase 3: Dashboard Form Editor

**Date:** 2026-02-15T19:30:00Z
**Branch:** phase-3-dashboard-form-editor
**PR:** #3
**Reviewer:** Security Agent
**Result:** ISSUES FOUND (7 findings)

---

## Automated Findings Triage

No automated findings were present in `SECURITY.md` at the time of review.

---

## Findings

### SEC-012: Photo Upload File Extension Derived from User-Controlled Filename

**Severity:** Medium
**Category:** API
**File:** `src/hooks/usePhotoUpload.ts`:94
**Description:** The file extension for the storage path is extracted directly from the user-supplied filename using `file.name.split(".").pop()`. While the `file.type` is validated against `ALLOWED_TYPES` (JPEG, PNG, WebP), the extension itself is not validated. A user could upload a valid JPEG file renamed to `photo.svg` or `photo.html`, and the storage path would be `photos/{userId}/headshot-{timestamp}.svg`. This creates a mismatch between the validated MIME type and the stored file extension.

The specific concern is twofold:
1. A file named `photo.html` with valid JPEG content would pass the MIME type check but be stored with an `.html` extension. If the Supabase Storage bucket serves files with `Content-Type` derived from the extension (which is configurable), a browser might interpret it as HTML, enabling stored XSS if user content were embedded.
2. A filename containing path separators (e.g., `../../../evil.jpg`) could in theory cause path traversal, though Supabase Storage SDK likely sanitises this.

Additionally, `file.name.split(".").pop()` on a file with no extension returns the full filename, not an empty string, which could produce unexpected storage paths.

**Risk:** Low-to-medium depending on Supabase Storage Content-Type handling. If storage serves files based on extension rather than detected MIME type, a mismatch could enable stored XSS via HTML or SVG file extension injection.
**Recommendation:** Derive the extension from the validated MIME type rather than the filename:
```typescript
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ext = MIME_TO_EXT[file.type] ?? "jpg";
```
**Fix Applied:** No (requires Dev Agent -- modifies upload logic in usePhotoUpload hook)

---

### SEC-013: No Supabase Storage Bucket Policies Defined in Migration

**Severity:** High
**Category:** Data
**File:** `supabase/migrations/001_initial_schema.sql` (missing section)
**Description:** The migration creates a `photos` table with proper RLS policies, but there are no Supabase Storage bucket policies defined anywhere in the codebase. The `usePhotoUpload.ts` hook uploads files to a `photos` bucket (`supabase.storage.from("photos")`), but no SQL migration or configuration creates this bucket or defines its access policies.

Without explicit storage policies:
1. The bucket may not exist in production, causing all uploads to fail silently.
2. If created manually via the Supabase dashboard with default settings, it could be publicly readable (allowing anyone to enumerate and download all uploaded photos) or publicly writable (allowing anyone to upload files to any path).
3. The `deletePhoto` function calls `supabase.storage.from("photos").remove([storagePath])` where `storagePath` is passed from the client. If storage policies are not scoped to the user's own path prefix, a user could potentially delete another user's files by passing a different `storagePath`.

**Risk:** High. Without proper storage bucket policies, uploaded photos may be publicly accessible to unauthenticated users, or users may be able to read/write/delete files belonging to other users. The RLS on the `photos` table only protects the metadata row -- it does not protect the actual file in storage.
**Recommendation:** Add a storage bucket migration that:
1. Creates the `photos` bucket (private, not public).
2. Adds storage policies that restrict uploads to the `photos/{user_id}/` prefix for each authenticated user.
3. Adds storage policies that restrict reads/deletes to the user's own path prefix.

Example SQL to add in a new migration:
```sql
-- Create photos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', false);

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Allow authenticated users to read their own photos
CREATE POLICY "Users can read own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Allow authenticated users to delete their own photos
CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );
```
**Fix Applied:** No (requires Dev Agent -- involves creating a database migration for storage policies)

---

### SEC-014: Photo Delete Accepts Client-Supplied Storage Path Without Verification

**Severity:** Medium
**Category:** Data
**File:** `src/hooks/usePhotoUpload.ts`:142-162
**Description:** The `deletePhoto` function accepts a `storagePath` parameter directly from the calling component and passes it to `supabase.storage.from("photos").remove([storagePath])`. While the `photos` table DELETE is protected by RLS (only the photo's owner can delete the row), the storage file deletion uses whatever path the client provides. If the Supabase Storage bucket lacks scoped policies (see SEC-013), an attacker could call `deletePhoto` with any arbitrary storage path to delete another user's uploaded files.

The pattern in `PhotoUploadCard.tsx` passes `photo.storage_path` from the photos table row, which is trustworthy data (fetched via RLS-protected query). However, the function signature accepts any string, making it possible for modified client code to pass an arbitrary path.

**Risk:** Medium. Depends entirely on whether Supabase Storage bucket policies are in place (SEC-013). Without them, this is a path manipulation vulnerability that could allow cross-user file deletion.
**Recommendation:** Before deleting from storage, verify that the storage path belongs to the current user by checking it starts with `photos/{user.id}/`. This is a defence-in-depth measure that complements the storage bucket policies from SEC-013.
```typescript
if (!storagePath.startsWith(`photos/${user?.id}/`)) {
  setError("Invalid storage path.");
  return;
}
```
**Fix Applied:** No (requires Dev Agent -- modifies delete logic in usePhotoUpload hook)

---

### SEC-015: No Client-Side Rate Limiting on "Ask AI" Button

**Severity:** Low
**Category:** API
**File:** `src/components/dashboard/AskAiButton.tsx`:35-56
**Description:** The "Ask AI" button calls `sendChatMessage()` on every click with no client-side debounce or cooldown. While the chat Edge Function has server-side rate limiting (30 requests/minute per user), rapid clicking of the Ask AI button across multiple fields (Bio, Philosophy, Tagline) could quickly exhaust this quota, resulting in poor UX with 429 errors. There are multiple Ask AI buttons visible simultaneously on the Content tab.

The button does have a `loading` state that prevents re-clicking while a request is in flight, which provides some natural throttling. However, after a response arrives, the button is immediately clickable again.

**Risk:** Low. Server-side rate limiting is the real protection. The risk is primarily a UX concern (users hitting rate limits unexpectedly) rather than a security concern. The Edge Function rate limiter prevents actual abuse.
**Recommendation:** Add a brief cooldown (e.g., 5-10 seconds) after a successful AI generation before the button becomes active again. This is primarily a UX improvement that reduces server-side rate limit hits.
**Fix Applied:** No (informational -- server-side rate limiting provides adequate protection)

---

### SEC-016: Console.error Logs Supabase Error Objects in Photo Upload Hook

**Severity:** Low
**Category:** Data
**File:** `src/hooks/usePhotoUpload.ts`:49, 106, 126, 152, 175
**Description:** The `usePhotoUpload` hook logs full Supabase error objects to the browser console in five places (`console.error("Failed to fetch photos:", fetchError)`, `console.error("Photo upload failed:", uploadError)`, etc.). These error objects may contain internal details such as table names, column names, constraint names, RLS policy error messages, and storage bucket configuration details.

Similarly, `AskAiButton.tsx`:52 logs `console.error("Ask AI generation failed:", err)` which could contain Edge Function error details.

**Risk:** Low. Information disclosure via browser DevTools. An attacker with DevTools open could learn about database structure, storage configuration, and RLS policy names, aiding further attacks.
**Recommendation:** Replace `console.error` calls with development-only logging:
```typescript
if (import.meta.env.DEV) {
  console.error("Photo upload failed:", uploadError);
}
```
This follows the pattern already established in `useAuth.ts` after the Phase 1 SEC-004 finding.
**Fix Applied:** No (informational -- low priority, same pattern as SEC-004 from Phase 1)

---

### SEC-017: Custom Colour Values Used in Inline Styles Without Validation

**Severity:** Low
**Category:** Frontend
**File:** `src/components/dashboard/PaletteSelector.tsx`:79, `src/components/dashboard/CustomColourPicker.tsx`:49
**Description:** Custom colour values from `siteSpec.custom_colours` are used directly in inline `style` attributes (`style={{ backgroundColor: colours[key] }}`). These colours originate from native `<input type="color">` elements which constrain values to valid hex colour format (`#rrggbb`). However, the values stored in the database `custom_colours` JSONB column could be modified directly via the Supabase client to contain arbitrary CSS values.

In theory, a CSS injection payload like `red; background-image: url(https://evil.com/track)` could be stored and rendered. React's `style` prop does provide some protection against script injection (React serialises style values safely and does not allow `expression()` or `url()` in most cases), but CSS-based data exfiltration via `background-image` could still be possible in certain rendering contexts.

Importantly, these values are currently only rendered in the dashboard (the user's own view), so this is a self-XSS scenario with no cross-user impact. The risk would increase when these colours are used in the generated static site output (a future phase).

**Risk:** Low for Phase 3 (self-XSS only). Could become Medium in future phases when custom colours are rendered into generated sites viewed by the public.
**Recommendation:** Validate that colour values conform to the hex colour format before rendering:
```typescript
const HEX_COLOUR_RE = /^#[0-9a-fA-F]{6}$/;
function isValidHexColour(value: string): boolean {
  return HEX_COLOUR_RE.test(value);
}
```
Apply this validation both at the point of storage (in the debounced update) and at the point of rendering. This becomes more important when building the static site output.
**Fix Applied:** No (informational -- self-XSS only in current phase, should be addressed before Phase 4)

---

### SEC-018: Social Link URLs Not Validated Beyond HTML5 type="url"

**Severity:** Low
**Category:** Frontend
**File:** `src/components/dashboard/ContactTab.tsx`:244-249
**Description:** Social media link inputs use `type="url"` which provides basic HTML5 validation (requires a valid URL format), but there is no application-level validation of:
1. URL scheme (could accept `javascript:` or `data:` URLs in some browsers)
2. Domain matching (an "Instagram" field could contain a link to a phishing site)
3. URL length (extremely long URLs could cause display issues)

The social link values are stored in the `social_links` JSONB column and will eventually be rendered as clickable links on the generated static site.

**Risk:** Low for Phase 3 (values only displayed in the dashboard to the user who entered them). Could become Medium in future phases when rendered as hyperlinks in the generated site, potentially exposing site visitors to `javascript:` URLs or phishing links.
**Recommendation:** Add URL validation that:
1. Only allows `https://` scheme (reject `http://`, `javascript:`, `data:`, `ftp://`)
2. Optionally validates against expected domains for each platform (e.g., Instagram field should contain `instagram.com`)
3. Limits URL length to a reasonable maximum (e.g., 500 characters)

This validation should be implemented before Phase 4 (site generation) at the latest.
**Fix Applied:** No (informational -- no cross-user risk in current phase)

---

## Checklist Results

### Authentication & Authorization
- [PASS] Auth tokens handled securely -- Supabase JS client manages tokens; no manual token handling
- [PASS] Session management follows best practices -- refresh token rotation enabled in config.toml
- [PASS] Role-based access control properly enforced -- dashboard checks `useAuth().user` before rendering, SEC-001/SEC-002 from Phase 1 were fixed (trigger protects immutable fields)
- [N/A] Password handling -- no password flows in this phase

### Data Security
- [PASS] Supabase RLS policies in place for photos and site_specs tables
- [WARN] Storage bucket policies NOT defined in migration -- **SEC-013**
- [WARN] Console.error logs Supabase error objects -- **SEC-016**
- [PASS] API keys and secrets not hardcoded in source files
- [PASS] User data validated before database operations (debounced updates via RLS-protected queries)

### Frontend Security
- [PASS] No XSS vectors -- no `dangerouslySetInnerHTML`, no `innerHTML` usage
- [PASS] No unsafe DOM manipulation
- [N/A] CSRF protection -- Supabase uses token-based auth (Authorization header)
- [PASS] No sensitive data stored in localStorage -- Supabase session only (standard practice)
- [WARN] Custom colours and social links have minimal validation -- **SEC-017**, **SEC-018**

### API Security
- [PASS] Rate limiting on chat Edge Function (30 req/min per user) -- Ask AI reuses this
- [PASS] Input validation on chat messages (length, payload size, message array)
- [PASS] Proper error responses -- generic messages to user, details logged server-side
- [WARN] No client-side rate limiting on Ask AI button -- **SEC-015** (server-side covers this)

### Photo Upload Security
- [PASS] File type validation present (MIME type check for JPEG/PNG/WebP)
- [WARN] File extension derived from filename, not MIME type -- **SEC-012**
- [PASS] File size limit enforced (5MB client-side)
- [WARN] Storage path could accept unvalidated extensions -- **SEC-012**
- [FAIL] No storage bucket policies -- **SEC-013**
- [WARN] Delete accepts client-supplied path without verification -- **SEC-014**

### Dependencies
- [PASS] No known vulnerable packages -- `npm audit` reports 0 vulnerabilities
- [PASS] No unnecessary dependencies introduced
- [PASS] Lockfile present and committed

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 4 |
| **Total** | **7** |
| Fixed by Security Agent | 0 |

### Items Requiring Dev Agent Action Before Merge

**SEC-013 (High)** should be addressed before merge. The absence of Supabase Storage bucket policies means uploaded photos may be publicly accessible or that users could access/delete each other's files. This is the most significant finding in this review. A new migration should create the `photos` bucket with scoped policies restricting each user to their own `photos/{user_id}/` prefix.

### Items Recommended Before Phase 4 (Site Generation)

**SEC-012** (file extension from filename) and **SEC-014** (unverified storage path on delete) should be addressed before the generated site build phase, as file handling becomes more security-sensitive when files are served to the public.

**SEC-017** (custom colour validation) and **SEC-018** (social link URL validation) become more important when these values are rendered into publicly-visible generated sites.

### Overall Assessment

The Phase 3 dashboard implementation follows good security practices overall. The code uses the authenticated Supabase client for all database operations, RLS policies protect data access, error messages shown to users are generic, and there is no use of dangerous DOM APIs. The main gap is the missing Supabase Storage bucket policies (SEC-013), which is a deployment configuration issue rather than a code flaw. The remaining findings are low-severity defence-in-depth improvements.
