# Security Review -- Phase 5: Instructor Admin

**Date:** 2026-02-15T20:30:00Z (Round 1), 2026-02-15T21:00:00Z (Round 2)
**Branch:** phase-5-instructor-admin
**PR:** #5
**Reviewer:** Security Agent
**Result:** CLEAN after Round 2 (3/3 mandatory fixes verified, 0 new findings)

---

## Round 2: Fix Verification

**Fix Commit:** `bb8e39b` — `dev: address SEC-028 SEC-029 SEC-030 from security review`

### SEC-028 (High): Cross-Tenant Profile Reassignment -- VERIFIED FIXED

**File:** `supabase/functions/invite/index.ts`:342-360
**What was fixed:**
1. The `.select("id")` query was changed to `.select("id, tenant_id")` to include tenant information (line 344)
2. A guard `existingProfile.tenant_id !== tenantId` was added before the session_id update (line 353)
3. When the guard triggers, the request is rejected with error `"This email belongs to a different organisation."` and processing continues to the next email via `continue` (lines 354-359)

**Verification:**
- The select includes `tenant_id` -- CONFIRMED at line 344
- The guard prevents cross-tenant session_id updates -- CONFIRMED at lines 353-359
- No magic link is generated for cross-tenant users (the `continue` skips the entire block) -- CONFIRMED
- The update at lines 365-370 only executes for same-tenant profiles -- CONFIRMED

**Note on error message:** The error `"This email belongs to a different organisation."` confirms to the caller that the email IS registered in a different tenant. This is a minor user-enumeration signal. The original recommendation suggested treating it as "user does not exist" to prevent enumeration. The dev agent chose a more informative error message, which is a valid UX trade-off. The user-enumeration aspect was already documented as a secondary concern in the Round 1 risk description and is LOW severity. The primary threat (cross-tenant write) is fully mitigated.

**Verdict:** RESOLVED

---

### SEC-029 (Medium): Rate Limiter Logic -- VERIFIED FIXED

**File:** `supabase/functions/invite/index.ts`:55-73
**What was fixed:**
The rate limiter was restructured to check-before-increment:
```typescript
if (entry.count + emailCount > RATE_LIMIT_MAX) {
  return true;   // Rate limited — count NOT incremented
}

entry.count += emailCount;
return false;     // Allowed — count incremented
```

**Verification (scenario trace):**
- User at count=90, sends 15: `90 + 15 = 105 > 100` -- returns true, count stays 90 -- CONFIRMED
- User at count=90, sends 10: `90 + 10 = 100 > 100` is false -- falls through, count becomes 100 -- CONFIRMED
- User at count=100, sends 1: `100 + 1 = 101 > 100` -- returns true, count stays 100 -- CONFIRMED
- Fresh user sends 10: no entry, creates entry with count=10, returns false -- CONFIRMED

**Key properties verified:**
1. Rejected requests do NOT inflate the counter -- CONFIRMED
2. The counter only increments after the check passes -- CONFIRMED
3. The effective limit is 100 emails per hour (count + new must exceed 100 to reject) -- CONFIRMED

**Verdict:** RESOLVED

---

### SEC-030 (Medium): Cache-Control on Magic Links Response -- VERIFIED FIXED

**File:** `supabase/functions/invite/index.ts`:461
**What was fixed:**
`Cache-Control: no-store` header added to the success response:
```typescript
headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
```

**Verification:**
- The header is on the status 200 response that contains magic links in the results array -- CONFIRMED at line 461
- Error responses (4xx) do not include this header, but they also do not contain magic links, so this is correct
- `no-store` instructs browsers, proxies, and CDNs not to cache this response at all

**Verdict:** RESOLVED

---

## New Findings from Fix Review

No new vulnerabilities were introduced by the fixes. The changes are strictly:
- An additional column in a select query (additive, no new attack surface)
- A conditional guard with `continue` (reduces attack surface)
- A reordering of check-vs-increment in the rate limiter (reduces attack surface)
- An additional response header (additive, improves security posture)

---

## Prior Findings Regression Check (Round 2)

