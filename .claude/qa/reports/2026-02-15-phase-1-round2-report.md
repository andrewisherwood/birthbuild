# QA Report -- Phase 1: Foundation & Auth (Round 2)

**Date:** 2026-02-15T19:30:00Z
**Branch:** phase-1-foundation-auth (via qa/phase-1-review merge)
**PR:** #1
**Result:** PASS (10/10 tests passed)

---

## Context

This is a Round 2 re-review following the security audit. The Security Agent identified 6 findings (SEC-001 through SEC-006), three of which (SEC-001, SEC-002, SEC-003) were Critical/High and required Dev Agent fixes before merge. This review verifies that all required security fixes have been correctly applied, the build still passes, and no regressions have been introduced.

---

## Test Results

### TC-001: npm install completes without errors
**Status:** PASS
**Steps:** Ran `npm install` in the project root.
**Result:** Installed successfully with 0 vulnerabilities.

### TC-002: TypeScript strict mode -- zero errors
**Status:** PASS
**Steps:** Ran `npx tsc --noEmit`.
**Result:** Completed with zero errors and zero output (clean).

### TC-003: Production build succeeds
**Status:** PASS
**Steps:** Ran `npm run build`.
**Result:** Build completed in 2.21s. Output: `dist/index.html`, `dist/assets/index-*.css` (16.37 kB), `dist/assets/index-*.js` (360.53 kB). No warnings.

### TC-004: SEC-001 Fix -- profiles_own_all policy removed, replaced with separate SELECT and UPDATE
**Status:** PASS
**Steps:** Searched `001_initial_schema.sql` for `profiles_own_all` and `FOR ALL` on the profiles table.
**Verification:**
- `profiles_own_all` policy: NOT FOUND (correctly removed)
- `FOR ALL` on profiles: NOT FOUND (correctly removed)
- `profiles_own_select` policy (FOR SELECT): FOUND at line 119
- `profiles_own_update` policy (FOR UPDATE with CHECK): FOUND at line 124
**Result:** The overly permissive `FOR ALL` policy has been replaced with granular `SELECT` and `UPDATE` policies, preventing users from inserting or deleting their own profile rows via RLS.

### TC-005: SEC-001/SEC-002 Fix -- BEFORE UPDATE trigger prevents role/tenant_id/session_id modification
**Status:** PASS
**Steps:** Searched `001_initial_schema.sql` for the immutable fields trigger.
**Verification:**
- Function `prevent_profile_field_changes()` defined at line 130-144
- Raises exception if `role` is changed (line 133)
- Raises exception if `tenant_id` is changed (line 136)
- Raises exception if `session_id` is changed (line 139)
- Function is `SECURITY DEFINER` (runs with owner privileges, not caller)
- Trigger `enforce_profile_immutable_fields` attached at line 146-148 as `BEFORE UPDATE FOR EACH ROW`
**Result:** Users cannot escalate privileges or cross tenant boundaries by modifying their profile.

### TC-006: SEC-001 Fix -- CHECK constraint on role column
**Status:** PASS
**Steps:** Searched `001_initial_schema.sql` for role constraint.
**Verification:** Line 113: `alter table public.profiles add constraint valid_role check (role in ('student', 'instructor', 'admin'));`
**Result:** The role column is constrained to only valid values at the database level.

### TC-007: SEC-003 Fix -- claude_api_key in separate tenant_secrets table
**Status:** PASS
**Steps:** Verified `claude_api_key` is NOT in the `tenants` table definition and IS in the `tenant_secrets` table.
**Verification:**
- `tenants` table (lines 8-16): No `claude_api_key` column -- CORRECT
- `tenant_secrets` table (lines 39-44): Has `claude_api_key text` column -- CORRECT
- RLS enabled on `tenant_secrets` (line 46)
- `owner_only` policy restricts access to tenant owners only (lines 49-56)
- `TenantSecret` TypeScript interface defined in `database.ts` (line 21)
- `Tenant` TypeScript interface does NOT include `claude_api_key` -- CORRECT
**Result:** API keys are isolated in a separate table with owner-only access, preventing students from reading the instructor's Claude API key.

### TC-008: CHECK constraints on sessions.status and site_specs.status
**Status:** PASS
**Steps:** Searched for CHECK constraints on status columns.
**Verification:**
- Line 71: `sessions.status` constrained to `('active', 'archived', 'completed')`
- Line 168: `site_specs.status` constrained to `('draft', 'building', 'live', 'error')` (inline constraint)
**Result:** Both status columns have database-level validation preventing invalid values.

### TC-009: SEC-004 Fix -- console.warn removed from useAuth.ts
**Status:** PASS
**Steps:** Searched `src/hooks/useAuth.ts` for any `console.warn`, `console.log`, `console.error`, or `console.info` calls.
**Verification:** Zero matches found. The `fetchProfile` function (line 30-36) now has a comment `// SEC-004: Do not log Supabase error details to the console.` and simply returns `null` without logging.
**Result:** No Supabase error details are leaked to the browser console.

### TC-010: SEC-006 Fix -- Login form has cooldown mechanism
**Status:** PASS
**Steps:** Searched `src/routes/index.tsx` for cooldown implementation.
**Verification:**
- `MAGIC_LINK_COOLDOWN_SECONDS = 60` constant (line 6)
- `cooldownRemaining` state and `cooldownTimer` ref (lines 14-15)
- `startCooldown()` function starts 60-second countdown (lines 18-35)
- Cooldown triggered after successful magic link send (line 74)
- Submit button disabled during cooldown: `disabled={sending || isCoolingDown}` (line 150)
- Button text shows countdown: `Please wait ${cooldownRemaining}s` (line 157)
- "Use a different email address" button also disabled during cooldown (line 99)
- Timer cleanup on unmount (lines 37-43)
**Result:** Rate-limiting UX implemented with a 60-second cooldown after each magic link request.

---

## Additional Verification

### No `any` types in source
Searched all files under `src/` for `: any` -- zero matches found. TypeScript strict mode is properly enforced.

### No regressions
The `tsc --noEmit` and `npm run build` both pass cleanly after the security changes, confirming no regressions were introduced.

### updated_at trigger on tenant_secrets
The new `tenant_secrets` table also has an `updated_at` trigger (line 309-311), consistent with all other tables.

---

## Summary

- Passed: 10
- Failed: 0
- Total: 10

All 6 security findings from the audit have been addressed:

| Finding | Severity | Status |
|---------|----------|--------|
| SEC-001: Privilege escalation via profile self-update | Critical | FIXED |
| SEC-002: Tenant boundary bypass via profile self-update | High | FIXED |
| SEC-003: Claude API key exposed to tenant members | High | FIXED |
| SEC-004: Console warning leaks Supabase errors | Low | FIXED |
| SEC-005: Seed file test passwords | Low | Accepted (local dev only) |
| SEC-006: No client-side rate limiting on login | Low | FIXED |

The PR is ready to merge.
