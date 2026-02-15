# Security Review — Phase 2: Chatbot Onboarding

**Date:** 2026-02-15T19:00:00Z
**Branch:** phase-2-chatbot-onboarding
**PR:** #2
**Reviewer:** Security Agent
**Result:** ISSUES FOUND (7 findings)

---

## Automated Findings Triage

No new automated findings were present in `SECURITY.md` at the time of review.

---

## Phase 1 Remediation Check

The Phase 1 security review identified 3 critical/high findings (SEC-001, SEC-002, SEC-003). Verification of the migration file `supabase/migrations/001_initial_schema.sql` confirms all three have been addressed:

- **SEC-001 (Role escalation):** Fixed. Separate `profiles_own_select` and `profiles_own_update` policies replace the old `profiles_own_all`. A `prevent_profile_field_changes()` trigger blocks modification of `role`, `tenant_id`, and `session_id`. A CHECK constraint restricts `role` to `('student', 'instructor', 'admin')`.
- **SEC-002 (Tenant boundary bypass):** Fixed. Same trigger prevents `tenant_id` and `session_id` modification.
- **SEC-003 (API key exposed):** Fixed. `claude_api_key` moved to a new `tenant_secrets` table with an `owner_only` RLS policy. Students cannot SELECT from `tenant_secrets` at all.

---

## Findings

### SEC-007: dangerouslySetInnerHTML Used for Message Rendering

**Severity:** Medium
**Category:** Frontend
**File:** `src/components/chat/MessageBubble.tsx`:128
**Description:** The `MessageBubble` component renders chat messages using `dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}`. While the `renderMarkdown` function correctly escapes HTML entities (`&`, `<`, `>`) BEFORE applying markdown transformations (bold, italic, lists), the use of `dangerouslySetInnerHTML` is inherently risky. Any future modification to the `renderMarkdown` function that adds a transformation before the escaping step, or introduces a regex that can be bypassed, would create an XSS vulnerability. Additionally, the bold and italic regex patterns (`.+?`) are greedy-minimal but could behave unexpectedly with edge-case input across multiple lines.
**Risk:** If the escaping logic is ever modified or bypassed, an attacker could inject arbitrary HTML/JavaScript into the chat display. Currently the escaping is correctly ordered and the immediate risk is low, but `dangerouslySetInnerHTML` is a well-known anti-pattern that warrants mitigation.
**Recommendation:** Replace `dangerouslySetInnerHTML` with a React-based markdown rendering approach. Options include:
1. Build a small React component that returns JSX elements for each markdown construct (paragraphs, bold, italic, lists) rather than generating HTML strings. This allows React's built-in escaping to handle all text content.
2. Use a lightweight markdown library like `react-markdown` that renders React elements natively.
3. At minimum, add a code comment warning that the HTML escaping on lines 29-31 MUST remain as the first transformation step.
**Fix Applied:** No (requires Dev Agent -- changes component rendering logic)

---

### SEC-008: Claude API Error Details Forwarded to Client

**Severity:** Medium
**Category:** API
**File:** `supabase/functions/chat/index.ts`:250-262
**Description:** When the Claude API returns a non-200 response, the Edge Function forwards the raw error text from Claude to the client in the `detail` field: `detail: errorText`. Claude API error responses can contain information about rate limits, model availability, API key format, account status, and internal error codes. This information is forwarded verbatim to the browser.
**Risk:** Information disclosure. A malicious user could intentionally trigger Claude API errors (e.g., by sending edge-case inputs) and extract information about the API configuration, model being used, and potentially partial API key information from error messages. This information could aid in further attacks or cost analysis.
**Recommendation:** Remove the `detail` field from the error response. Return only a generic error message: `{ "error": "The assistant is temporarily unavailable. Please try again." }`. Log the detailed error server-side (Deno's built-in logging or Supabase's function logs) for debugging.
**Fix Applied:** No (requires Dev Agent -- changes Edge Function response structure)

---

### SEC-009: Client Controls System Prompt Sent to Claude

**Severity:** Medium
**Category:** API
**File:** `supabase/functions/chat/index.ts`:218-219
**Description:** The Edge Function accepts a `system` field from the client request body and passes it directly to the Claude API call (`system: body.system`). While the intended flow has the client send the hardcoded `SYSTEM_PROMPT` constant from `src/lib/chat-prompts.ts`, there is nothing preventing a malicious user from sending a modified system prompt via a direct HTTP request to the Edge Function. A crafted system prompt could instruct Claude to ignore tool schemas, output data in unexpected formats, attempt to extract other users' data via tool calls, or bypass content safety guardrails.
**Risk:** Prompt injection at the system level. A malicious user could override the entire chatbot personality and instruction set. While this cannot directly access other users' data (the tool calls are validated client-side and RLS protects the database), it could be used to abuse the instructor's API key by making Claude perform unintended tasks, generate harmful content, or waste tokens.
**Recommendation:** Hardcode the system prompt in the Edge Function rather than accepting it from the client. Import or embed the `SYSTEM_PROMPT` constant server-side. If the system prompt must remain configurable for future features, validate it against an allowlist of known prompts (e.g., by comparing a hash).
**Fix Applied:** No (requires Dev Agent -- changes Edge Function request handling)