| Finding | File | Check | Status |
|---------|------|-------|--------|
| SEC-017 (Phase 3) | `src/lib/site-generator.ts` | `isValidHexColour()` present | No regression |
| SEC-018 (Phase 3) | `src/lib/pages/shared.ts` | `isValidSocialLink()` present | No regression |
| SEC-019 (Phase 4) | `supabase/functions/build/index.ts` | `UUID_REGEX` validation present | No regression |
| SEC-020 (Phase 4) | `supabase/functions/build/index.ts` | `SAFE_PATH_REGEX` allowlist present | No regression |
| SEC-021 (Phase 4) | `src/lib/pages/home.ts` | `.replace(/</g, "\\u003c")` present | No regression |
| SEC-022 (Phase 4) | `src/lib/pages/contact.ts` | `bookingUrl.startsWith("https://")` present | No regression |

---

## Round 2 Summary

| Metric | Value |
|--------|-------|
| Mandatory fixes requested (Round 1) | 3 (SEC-028, SEC-029, SEC-030) |
| Fixes verified correct (Round 2) | 3/3 |
| New vulnerabilities introduced | 0 |
| Prior finding regressions | 0 |
| Open Low/informational findings | 4 (SEC-031, SEC-032, SEC-033, SEC-034) |

### Merge Recommendation

**APPROVE.** All three mandatory fixes (SEC-028 High, SEC-029 Medium, SEC-030 Medium) have been correctly implemented and verified. No new vulnerabilities were introduced. No regressions on prior findings. Four Low/informational findings remain open and do not block merge.

---
---

## Round 1 Findings

### SEC-028: Cross-Tenant Profile Reassignment via Existing User Re-Invite

**Severity:** High
**Category:** Auth
**File:** `supabase/functions/invite/index.ts`:339-357
**Description:** When the invite Edge Function encounters an existing user by email, it unconditionally updates their `session_id` to the calling instructor's session, using the service role client (which bypasses RLS). The email lookup at line 339-343 searches ALL profiles across ALL tenants because it uses `serviceClient`:

```typescript
const { data: existingProfile } = await serviceClient
  .from("profiles")
  .select("id")
  .eq("email", email)
  .maybeSingle();
```

If the email belongs to a student in Tenant B, an instructor from Tenant A can "re-invite" that student, which updates the student's `session_id` to a session belonging to Tenant A. The update at lines 351-357 does not verify that the existing profile's `tenant_id` matches the caller's tenant:

```typescript
await serviceClient
  .from("profiles")
  .update({
    session_id: body.session_id,
    updated_at: new Date().toISOString(),
  })
  .eq("id", userId);
```

This also generates a magic link for the cross-tenant user, which would allow them to log in and potentially see data scoped to their original tenant (the magic link authenticates via their existing auth user, whose profile still has the original `tenant_id`).

**Risk:** High. An instructor can modify the `session_id` of users belonging to other tenants. This violates the multi-tenancy isolation boundary. While the `tenant_id` itself is not modified (so RLS still scopes data reads to the original tenant), the session_id change is itself a cross-tenant write. Additionally, this could enable information disclosure: if an instructor enters random email addresses, the different error responses ("Failed to create account" vs success with magic link) reveal whether an email is already registered -- a user enumeration vector.

**Recommendation:** Before updating an existing profile's session_id, verify that the profile belongs to the caller's tenant:

```typescript
const { data: existingProfile } = await serviceClient
  .from("profiles")
  .select("id, tenant_id")
  .eq("email", email)
  .maybeSingle();

if (existingProfile) {
  if (existingProfile.tenant_id !== tenantId) {
    // Treat as if user does not exist to prevent enumeration
    // OR: create a new profile in the caller's tenant
    results.push({ email, success: false, error: "Failed to process invite." });
    continue;
  }
  // Safe to update session_id -- same tenant
  ...
}
```

**Fix Applied:** No (requires Dev Agent -- changes authorization logic in invite flow)

---

### SEC-029: Rate Limiter Counts Emails Before Validation, Allowing Abuse Window

