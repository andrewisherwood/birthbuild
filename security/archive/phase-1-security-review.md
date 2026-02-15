# Security Review — Phase 1: Foundation & Auth

**Date:** 2026-02-15T18:00:00Z
**Branch:** phase-1-foundation-auth
**PR:** #1
**Reviewer:** Security Agent
**Result:** ISSUES FOUND (6 findings)

---

## Automated Findings Triage

No automated findings were present in `SECURITY.md` at the time of review.

---

## Findings

### SEC-001: Privilege Escalation via Profile Self-Update (role column)

**Severity:** Critical
**Category:** Auth
**File:** `supabase/migrations/001_initial_schema.sql`:90-93
**Description:** The `profiles_own_all` RLS policy grants `FOR ALL` (SELECT, INSERT, UPDATE, DELETE) on the `profiles` table to any user where `auth.uid() = id`. There is no CHECK constraint on the `role` column and no column-level restriction in the policy. A student can execute `UPDATE profiles SET role = 'instructor' WHERE id = auth.uid()` via the Supabase client to escalate their privileges to instructor (or any arbitrary string).
**Risk:** A student gains instructor-level access, can view all other students' data within the tenant, manage sessions, and access admin routes. This completely breaks the multi-tenancy authorization model.
**Recommendation:** Replace the `profiles_own_all` policy with separate SELECT and UPDATE policies. The UPDATE policy should explicitly exclude the `role`, `tenant_id`, and `session_id` columns from user modification. The simplest approach:

1. Drop the `profiles_own_all` policy.
2. Create a SELECT policy: `FOR SELECT USING (auth.uid() = id)`.
3. Create an UPDATE policy that only allows modification of safe columns (`display_name`, `email`). This can be achieved by adding a BEFORE UPDATE trigger that resets protected columns to their original values:

```sql
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Prevent users from modifying their own role, tenant_id, or session_id
  NEW.role := OLD.role;
  NEW.tenant_id := OLD.tenant_id;
  NEW.session_id := OLD.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
```

4. Additionally, add a CHECK constraint on role: `ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'instructor', 'admin'));`

**Fix Applied:** No (requires Dev Agent -- changes RLS policies and requires trigger logic)

---

### SEC-002: Tenant Boundary Bypass via Profile Self-Update (tenant_id, session_id)

**Severity:** High
**Category:** Data
**File:** `supabase/migrations/001_initial_schema.sql`:90-93
**Description:** The same `profiles_own_all` policy that enables SEC-001 also allows a user to change their own `tenant_id` and `session_id`. A student in Tenant A could update their `tenant_id` to Tenant B's UUID, and subsequent RLS policies (`tenant_members_read`, `sessions_student_read`, `profiles_instructor_read`, `site_specs_instructor_read`, `photos_instructor_read`) would then grant them read access to Tenant B's data.
**Risk:** Complete tenant isolation bypass. A malicious user can read data from any tenant by changing their profile's `tenant_id`. This undermines the entire multi-tenancy security model.
**Recommendation:** Same fix as SEC-001 -- the BEFORE UPDATE trigger that resets `role`, `tenant_id`, and `session_id` to their original values prevents both privilege escalation and tenant boundary bypass. These columns should only be set by service-role operations (e.g., during the invite flow or by an Edge Function).
**Fix Applied:** No (requires Dev Agent -- changes RLS policies)

---

### SEC-003: Claude API Key Exposed to Tenant Members via RLS SELECT Policy

**Severity:** High
**Category:** Data
**File:** `supabase/migrations/001_initial_schema.sql`:28-34
**Description:** The `tenant_members_read` policy on the `tenants` table grants `FOR SELECT` to any user whose `profiles.tenant_id` matches the tenant `id`. This SELECT is on all columns, including `claude_api_key`. Students in a tenant can query `SELECT claude_api_key FROM tenants WHERE id = '<their-tenant-id>'` to retrieve the instructor's Claude API key in plaintext.
**Risk:** API key theft. A student extracts the instructor's Claude API key and uses it for their own purposes, incurring costs on the instructor's account. The CLAUDE.md states: "Instructor Claude API keys encrypted at rest in Supabase" -- but the current schema stores it as plaintext `text` and exposes it via RLS.
**Recommendation:** Two approaches (implement both):

1. **Column-level fix:** Revoke direct SELECT on `claude_api_key` from the `authenticated` role. Use column-level grants or create a Postgres VIEW that excludes the column for non-owners. Alternatively, move the API key to a separate `tenant_secrets` table with a restrictive RLS policy that only the tenant owner can SELECT.
2. **Encryption:** Encrypt the API key before storage (using `pgcrypto` or application-level encryption in the Edge Function). The key should only be decrypted server-side in Edge Functions, never returned to any client.

**Fix Applied:** No (requires Dev Agent -- changes RLS policies and data architecture)

---

### SEC-004: Console Warning Logs Supabase Error Messages

