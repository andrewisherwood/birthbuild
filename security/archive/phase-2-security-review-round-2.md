# Security Review — Phase 2: Chatbot Onboarding (Round 2)

**Date:** 2026-02-15T18:15:00Z
**Branch:** phase-2-chatbot-onboarding
**PR:** #2
**Reviewer:** Security Agent
**Round:** 2 (verification of Round 1 fixes)
**Result:** CLEAN (0 new findings)

---

## Round 1 Fix Verification

This round verifies the 5 Medium-severity findings from Round 1 (SEC-007 through SEC-011). Each fix is evaluated against the original finding and checked for regressions.

### SEC-007: dangerouslySetInnerHTML in MessageBubble — FIXED

**Original issue:** Chat messages rendered via `dangerouslySetInnerHTML` with fragile HTML escaping.
**Verification:**
- `src/components/chat/MessageBubble.tsx` has been completely rewritten with a React-based markdown renderer.
- A custom parser (`parseMarkdownBlocks` at line 110, `parseInlineSegments` at line 74) converts markdown text into typed AST nodes (`MarkdownBlock`, `InlineSegment`).
- React renderers (`renderBlock` at line 239, `renderInlineSegment` at line 216) produce JSX elements (`<strong>`, `<em>`, `<ol>`, `<ul>`, `<li>`, `<p>`) using React's built-in escaping.
- Grep confirms zero occurrences of `dangerouslySetInnerHTML` or `innerHTML` in the entire `src/` directory (the only match is the SEC-007 comment on line 8 referencing the fix).
- All user-provided text flows through `{segment.value}` inside `<span>` elements (line 219), which React auto-escapes.
- **No regressions introduced.** The custom parser handles `**bold**`, `*italic*`, ordered lists, unordered lists, and paragraphs without any raw HTML injection.

**Status: FIXED** (`src/components/chat/MessageBubble.tsx`:74-275)

---

### SEC-008: Claude API Error Details Forwarded to Client — FIXED

**Original issue:** Raw Claude API error text forwarded in `detail` field, leaking rate limit info, model details, or API key format hints.
**Verification:**
- `supabase/functions/chat/index.ts` lines 523-553 handle both fetch errors and non-OK responses.
- **Fetch error path** (line 523-535): Catches network errors, logs actual error detail server-side via `console.error("[chat] Failed to reach Claude API:", errorDetail)` (line 527), returns generic message `"The AI service is currently unavailable. Please try again."` with HTTP 502.
- **Non-OK response path** (line 538-553): Reads error text, logs it server-side via `console.error(\`[chat] Claude API error (HTTP ${claudeResponse.status}):\`, errorText)` (lines 540-543), returns the same generic message with HTTP 502.
- Neither path includes any `detail` field, raw error text, or Claude API specifics in the client response.
- **No regressions introduced.** Error logging is server-side only (Deno edge function console), client receives a safe generic message.

**Status: FIXED** (`supabase/functions/chat/index.ts`:523-553)

---

### SEC-009: Client Controls System Prompt — FIXED

**Original issue:** System prompt accepted from client request body, allowing malicious users to override chatbot personality/instructions.
**Verification:**
- The `SYSTEM_PROMPT` constant is defined as a hardcoded string at line 30 of `supabase/functions/chat/index.ts` (61 lines of prompt text).
- The `ChatRequestBody` interface (line 7-9) only accepts `messages: Array<{ role: string; content: string }>` — no `system` field exists.
- The Claude API call at line 504-510 uses `system: SYSTEM_PROMPT` (the hardcoded constant), not any value from the request body.
- Grep for `body.system` across the entire `supabase/` directory returns zero matches.
- The client-side `src/lib/claude.ts` (line 57-61) only sends `{ messages }` in the request body. The file header comment at line 5-6 documents this change.
- **No regressions introduced.** The system prompt is entirely server-controlled.

**Status: FIXED** (`supabase/functions/chat/index.ts`:30-61, `src/lib/claude.ts`:57-61)