**Severity:** Medium
**Category:** API
**File:** `supabase/functions/invite/index.ts`:55-69, 265
**Description:** The `isRateLimited()` function at line 265 is called with `body.emails.length` BEFORE the individual email validation loop. The function adds `emailCount` to the running count at line 67:

```typescript
entry.count += emailCount;
return entry.count > RATE_LIMIT_MAX;
```

This means the rate limiter counts all emails in the request, including invalid ones that will be rejected during processing. However, the more significant issue is that the rate limiter counts the emails BEFORE checking the limit. Consider:
- Instructor has sent 90 invites this hour (count = 90)
- Instructor sends a request with 50 emails
- `isRateLimited()` sets count to 140, then returns `true` (140 > 100)
- Request is rejected -- correct
- But the count is now 140, not 90

On the next request (even with 1 email), the count becomes 141, and remains rate-limited. This is not a bypass but rather an overly aggressive limiter that permanently inflates the count beyond the window. More importantly, if the instructor sends exactly 100 emails in the first request, the count goes to 100, and `isRateLimited()` returns `false` (100 is not > 100, since `>` not `>=`). So the actual per-hour limit is 100, not 99.

The off-by-one (`>` vs `>=`) means the effective limit is 100 emails, not "up to 100" -- which is arguably correct since the constant is named `RATE_LIMIT_MAX = 100`.

**Risk:** Medium. The count inflation is a denial-of-service risk against the instructor's own rate limit. Invalid emails count against the rate limit. The off-by-one is minor.
**Recommendation:** (1) Check the rate limit BEFORE incrementing: `if (entry.count + emailCount > RATE_LIMIT_MAX)`. Only increment after the check passes. (2) Only count successfully processed emails against the rate limit, or count after validation.
**Fix Applied:** No (requires Dev Agent -- changes rate limiting logic)

---

### SEC-030: Magic Links Returned in API Response Body

**Severity:** Medium
**Category:** Auth
**File:** `supabase/functions/invite/index.ts`:426-430, `src/routes/admin/students.tsx`:498-506
**Description:** The invite Edge Function returns magic link URLs in the JSON response body (`linkData.properties.action_link`). These magic links are single-use authentication tokens that grant access to the invited student's account. The magic links are:

1. Transmitted over HTTPS (secure in transit)
2. Displayed in the instructor's browser UI with a "Copy magic link" button
3. Stored in React component state (not persisted to localStorage or disk)

While the security notes in the brief state "Links are returned to the instructor (trusted party) for distribution", returning raw authentication tokens in API response bodies carries risk:
- The response may be cached by browser, proxy, or CDN (though POST responses are typically not cached)
- The tokens appear in browser DevTools Network tab and may be visible in browser history
- If the instructor's machine is compromised, all magic links from that session are exposed
- There is no expiry enforcement beyond Supabase's default magic link expiry (1 hour per CLAUDE.md)