**Severity:** Low
**Category:** Data
**File:** `src/hooks/useAuth.ts`:32
**Description:** The `fetchProfile` function logs Supabase error messages to the browser console via `console.warn("Could not fetch profile:", error.message)`. While error messages from Supabase are generally non-sensitive, this practice can leak internal implementation details (table names, column names, RLS policy failure messages) to anyone with browser DevTools open.
**Risk:** Minor information disclosure. An attacker could use these error messages to understand database structure and RLS configuration, aiding further attacks.
**Recommendation:** Remove the `console.warn` or wrap it in a development-only check: `if (import.meta.env.DEV) console.warn(...)`.
**Fix Applied:** No (informational -- low priority, can be addressed in a future phase)

---

### SEC-005: Seed File Contains Hardcoded Test Passwords

**Severity:** Low
**Category:** Auth
**File:** `supabase/seed.sql`:13,23
**Description:** The seed file creates test users with the password `testpassword123`. The seed file is clearly marked "local development" and the passwords are properly hashed with bcrypt (`crypt(..., gen_salt('bf'))`). However, the plaintext password string `testpassword123` is visible in the committed source.
**Risk:** Negligible in practice -- this is seed data for local dev only and would not run in production. The risk is that someone mistakenly runs this in a production-adjacent environment.
**Recommendation:** Add a comment in the seed file explicitly warning against running it in production. Consider adding an environment check at the top of the seed file.
**Fix Applied:** No (informational -- seed is local dev only)

---

### SEC-006: No Client-Side Rate Limiting on Magic Link Form

**Severity:** Low
**Category:** API
**File:** `src/routes/index.tsx`:29-43
**Description:** The magic link login form has no client-side rate limiting or cooldown after submission. While Supabase Auth applies server-side rate limits (typically 1 email per 60 seconds per address), the client allows rapid repeated submissions which result in Supabase error responses.
**Risk:** Low -- server-side rate limiting is the real protection. However, without client-side throttling, a user or bot can trigger many server-side rate limit checks, and error messages from Supabase could be used to enumerate valid email addresses (depending on Supabase configuration).
**Recommendation:** Add a simple cooldown timer (e.g., 60 seconds) after a successful magic link submission. The submitted state already exists in the code and could disable the form for a period. This is a UX improvement as much as a security measure.
**Fix Applied:** No (informational -- Supabase server-side rate limiting provides the real protection)

---

## Checklist Results

### Authentication & Authorization
- [x] Auth tokens handled securely -- Supabase JS client manages tokens; no manual token handling in code
- [x] Session management follows best practices -- uses Supabase built-in session with refresh token rotation enabled (`config.toml`)
- [FAIL] Role-based access control properly enforced -- **SEC-001**: role column unprotected in RLS, users can self-escalate
- [x] Password handling uses proper hashing -- seed data uses bcrypt (`gen_salt('bf')`)

### Data Security
- [FAIL] Supabase RLS policies in place for all accessed tables -- RLS is enabled on all 5 tables, but **SEC-001/SEC-002/SEC-003** expose critical vulnerabilities in the policy logic
- [x] Sensitive data not logged or exposed in error messages -- minor console.warn (SEC-004)
- [x] API keys and secrets not hardcoded in source files -- only `VITE_` prefixed env vars used in client code
- [x] User data properly validated before database operations -- HTML5 input validation, Supabase types

### Frontend Security
- [x] No XSS vectors -- no `dangerouslySetInnerHTML`, no `innerHTML`, all user input rendered through React's built-in escaping
- [x] No unsafe `innerHTML` or `dangerouslySetInnerHTML` usage
- [N/A] CSRF protection on state-changing requests -- Supabase uses token-based auth (Authorization header), not cookies
- [x] Sensitive data not stored in localStorage without encryption -- only Supabase session token (standard practice)

### API Security
- [N/A] Rate limiting on authentication endpoints -- handled by Supabase server-side; SEC-006 notes client-side gap
- [N/A] Rate limiting on resource-intensive endpoints -- no custom API endpoints in this phase
- [x] Input validation on all API parameters -- email input validated via HTML5 `type="email"` + `required`
- [x] Proper error responses -- Supabase error messages forwarded, no stack traces exposed to users

### Dependencies
- [x] No known vulnerable packages added -- `npm audit` reports 0 vulnerabilities
- [x] No unnecessary dependencies introduced -- minimal dependency set (react, react-dom, react-router-dom, supabase-js)
- [x] Lockfile updated consistently -- `package-lock.json` present and committed

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 2 |
| Medium | 0 |
| Low | 3 |
| **Total** | **6** |
| Fixed by Security Agent | 0 |

### Critical Items Requiring Dev Agent Action Before Merge

**SEC-001** and **SEC-002** must be fixed before this PR is merged. The `profiles_own_all` RLS policy allows any authenticated user to escalate their role to `instructor` and/or change their tenant assignment, completely bypassing authorization and tenant isolation. The recommended fix is to:
1. Replace the single `FOR ALL` policy with separate `SELECT` and `UPDATE` policies.
2. Add a `BEFORE UPDATE` trigger on `profiles` that prevents modification of `role`, `tenant_id`, and `session_id`.
3. Add a `CHECK` constraint on the `role` column.

**SEC-003** should also be fixed before merge. The `claude_api_key` stored in the `tenants` table is readable by all tenant members (including students) through the `tenant_members_read` policy. This field should be excluded from client-accessible queries or moved to a separate secrets table with owner-only access.