---

### SEC-010: Client Controls Tool Definitions — FIXED

**Original issue:** Tool definitions accepted from client request body, giving full control over Claude API call when combined with SEC-009.
**Verification:**
- The `CHAT_TOOLS` constant is defined as a hardcoded array at line 67 of `supabase/functions/chat/index.ts` (224 lines of tool definitions, 7 tools total).
- The `ChatRequestBody` interface (line 7-9) has no `tools` field.
- The Claude API call at line 509 uses `tools: CHAT_TOOLS` (the hardcoded constant), not any value from the request body.
- Grep for `body.tools` across the entire `supabase/` directory returns zero matches.
- The client-side `src/lib/claude.ts` only sends `{ messages }` — no tools parameter.
- **No regressions introduced.** Tool definitions are entirely server-controlled.

**Status: FIXED** (`supabase/functions/chat/index.ts`:67-291, `src/lib/claude.ts`:57-61)

---

### SEC-011: Message Length Validation Only Checks Last Message — FIXED

**Original issue:** Only the last message was validated for length. Earlier messages could be arbitrarily long, enabling token/cost abuse.
**Verification:**
- Constants defined at lines 23-24: `MAX_MESSAGE_LENGTH = 4_000` and `MAX_MESSAGES_PAYLOAD_BYTES = 100 * 1024` (100KB).
- **Per-message validation** (lines 464-479): A `for...of` loop iterates over ALL messages in `body.messages`, checking each message's `content.length` against `MAX_MESSAGE_LENGTH`. Returns HTTP 400 if any message exceeds the limit.
- **Total payload validation** (lines 482-496): The entire `body.messages` array is serialized via `JSON.stringify()` and measured with `TextEncoder.encode().length` for accurate byte count. Returns HTTP 400 if total exceeds 100KB.
- Both validations occur BEFORE the Claude API call (lines 464-496, before line 504).
- **No regressions introduced.** The validation is comprehensive: individual message cap prevents single-message abuse, total payload cap prevents conversation-length abuse.

**Status: FIXED** (`supabase/functions/chat/index.ts`:23-24, 464-496)

---

## Round 1 Informational Findings (Unchanged)

### SEC-012 (Low): In-Memory Rate Limiting Resets on Cold Start
**Status:** Acknowledged. No fix required for current phase. The in-memory `rateLimitMap` at line 20 resets when the Deno edge function cold-starts. This is acceptable given the current scale; a Redis-backed limiter can be added when the platform scales.

### SEC-013 (Low): CORS Fallback Defaults to Localhost Origin
**Status:** Acknowledged. No fix required for current phase. The `corsHeaders` function at line 320-328 falls back to `http://localhost:5173` when the request origin is not in the allow list. This is safe because the response still requires a valid JWT, and the fallback only affects CORS preflight — it does not grant access.

---

## Regression Check

Verified that no new vulnerabilities were introduced by the fixes:

- **No new innerHTML/dangerouslySetInnerHTML usage** anywhere in `src/`
- **No new hardcoded secrets** introduced in the changes
- **No new client-controllable fields** added to the Edge Function request body
- **Client-side `src/lib/claude.ts`** properly stripped of `system` and `tools` parameters
- **Error handling** in both fetch-error and non-OK-response paths returns only generic messages
- **Input validation** runs on the complete message set before any API call

---

## Summary

| Metric | Value |
|--------|-------|
| Findings from Round 1 | 7 (5 Medium, 2 Low) |
| Medium fixes verified | 5/5 FIXED |
| Low findings (informational) | 2 (no fix required) |
| New findings in Round 2 | 0 |
| Regressions introduced | 0 |

**Result: CLEAN.** All 5 Medium-severity findings from Round 1 have been properly fixed. No regressions or new vulnerabilities detected. The 2 Low-severity informational findings remain acknowledged and are acceptable for the current phase.

**Recommendation: Approve PR #2 for merge.**