**Risk:** Medium. Magic links are sensitive authentication material. Their exposure in the API response body increases the attack surface compared to server-side-only email delivery. However, the design intent is for the instructor to manually distribute these links, which requires client-side access to the URLs.
**Recommendation:** Consider: (1) Sending magic links directly via email from the Edge Function (using Supabase's built-in email or a transactional email service) instead of returning them to the client. (2) If client-side distribution is required, add `Cache-Control: no-store` to the response headers to prevent caching. (3) Log a warning in the Supabase audit log when magic links are generated via the admin API. This is an architectural design concern, not a simple fix.
**Fix Applied:** No (requires Dev Agent -- architectural decision about invite delivery method)

---

### SEC-031: Console.error Logs Email Addresses in Edge Function

**Severity:** Low
**Category:** Data
**File:** `supabase/functions/invite/index.ts`:367-369, 393-395, 414-416, 433
**Description:** The Edge Function logs email addresses in `console.error` statements when operations fail:

```typescript
console.error(`[invite] Failed to create user for ${email}:`, ...);
console.error(`[invite] Failed to create profile for ${email}:`, ...);
console.error(`[invite] Failed to generate link for ${email}:`, ...);
console.error(`[invite] Unexpected error for ${email}:`, detail);
```

Email addresses are personally identifiable information (PII). Logging PII to server console output means it will appear in Supabase Edge Function logs, which may be retained for varying periods depending on the Supabase plan. Under GDPR (relevant since this app uses British English and likely serves UK users), PII in logs must be handled with the same care as PII in databases.

**Risk:** Low. Server-side logs are not user-accessible, but PII in logs complicates GDPR data subject access requests and right-to-erasure compliance.
**Recommendation:** Log a hashed or truncated version of the email (e.g., `j***@example.com`) or use a request-scoped correlation ID instead of the raw email address.
**Fix Applied:** No (informational -- requires Dev Agent to change logging pattern)

---

### SEC-032: Client-Side Email Validation Regex Mismatch with Server-Side

**Severity:** Low
**Category:** Frontend
**File:** `src/routes/admin/students.tsx`:68, `supabase/functions/invite/index.ts`:47
**Description:** Both the client and server use the same basic email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. While consistent, this regex is deliberately permissive and allows some unusual but technically valid patterns. This is acceptable for a "basic format check" as described in the brief. The client validation at `students.tsx`:68 runs `EMAIL_REGEX.test(e)` on each parsed email before sending to the server.

The client-side `parseEmails()` function at `students.tsx`:70-74 splits on commas and newlines, trims, and lowercases. The server-side code at `invite/index.ts`:329 also trims and lowercases. This is consistent.

However, the client does not enforce the 50-email limit before sending -- it only displays "Maximum 50 at a time" as helper text. The server enforces this at line 249. A user could paste 100 emails and the client would send all 100 to the server, which would reject the request.

**Risk:** Low. The server correctly enforces the 50-email limit. The client-side lack of enforcement only results in a wasted HTTP request and a clear error message.
**Recommendation:** Add client-side enforcement: `if (emails.length > 50) { setInviteError("Maximum 50 emails per request."); return; }` in the `handleInvite()` function. This is a UX improvement, not a security issue.
**Fix Applied:** No (informational -- server-side enforcement is in place)

---

### SEC-033: SpecViewer Does Not Validate specId Format Before Database Query

**Severity:** Low
**Category:** Frontend
**File:** `src/components/admin/SpecViewer.tsx`:104 (line 223 of diff)
**Description:** The `SpecViewer` component receives a `specId` prop and passes it directly to a Supabase `.eq("id", specId)` query without validating that it is a valid UUID. The `specId` comes from `student.site_spec.id` in the students table, which is populated from a Supabase query result (so it should always be a valid UUID). However, defence-in-depth suggests validating the format.

The SpecViewer uses the anon client (not service role), so RLS applies. The query would simply return no results if the ID is invalid.

**Risk:** Low. RLS protects the data. The specId originates from a prior database query result, not from user input. Postgres will reject non-UUID values at the database layer.
**Recommendation:** Add a UUID format check before the query, consistent with the pattern established in the build and invite Edge Functions. This is a defence-in-depth suggestion.
**Fix Applied:** No (informational -- RLS and Postgres type checking provide adequate protection)

---

### SEC-034: No Client-Side Session Name Length Limit on Create

**Severity:** Low
**Category:** Frontend
**File:** `src/routes/admin/sessions.tsx`:82-85 (line 1110-1113 of diff), `src/hooks/useSessions.ts`:97-130
**Description:** The session creation form accepts a session name via a text input with no `maxLength` attribute. The `createSession` function in `useSessions.ts` passes the trimmed name directly to a Supabase insert. If the `sessions.name` column in the database has a character limit (e.g., `varchar(255)`), the database will reject overly long names. However, if it is `text` type (no limit), a user could create a session with an extremely long name.

The `archiveSession` function at `useSessions.ts`:132 correctly does not accept any name input.

**Risk:** Low. This is primarily a UX/data integrity concern. RLS ensures the insert is scoped to the instructor's tenant. The name is rendered in React JSX (auto-escaped), so XSS is not a concern.
**Recommendation:** Add `maxLength={255}` to the session name input field and/or validate length in the `createSession` function.
**Fix Applied:** No (informational -- database constraints and React JSX escaping provide adequate protection)

---

## Prior Findings Regression Check

### SEC-017 (Phase 3): Custom Colour Hex Validation -- NO REGRESSION

Still intact in `src/lib/site-generator.ts`. `isValidHexColour()` with `/^#[0-9a-fA-F]{6}$/` and `validateCustomColours()` still present. No changes to this file in Phase 5.

### SEC-018 (Phase 3): Social Link URL Validation -- NO REGRESSION

Still intact in `src/lib/pages/shared.ts`. `isValidSocialLink()` with `https://` prefix check and 500-char limit still present. No changes to this file in Phase 5.

### SEC-019 (Phase 4): UUID Format Validation on site_spec_id -- NO REGRESSION

Still intact in `supabase/functions/build/index.ts`:444-453. `UUID_REGEX` and validation check still present. No changes to this file in Phase 5.

### SEC-020 (Phase 4): File Path Sanitisation in Zip Creation -- NO REGRESSION

Still intact in `supabase/functions/build/index.ts`:476-508. `SAFE_PATH_REGEX` allowlist and traversal checks still present. No changes to this file in Phase 5.

### SEC-021 (Phase 4): JSON-LD Script Tag Breakout XSS -- NO REGRESSION

Still intact. `src/lib/pages/home.ts`:143 has `.replace(/</g, "\\u003c")` and `src/lib/pages/faq.ts`:116 has the same pattern. No changes to these files in Phase 5.

### SEC-022 (Phase 4): booking_url Scheme Validation -- NO REGRESSION

Still intact in `src/lib/pages/contact.ts`:57-63. `bookingUrl.startsWith("https://") || bookingUrl.startsWith("http://")` check still present. No changes to this file in Phase 5.

---

## Checklist Results

### Authentication & Authorization
- [PASS] JWT authentication properly validated via `userClient.auth.getUser()` in invite Edge Function (line 135-138)
- [PASS] Caller role verified as "instructor" via profile lookup (line 172)
- [PASS] Caller tenant_id verified before operations (line 182)
- [PASS] Session ownership verified: `session.tenant_id !== tenantId` check (line 298)
- [PASS] Session status verified as "active" before inviting (line 310)
- [PASS] Service role key used only server-side in Edge Function, never in client code
- [PASS] Admin routes protected by `ProtectedRoute` + `RoleGate role="instructor"` in `App.tsx`
- [PASS] Existing user re-invite verifies tenant ownership (Round 2: SEC-028 RESOLVED)

### Data Security
- [PASS] Client hooks (useSessions, useStudents) use anon Supabase client with RLS
- [PASS] SpecViewer uses anon client -- RLS `site_specs_instructor_read` scopes to tenant
- [PASS] Error messages to users are generic: "Failed to load sessions. Please try again.", etc.
- [PASS] No Supabase error details exposed in UI
- [WARN] Email addresses logged in server console.error -- **SEC-031** (Low)

### Frontend Security
- [PASS] No `dangerouslySetInnerHTML` or `innerHTML` usage in any new component
- [PASS] No `document.write` usage
- [PASS] All user-provided data rendered via React JSX auto-escaping
- [PASS] No `console.log` or `console.debug` in client-side code
- [PASS] No sensitive data stored in localStorage
- [PASS] External links use `target="_blank" rel="noopener noreferrer"` (SpecViewer lines 488-491, 514-517, 558-560)
- [PASS] No inline event handlers with string arguments (all use function references)

### API Security (Invite Edge Function)
- [PASS] Rate limiting: 100 invites per hour per instructor (in-memory per-instance)
- [PASS] Max 50 emails per request enforced (line 249)
- [PASS] UUID format validation on session_id via UUID_REGEX (line 229)
- [PASS] Email format validation per email in processing loop (line 332)
- [PASS] CORS properly configured with same allowlist as chat/build functions
- [PASS] Method restricted to POST only (line 105)
- [PASS] Proper JSON parse error handling with try/catch (lines 199-206)
- [PASS] Non-string email elements handled safely (line 329: `typeof rawEmail === "string"`)
- [PASS] Rate limiter uses check-before-increment logic (Round 2: SEC-029 RESOLVED)
- [PASS] Response includes Cache-Control: no-store header (Round 2: SEC-030 RESOLVED)

### Client-Side Hooks
- [PASS] useSessions scopes all queries by `profile.tenant_id` (lines 34, 49, 56, 109)
- [PASS] useStudents scopes profiles query by `profile.tenant_id` and `role: "student"` (lines 62-63)
- [PASS] useStudents scopes site_specs query by `user_id` from the already-filtered profile list (line 98)
- [PASS] SpecViewer fetches single spec by ID via anon client -- RLS enforced
- [PASS] UsageMetrics fetches counts via anon client scoped by tenantId -- RLS enforced
- [PASS] createSession inserts with tenant_id from profile (line 109)
- [PASS] archiveSession updates via anon client -- RLS `sessions_instructor_all` scopes to tenant

### Dependencies
- [PASS] `npm audit` reports 0 vulnerabilities
- [PASS] No new npm dependencies added in Phase 5
- [PASS] Edge Function uses same `@supabase/supabase-js@2.49.1` as chat/build functions
- [PASS] Lockfile present and committed

---

## Summary (Round 1)

| Severity | Count | Fixed by Dev Agent (Round 2) | Informational |
|----------|-------|------------------------------|---------------|
| Critical | 0 | 0 | 0 |
| High | 1 | 1 (SEC-028 RESOLVED) | 0 |
| Medium | 2 | 2 (SEC-029, SEC-030 RESOLVED) | 0 |
| Low | 4 | 0 | 4 (do not block merge) |
| **Total** | **7** | **3** | **4** |

### Prior Finding Follow-Up

| Finding | Status |
|---------|--------|
| SEC-017 (Custom colour hex validation) | No regression |
| SEC-018 (Social link URL validation) | No regression |
| SEC-019 (UUID format validation) | No regression |
| SEC-020 (File path sanitisation) | No regression |
| SEC-021 (JSON-LD script sanitisation) | No regression |
| SEC-022 (booking_url scheme validation) | No regression |

---

### Round 1 Merge Recommendation (superseded by Round 2)

**CHANGES REQUESTED.** SEC-028 (High) must be fixed before merge. SEC-029 and SEC-030 (Medium) should also be addressed.

### Round 2 Merge Recommendation (CURRENT)

**APPROVE.** All three mandatory fixes verified. See Round 2 section at top of document.

**Remaining Low findings (do not block merge):**
- SEC-031 (Low): PII in server logs (informational, GDPR concern)
- SEC-032 (Low): Client-side 50-email limit not enforced (server enforces correctly)
- SEC-033 (Low): SpecViewer specId not UUID-validated (RLS provides protection)
- SEC-034 (Low): No session name length limit (database constraints provide protection)

---

## Previous Reviews

The Phase 4 and Phase 3 security reviews are preserved in version control history.

---

# Previous Review: Phase 4: Build Pipeline & Deploy

**Date:** 2026-02-15T20:15:00Z
**Branch:** phase-4-build-pipeline-deploy
**PR:** #4
**Reviewer:** Security Agent
**Result:** CLEAN (0 open Medium+ findings)

Round 2 verified all four Medium findings (SEC-019, SEC-020, SEC-021, SEC-022) were correctly fixed. Five Low findings (SEC-023 through SEC-027) remain open and do not block merge. Prior Phase 3 findings (SEC-017, SEC-018) had no regressions.

---

# Previous Review: Phase 3: Dashboard Form Editor

**Date:** 2026-02-15T19:30:00Z
**Branch:** phase-3-dashboard-form-editor
**PR:** #3
**Reviewer:** Security Agent
**Result:** CLEAN after Round 2 (3/3 requested fixes verified)

Round 2 verified SEC-012, SEC-013, SEC-014 were correctly fixed. Four Low findings (SEC-015 through SEC-018) remain as informational.