---

### SEC-010: Client Controls Tool Definitions Sent to Claude

**Severity:** Medium
**Category:** API
**File:** `supabase/functions/chat/index.ts`:223-225
**Description:** The Edge Function accepts a `tools` array from the client request body and passes it directly to the Claude API. While the `mapToolCallToSpecUpdate` function safely ignores unrecognized tool names (returning `null`), a malicious client could inject arbitrary tool definitions. This could cause Claude to call tools that are not part of the intended schema, or could be used to craft tool definitions that manipulate Claude's behavior (e.g., a tool named `reveal_system_prompt` that instructs Claude to output its system instructions).
**Risk:** Moderate. The tool response processing on the client side is defensive (unrecognized tools return `null`), which limits the direct impact. However, custom tool definitions could be used to waste API tokens or to manipulate Claude's responses in unexpected ways. Combined with SEC-009 (system prompt control), this gives a malicious user full control over the Claude API call using someone else's API key.
**Recommendation:** Hardcode the tool definitions in the Edge Function alongside the system prompt. Do not accept tools from the client. If tools must be configurable, validate the tool names against the known set: `["update_business_info", "update_style", "update_content", "update_contact", "generate_content", "update_pages", "mark_step_complete"]`.
**Fix Applied:** No (requires Dev Agent -- changes Edge Function request handling)

---

### SEC-011: Message Length Validation Only Checks Last Message

**Severity:** Medium
**Category:** API
**File:** `supabase/functions/chat/index.ts`:194-210
**Description:** The Edge Function enforces a 4,000-character limit on user messages, but only validates the last message in the array (`body.messages[body.messages.length - 1]`). A malicious client could send a conversation history with arbitrarily long earlier messages, or inject very long assistant messages to inflate the token count. The Claude API charges per token, and a single request with a manipulated history could consume a large number of input tokens.
**Risk:** Cost abuse. A malicious user could craft requests with extremely long conversation histories to consume the instructor's Claude API tokens. With the current 30 req/min rate limit and no total payload size limit, a determined attacker could rack up significant costs.
**Recommendation:** Add a total payload size limit. Either:
1. Validate ALL messages in the array (reject if any single message exceeds 4,000 characters), AND
2. Add a total request body size limit (e.g., 100KB) early in the handler, OR
3. Limit the total number of messages in the array (e.g., max 100 messages) as a proxy for conversation length.
**Fix Applied:** No (requires Dev Agent -- changes Edge Function validation logic)

---

### SEC-012: In-Memory Rate Limiting Resets on Cold Start

**Severity:** Low
**Category:** API
**File:** `supabase/functions/chat/index.ts`:22-38
**Description:** The rate limiter uses an in-memory `Map<string, RateLimitEntry>` which resets whenever the Deno Edge Function runtime creates a new isolate (cold start). Supabase Edge Functions may spin up multiple isolates under load, and each will have its own independent rate limit map. Additionally, if the function goes cold (no requests for a period), the map resets entirely.
**Risk:** Low. The rate limiting provides reasonable protection against casual abuse and accidental rapid requests, but it cannot reliably enforce limits against a determined attacker who can trigger cold starts or whose requests are distributed across multiple isolates. The primary rate limiting defence remains the Claude API's own per-key rate limits.
**Recommendation:** For production, consider a persistent rate limiter using Supabase database (a simple `INSERT ... ON CONFLICT UPDATE` pattern on a `rate_limits` table) or Redis/Upstash. For the current phase, the in-memory approach is acceptable as a first line of defence. Document this limitation.
**Fix Applied:** No (informational -- acceptable for current phase, should be addressed before production)

---

### SEC-013: CORS Fallback Defaults to Localhost Origin

**Severity:** Low
**Category:** API
**File:** `supabase/functions/chat/index.ts`:50-58
**Description:** The `corsHeaders` function falls back to `http://localhost:5173` when the request's Origin header is not in the allowed list or is null. This means any request without an Origin header (e.g., from curl, Postman, or server-side code) receives `Access-Control-Allow-Origin: http://localhost:5173` in the response. While this does not grant cross-origin access to unknown origins (the browser enforces CORS based on exact origin match), it means the default response header always references the development server.
**Risk:** Negligible in production. The fallback to localhost does not weaken CORS because browsers only use the CORS headers when the request origin matches. However, it reveals the development server address in production responses, which is minor information leakage.
**Recommendation:** Instead of defaulting to `ALLOWED_ORIGINS[0]`, return no `Access-Control-Allow-Origin` header (or a blank one) when the request origin is not in the allowed list. This is the standard CORS pattern for rejecting unknown origins. Additionally, consider making the allowed origins configurable via environment variables so they can differ between development and production deployments.
**Fix Applied:** No (informational -- negligible production risk)

---

## Checklist Results

