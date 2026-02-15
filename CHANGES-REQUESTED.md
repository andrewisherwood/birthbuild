# Changes Requested — Phase 2

**Source:** QA Report + Security Review
**PR:** #2
**Round:** 1 (Max: 3)
**Requested:** 2026-02-15T18:10:00Z

---

## From QA

**No blocking issues.** QA passed 22/22 checks with 4 advisory notes (AN-001 through AN-004). No action required.

---

## From Security

### SEC-007 (Medium): dangerouslySetInnerHTML in MessageBubble
**File:** `src/components/chat/MessageBubble.tsx:128`
**Issue:** Chat messages rendered via `dangerouslySetInnerHTML`. HTML escaping is applied before markdown transforms, but the pattern is fragile.
**Fix:** Replace `dangerouslySetInnerHTML` with React-based rendering. Use JSX elements to render markdown output instead of raw HTML injection. Parse markdown into React elements (bold → `<strong>`, italic → `<em>`, lists → `<ul>/<li>`).

### SEC-008 (Medium): Claude API Error Details Forwarded to Client
**File:** `supabase/functions/chat/index.ts:250-262`
**Issue:** Raw Claude API error text forwarded in `detail` field. Could leak rate limit info, model details, or API key format hints.
**Fix:** Return a generic error message ("The AI service is currently unavailable. Please try again.") instead of forwarding raw error text. Log the actual error server-side using `console.error()` for debugging.

### SEC-009 (Medium): Client Controls System Prompt
**File:** `supabase/functions/chat/index.ts:218-219`
**Issue:** System prompt accepted from client request body. A malicious user can override the chatbot personality/instructions via direct HTTP request.
**Fix:** Hardcode the system prompt in the Edge Function. Define the `SYSTEM_PROMPT` constant directly in the Edge Function file. Do not accept it from the client request body.

### SEC-010 (Medium): Client Controls Tool Definitions
**File:** `supabase/functions/chat/index.ts:223-225`
**Issue:** Tool definitions accepted from client request body. Combined with SEC-009, gives full control over Claude API call.
**Fix:** Hardcode the tool definitions in the Edge Function. Define the `CHAT_TOOLS` constant directly in the Edge Function file. Do not accept it from the client request body.

### SEC-011 (Medium): Message Length Validation Only Checks Last Message
**File:** `supabase/functions/chat/index.ts:194-210`
**Issue:** Only the last message is validated for length. Earlier messages can be arbitrarily long, enabling token/cost abuse.
**Fix:** Validate ALL messages for length (max 4000 chars each), and add a total payload size limit (e.g., 100KB for the entire messages array).

### SEC-012 (Low): In-Memory Rate Limiting Resets on Cold Start
**Informational.** Acceptable for current phase. No action required.

### SEC-013 (Low): CORS Fallback Defaults to Localhost Origin
**Informational.** No action required for this phase.

---

## Instructions

1. Read all issues above
2. Fix all mandatory issues (SEC-007 through SEC-011 — 5 fixes)
3. For SEC-009/SEC-010: Move the system prompt and tool definitions INTO the Edge Function file. Update `src/lib/claude.ts` to no longer send `system` and `tools` in the request body. The Edge Function should only accept `messages` from the client.
4. Test locally: `npm run build && npx tsc --noEmit`
5. Push to same branch: `git push origin phase-2-chatbot-onboarding`
6. Update dev.json status after pushing fixes

**Coordinator will re-run QA and Security. If all issues resolve → merge. If new issues → next round.**
