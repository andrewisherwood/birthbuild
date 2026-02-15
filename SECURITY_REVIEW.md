# Security Review — Phase 1: Foundation & Auth

**Date:** 2026-02-15T21:30:00Z
**Branch:** phase-1-foundation-auth
**PR:** #1
**Reviewer:** Security Agent
**Review Round:** 2 (re-review after Dev Agent fixes)
**Result:** PASS (0 open Critical/High findings)

---

## Review Round 2 — Verification of Dev Agent Fixes

The Dev Agent applied fixes for SEC-001, SEC-002, SEC-003, SEC-004, SEC-006, and NOTE-002.
This round verifies each fix and checks for any new issues introduced.

---

## Original Findings — Status

### SEC-001: Privilege Escalation via Profile Self-Update (role column)

**Severity:** Critical
**Category:** Auth
**Original File:** `supabase/migrations/001_initial_schema.sql`
**Status:** RESOLVED

**Verification:**
1. The `profiles_own_all` FOR ALL policy has been removed. -- CONFIRMED
2. Replaced with separate `profiles_own_select` (FOR SELECT, line 119-121) and `profiles_own_update` (FOR UPDATE, lines 123-127). -- CONFIRMED
3. A `BEFORE UPDATE` trigger `enforce_profile_immutable_fields` (lines 146-148) calls `prevent_profile_field_changes()` (lines 130-144) which raises an exception if `role`, `tenant_id`, or `session_id` are modified. -- CONFIRMED
4. A CHECK constraint `valid_role` restricts the `role` column to `('student', 'instructor', 'admin')` (line 113). -- CONFIRMED

**Assessment:** The fix is thorough. The trigger uses `RAISE EXCEPTION` (hard fail) rather than silently resetting values, which is the correct approach -- it prevents the update entirely and provides clear feedback. The CHECK constraint provides a second layer of defense at the data level. The `SECURITY DEFINER` on the trigger function is appropriate as it only performs comparisons and raises exceptions, with no data reads or writes.

**Note for future phases:** The trigger blocks ALL updates to `role`/`tenant_id`/`session_id`, including service-role operations. When invite flows or admin role-assignment features are built, the trigger will need a conditional check (e.g., `IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN RETURN NEW; END IF;`) to allow server-side operations through. This is not a bug in Phase 1 since no such operations exist yet.

---

### SEC-002: Tenant Boundary Bypass via Profile Self-Update (tenant_id, session_id)

**Severity:** High
**Category:** Data
**Original File:** `supabase/migrations/001_initial_schema.sql`
**Status:** RESOLVED

**Verification:**
The same `prevent_profile_field_changes()` trigger (lines 136-141) that fixes SEC-001 also prevents modification of `tenant_id` and `session_id`. Any attempt to change these fields raises an exception. -- CONFIRMED

**Assessment:** Complete fix. Tenant isolation is now enforced at the database level via the trigger. Combined with the removal of the `FOR ALL` policy, there is no client-side path to modify these fields.

---

### SEC-003: Claude API Key Exposed to Tenant Members via RLS SELECT Policy

**Severity:** High
**Category:** Data
**Original File:** `supabase/migrations/001_initial_schema.sql`
**Status:** RESOLVED

**Verification:**
1. `claude_api_key` column removed from the `tenants` table (lines 8-16). -- CONFIRMED
2. New `tenant_secrets` table created (lines 39-44) with `claude_api_key` column. -- CONFIRMED
3. RLS enabled on `tenant_secrets` (line 46). -- CONFIRMED
4. `owner_only` policy (lines 49-56) restricts all operations to the tenant owner only, using a subquery: `tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())`. -- CONFIRMED
5. TypeScript types updated: `TenantSecret` interface added (lines 21-26 of `src/types/database.ts`), `claude_api_key` removed from `Tenant` interface. -- CONFIRMED
6. `updated_at` auto-update trigger added for `tenant_secrets` (line 309-311). -- CONFIRMED

**Assessment:** Complete fix. The API key is now isolated in a separate table that only the tenant owner can access. Students and other tenant members have zero visibility into this table. The remaining recommendation from Round 1 (encryption at rest) is a future enhancement and not a blocking issue for Phase 1.

---

### SEC-004: Console Warning Logs Supabase Error Messages

**Severity:** Low
**Category:** Data
**Original File:** `src/hooks/useAuth.ts`:32
**Status:** RESOLVED

**Verification:**
1. `console.warn` removed from `fetchProfile()` (line 32 of `useAuth.ts`). The function now silently returns `null` on error with a comment: "SEC-004: Do not log Supabase error details to the console." -- CONFIRMED
2. `signInWithMagicLink` now returns a generic error message: "Unable to send magic link. Please try again." instead of forwarding the Supabase error detail (line 109). -- CONFIRMED
3. Grep for `console.log|warn|debug|error|trace` across `src/` returns zero matches. -- CONFIRMED

**Assessment:** Complete fix. No Supabase implementation details are leaked to the browser console.

---

### SEC-005: Seed File Contains Hardcoded Test Passwords

**Severity:** Low
**Category:** Auth
**File:** `supabase/seed.sql`:13,23
**Status:** ACCEPTED (no change required)

This finding was informational. The seed file is clearly marked for local development only. The passwords are properly hashed with bcrypt. No fix was requested and none is needed for Phase 1.