### Authentication and Authorization
- [PASS] Auth tokens handled securely -- JWT from Authorization header validated via `supabase.auth.getUser()`, never logged or exposed in responses
- [PASS] Session management follows best practices -- Supabase built-in session management with refresh token rotation
- [PASS] Role-based access control properly enforced -- Phase 1 SEC-001/SEC-002 fixes confirmed in schema (trigger + CHECK constraint)
- [N/A] Password handling -- magic link auth, no passwords in this phase

### Data Security
- [PASS] Supabase RLS policies in place for all accessed tables -- `site_specs`, `profiles`, `tenant_secrets` all have proper RLS
- [PASS] Sensitive data not logged or exposed in error messages -- no `console.log` in client or Edge Function code
- [PASS] API keys and secrets not hardcoded in source files -- `claude_api_key` fetched from database, never in client code
- [PASS] User data properly validated before database operations -- type checking in `mapToolCallToSpecUpdate`
- [PASS] Tenant isolation enforced -- `tenant_secrets` uses owner-only RLS; Edge Function uses service role to bypass RLS for key lookup, correctly scoped to user's tenant_id

### Frontend Security
- [WARN] No XSS vectors -- **SEC-007**: `dangerouslySetInnerHTML` is used, but with correct HTML escaping. Currently safe but fragile.
- [WARN] No unsafe `innerHTML` or `dangerouslySetInnerHTML` usage -- **SEC-007**: present in MessageBubble.tsx with proper escaping
- [N/A] CSRF protection on state-changing requests -- Supabase uses token-based auth (Authorization header), not cookies
- [PASS] Sensitive data not stored in localStorage without encryption -- no localStorage usage for sensitive data

### API Security
- [PASS] Rate limiting on resource-intensive endpoints -- 30 req/min per user in Edge Function (with caveats: SEC-012)
- [WARN] Input validation on all API parameters -- **SEC-011**: only validates last message length, not full payload
- [PASS] Proper error responses -- generic error messages for 401, 403, 429; **SEC-008**: Claude API errors leak `detail`
- [WARN] System prompt and tools validated -- **SEC-009/SEC-010**: client controls both system prompt and tool definitions

### Dependencies
- [PASS] No known vulnerable packages added -- `npm audit` reports 0 vulnerabilities
- [PASS] No unnecessary dependencies introduced -- no new npm packages in this phase
- [PASS] Lockfile updated consistently -- package-lock.json unchanged

### Chat-Specific Security
- [PASS] API key isolation -- `claude_api_key` fetched server-side via service role key, never in any response payload
- [PASS] JWT validation -- Edge Function verifies auth token before any action
- [PASS] Tenant isolation -- user can only access their own tenant's API key (profile.tenant_id lookup)
- [PASS] No prompt injection via concatenation -- system prompt is NOT built from user input (but SEC-009 notes it's client-controlled)
- [PASS] Tool call validation -- `mapToolCallToSpecUpdate` uses a switch/default pattern that safely ignores unrecognized tools
- [PASS] No sensitive data in client logs -- no `console.log`, `console.warn`, or `console.error` in any new client-side files
- [PASS] Chat history RLS -- `site_specs` RLS ensures users can only access their own spec (including `chat_history`)
- [WARN] Error responses -- **SEC-008**: Claude API error details forwarded to client
- [PASS] Service role key usage -- only used in Edge Function for `profiles` and `tenant_secrets` lookup, never exposed

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 5 |
| Low | 2 |
| **Total** | **7** |
| Fixed by Security Agent | 0 |

### Priority Recommendations

**Before merge (Medium priority):**
1. **SEC-009 + SEC-010:** Hardcode the system prompt and tool definitions in the Edge Function. This is the single most impactful change -- it prevents a malicious user from fully controlling the Claude API call using someone else's API key. These two issues together constitute the most significant attack surface in this phase.
2. **SEC-008:** Remove the `detail` field from Claude API error responses to prevent information leakage.
3. **SEC-011:** Add total payload size validation and/or validate all messages in the array, not just the last one.

**Post-merge (Low priority):**
4. **SEC-007:** Refactor MessageBubble to use React-based rendering instead of `dangerouslySetInnerHTML`. The current implementation is safe but fragile.
5. **SEC-012:** Upgrade rate limiting to a persistent store before production deployment.
6. **SEC-013:** Fix CORS fallback to not default to localhost.

### Overall Assessment

The Phase 2 implementation demonstrates good security practices in several key areas: API key isolation is properly implemented via the `tenant_secrets` table and service-role-scoped Edge Function; JWT validation is performed before any action; RLS policies correctly enforce tenant isolation; and the client-side code avoids common pitfalls like logging sensitive data or storing secrets.

The most significant concern is that the Edge Function accepts both the system prompt and tool definitions from the client (SEC-009/SEC-010), effectively giving a malicious authenticated user full control over the Claude API call using their instructor's API key. While this cannot directly breach data isolation (RLS protects the database), it enables cost abuse and prompt manipulation. Hardcoding these server-side is the recommended remediation.
