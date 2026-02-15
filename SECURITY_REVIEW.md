# Security Review — Phase 2: Chatbot Onboarding

**Date:** 2026-02-15T19:00:00Z
**Branch:** phase-2-chatbot-onboarding
**PR:** #2
**Reviewer:** Security Agent
**Result:** ISSUES FOUND (7 findings)

---

## Phase 1 Remediation Status

All 3 critical/high findings from Phase 1 have been confirmed fixed in this branch:
- **SEC-001 (Critical):** FIXED -- role escalation blocked by trigger + CHECK constraint
- **SEC-002 (High):** FIXED -- tenant boundary bypass blocked by same trigger
- **SEC-003 (High):** FIXED -- API key moved to `tenant_secrets` table with owner-only RLS

---

## Phase 2 Findings

### SEC-007: dangerouslySetInnerHTML Used for Message Rendering
**Severity:** Medium | **Category:** Frontend | **File:** `src/components/chat/MessageBubble.tsx`:128
**Description:** Chat messages rendered via `dangerouslySetInnerHTML`. HTML escaping is correctly applied before markdown transforms, but the pattern is fragile -- any future change that reorders transforms could introduce XSS.
**Recommendation:** Replace with React-based rendering (JSX elements or react-markdown).
**Fix Applied:** No (requires Dev Agent)

### SEC-008: Claude API Error Details Forwarded to Client
**Severity:** Medium | **Category:** API | **File:** `supabase/functions/chat/index.ts`:250-262
**Description:** Raw Claude API error text forwarded in `detail` field, potentially leaking rate limit info, model details, or API key format hints.
**Recommendation:** Return generic error message; log details server-side only.
**Fix Applied:** No (requires Dev Agent)

### SEC-009: Client Controls System Prompt Sent to Claude
**Severity:** Medium | **Category:** API | **File:** `supabase/functions/chat/index.ts`:218-219
**Description:** System prompt accepted from client request body. A malicious user can override the chatbot personality/instructions via direct HTTP request.
**Recommendation:** Hardcode system prompt in the Edge Function.
**Fix Applied:** No (requires Dev Agent)

### SEC-010: Client Controls Tool Definitions Sent to Claude
**Severity:** Medium | **Category:** API | **File:** `supabase/functions/chat/index.ts`:223-225
**Description:** Tool definitions accepted from client request body. Combined with SEC-009, gives full control over Claude API call using instructor's API key.
**Recommendation:** Hardcode tool definitions in the Edge Function.
**Fix Applied:** No (requires Dev Agent)

### SEC-011: Message Length Validation Only Checks Last Message
**Severity:** Medium | **Category:** API | **File:** `supabase/functions/chat/index.ts`:194-210
**Description:** Only the last message is validated for length. Earlier messages can be arbitrarily long, enabling token/cost abuse.
**Recommendation:** Validate all messages and add total payload size limit (e.g., 100KB).
**Fix Applied:** No (requires Dev Agent)

### SEC-012: In-Memory Rate Limiting Resets on Cold Start
**Severity:** Low | **Category:** API | **File:** `supabase/functions/chat/index.ts`:22-38
**Description:** Rate limit Map resets on Edge Function cold start or across isolates. Cannot reliably enforce limits under load.
**Recommendation:** Upgrade to persistent rate limiter before production. Acceptable for current phase.
**Fix Applied:** No (informational)

### SEC-013: CORS Fallback Defaults to Localhost Origin
**Severity:** Low | **Category:** API | **File:** `supabase/functions/chat/index.ts`:50-58
**Description:** Unknown origins get `Access-Control-Allow-Origin: http://localhost:5173` fallback. Minor information leakage.
**Recommendation:** Return no CORS header for unknown origins instead of defaulting to localhost.
**Fix Applied:** No (informational)

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

### Priority Actions
1. **SEC-009 + SEC-010:** Hardcode system prompt and tools server-side (most impactful change)
2. **SEC-008:** Remove error detail from client responses
3. **SEC-011:** Add full payload validation

See `security/archive/phase-2-security-review.md` for full details, risk analysis, and checklist results.