---

### SEC-006: No Client-Side Rate Limiting on Magic Link Form

**Severity:** Low
**Category:** API
**Original File:** `src/routes/index.tsx`
**Status:** RESOLVED

**Verification:**
1. A 60-second cooldown constant defined at line 7: `MAGIC_LINK_COOLDOWN_SECONDS = 60`. -- CONFIRMED
2. `startCooldown()` callback (lines 18-35) starts an interval timer that counts down from 60 to 0. -- CONFIRMED
3. Submit button is disabled during cooldown: `disabled={sending || isCoolingDown}` (line 151). -- CONFIRMED
4. Button text shows remaining cooldown: `Please wait ${cooldownRemaining}s` (line 157). -- CONFIRMED
5. "Use a different email address" button is also disabled during cooldown (line 99). -- CONFIRMED
6. Timer is properly cleaned up on unmount (lines 37-43). -- CONFIRMED

**Assessment:** Complete fix. The 60-second cooldown prevents rapid repeated magic link requests. The timer cleanup prevents memory leaks. Note this is client-side only -- server-side rate limiting (Supabase Auth's built-in limits) remains the primary protection.

---

### NOTE-002: Session Status Unconstrained

**Severity:** Informational
**Category:** Data
**Original File:** `supabase/migrations/001_initial_schema.sql`
**Status:** RESOLVED

**Verification:**
Line 71: `alter table public.sessions add constraint valid_session_status check (status in ('active', 'archived', 'completed'));` -- CONFIRMED

---

## New Issues Check

### Scan for New Vulnerabilities Introduced by Fixes

| Check | Result |
|-------|--------|
| New `SECURITY DEFINER` functions safe? | Yes -- `prevent_profile_field_changes()` only compares OLD/NEW and raises exceptions; no data access |
| New RLS policies correct? | Yes -- `profiles_own_select` and `profiles_own_update` correctly scoped with `auth.uid() = id` |
| `tenant_secrets` RLS owner-only? | Yes -- subquery verifies `owner_id = auth.uid()` |
| No INSERT/DELETE policies on profiles? | Correct -- only SELECT and UPDATE (plus instructor read) |
| No new console.log/warn/error? | Confirmed -- zero matches in `src/` |
| No XSS vectors introduced? | Confirmed -- cooldown text uses React JSX expressions, not `innerHTML` |
| No new hardcoded secrets? | Confirmed -- no new env vars or API keys in source |
| No new dangerous functions (eval, innerHTML, etc.)? | Confirmed -- zero matches in `src/` |

**No new security issues found.**

---

## Checklist Results (Updated)

### Authentication & Authorization
- [x] Auth tokens handled securely -- Supabase JS client manages tokens; no manual token handling in code
- [x] Session management follows best practices -- uses Supabase built-in session with refresh token rotation
- [x] Role-based access control properly enforced -- SEC-001 FIXED: CHECK constraint + BEFORE UPDATE trigger + separate RLS policies
- [x] Password handling uses proper hashing -- seed data uses bcrypt (`gen_salt('bf')`)

### Data Security
- [x] Supabase RLS policies in place for all accessed tables -- RLS enabled on all 6 tables (tenants, tenant_secrets, sessions, profiles, site_specs, photos) with correct policy logic
- [x] Sensitive data not logged or exposed in error messages -- SEC-004 FIXED: no console logging, generic error messages
- [x] API keys and secrets not hardcoded in source files -- only `VITE_` prefixed env vars in client code; API keys in owner-only `tenant_secrets` table
- [x] User data properly validated before database operations -- HTML5 input validation, CHECK constraints, Supabase types

### Frontend Security
- [x] No XSS vectors -- no `dangerouslySetInnerHTML`, no `innerHTML`, all user input rendered through React's built-in escaping
- [x] No unsafe `innerHTML` or `dangerouslySetInnerHTML` usage
- [N/A] CSRF protection on state-changing requests -- Supabase uses token-based auth (Authorization header), not cookies
- [x] Sensitive data not stored in localStorage without encryption -- only Supabase session token (standard practice)

### API Security
- [x] Rate limiting on authentication endpoints -- Supabase server-side + 60s client cooldown (SEC-006 FIXED)
- [N/A] Rate limiting on resource-intensive endpoints -- no custom API endpoints in this phase
- [x] Input validation on all API parameters -- email input validated via HTML5 `type="email"` + `required`; DB CHECK constraints on role and session status
- [x] Proper error responses -- generic error messages, no stack traces, no internal details exposed

### Dependencies
- [x] No known vulnerable packages added
- [x] No unnecessary dependencies introduced
- [x] Lockfile updated consistently

---

## Summary

| Severity | Original Count | Resolved | Open |
|----------|---------------|----------|------|
| Critical | 1 | 1 | 0 |
| High | 2 | 2 | 0 |
| Medium | 0 | 0 | 0 |
| Low | 3 | 2 | 1 (SEC-005 accepted) |
| **Total** | **6** | **5** | **1 (accepted)** |

### Verdict: PASS

All Critical and High findings (SEC-001, SEC-002, SEC-003) have been properly resolved. The Dev Agent's fixes are thorough and introduce no new vulnerabilities. The remaining open finding (SEC-005) is informational and accepted as-is for local development seed data.

This PR is clear to merge from a security perspective.
