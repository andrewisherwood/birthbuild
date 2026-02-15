# Implementation Brief

**Task:** Chatbot Onboarding
**Phase:** 2
**Branch:** `phase-2-chatbot-onboarding`
**PR Title:** `Phase 2: Chatbot Onboarding`
**Priority:** P0
**Created:** 2026-02-15T17:46:00Z
**Created by:** Coordinator

---

## Summary

Build the Claude-powered chatbot that guides birth worker students through a 7-step question flow (welcome → basics → style → content → photos → contact → review). The chatbot collects structured data and writes it to the `site_spec` row via Claude function calling. An Edge Function proxies all Claude API calls so the API key never reaches the browser. Chat history persists in `site_spec.chat_history` and restores on return visits. AI content generation (bio, tagline, FAQ) is offered at appropriate steps.

## Architecture Rules (MUST follow)

- TypeScript strict mode — no `any`, no implicit returns, no unused variables
- Functional components only — no class components
- Named exports — no default exports except route pages
- Custom hooks for all Supabase interactions — components never call Supabase directly
- Tailwind only — no inline styles, no CSS modules
- British English in all user-facing copy (colour, organisation, labour, specialise)
- Edge Functions as API proxy — Claude API key never touches the client
- Chat history is append-only — never mutate previous messages
- Site spec is the single source of truth — chatbot writes structured data to site_spec fields
- Optimistic updates — write to local state immediately, sync to Supabase
- Error boundaries around async operations
- Path alias `@/` maps to `./src` (configured in vite.config.ts and tsconfig.json)

---

## Implementation Steps

### Loop 1: Claude API Proxy Edge Function

Create `supabase/functions/chat/index.ts` — a Deno Edge Function that:

1. Reads the `Authorization` header, verifies the JWT using `createClient` from `@supabase/supabase-js`.
2. Looks up the user's `profile.tenant_id` from the profiles table.
3. Fetches the `claude_api_key` from `tenant_secrets` using the **service role key** (bypasses RLS, so students can't directly read the key).
4. If no API key found, returns 403: `{ "error": "Your instructor has not configured an API key." }`
5. Calls `https://api.anthropic.com/v1/messages` with:
   - Model: `claude-sonnet-4-5-20250929`
   - System prompt (from request body `system` field)
   - Messages array (from request body `messages` field)
   - Tools array (from request body `tools` field)
   - `max_tokens: 1024`
   - `anthropic-version: 2023-06-01` header
6. Returns the Claude response JSON directly.
7. Implements simple per-user rate limiting: max 30 requests per minute (in-memory Map of user ID → { count, resetTime }).
8. Sets CORS headers for `http://localhost:5173` and the production origin.
9. Handles errors: 401 for bad JWT, 403 for missing key, 429 for rate limit, 502 for Claude API errors.

**Environment variables needed by the Edge Function:**
- `SUPABASE_URL` (auto-injected by Supabase)
- `SUPABASE_ANON_KEY` (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

**No new env vars required** — the Claude API key comes from the database.

### Loop 2: Chat Hook (`useChat`) and Claude Client

Create `src/lib/claude.ts`:
- Export `sendChatMessage(messages, systemPrompt, tools)` — calls `supabase.functions.invoke('chat', { body: { messages, system: systemPrompt, tools } })`
- Returns typed `ClaudeResponse` containing content blocks and tool_use blocks
- Handles errors, throws with user-friendly messages

Create `src/hooks/useChat.ts`:
- Import `useSiteSpec` for reading/writing spec fields and chat history
- State: `messages: ChatMessage[]`, `isLoading: boolean`, `error: string | null`, `currentStep: ChatStep`
- `sendMessage(content: string)`:
  1. Append `{ role: "user", content, timestamp: new Date().toISOString() }` to messages
  2. Call `sendChatMessage` with full message history
  3. Process response: extract text content and any tool_use blocks
  4. For each tool_use block, map tool name to `updateSiteSpec` call with the appropriate partial
  5. Append `{ role: "assistant", content: responseText, timestamp }` to messages
  6. Persist updated `chat_history` to site_spec via `updateSiteSpec({ chat_history: updatedMessages })`
- `initChat()`:
  - If `siteSpec.chat_history` has messages, restore them and determine current step
  - If empty, send an initial welcome message from the assistant (no API call needed — it's a static greeting)
- Determine `currentStep` from the last `mark_step_complete` tool call in history, or default to `"welcome"`
- Export: `{ messages, isLoading, error, currentStep, sendMessage, initChat }`

Add types to `src/types/site-spec.ts`:
```typescript
export type ChatStep = "welcome" | "basics" | "style" | "content" | "photos" | "contact" | "review" | "complete";
```

### Loop 3: System Prompt and Function Calling Schema

Create `src/lib/chat-prompts.ts`:
- Export `SYSTEM_PROMPT: string` — the full system prompt with:
  - Role definition: friendly website-building assistant for birth workers
  - Language: British English throughout (use "colour", "organisation", etc.)
  - Personality: warm, encouraging, knowledgeable about doula/midwife profession
  - Constraints: never suggest medical language, follow client's lead on inclusive language, stay on task
  - Flow: guide through 7 steps in order, complete each step before moving on
  - At content steps, offer AI content generation
  - At review step, display a summary of all collected data
  - Always use tool calls to save data (don't just discuss it)
- Export `WELCOME_MESSAGE: string` — the initial greeting displayed without an API call

Create `src/lib/chat-tools.ts`:
- Export `CHAT_TOOLS: ToolDefinition[]` — Claude function calling schema:
  1. `update_business_info` — params: `business_name?`, `doula_name?`, `service_area?`, `services?`
  2. `update_style` — params: `style?`, `palette?`, `typography?`
  3. `update_content` — params: `bio?`, `tagline?`, `philosophy?`, `testimonials?`, `faq_enabled?`
  4. `update_contact` — params: `email?`, `phone?`, `booking_url?`, `social_links?`, `doula_uk?`, `training_provider?`
  5. `generate_content` — params: `field` (enum: "bio", "tagline", "services_description", "faq", "philosophy"), `context` (string of user input to work from)
  6. `update_pages` — params: `pages` (array of page names)
  7. `mark_step_complete` — params: `completed_step` (ChatStep enum), `next_step` (ChatStep enum)
- Export `mapToolCallToSpecUpdate(toolName, toolArgs): Partial<SiteSpec> | null` — maps a tool call to a site_spec partial update. Returns null for tools that don't directly update the spec (like `mark_step_complete`).

### Loop 4: Chat UI Components

Create `src/components/chat/ChatContainer.tsx`:
- Full-height flex layout: step indicator at top, scrollable message area in middle, input at bottom
- Uses `useRef` for scroll container, auto-scrolls to bottom on new messages
- Receives `messages`, `isLoading`, `currentStep`, `sendMessage`, `error` as props

Create `src/components/chat/MessageBubble.tsx`:
- Props: `message: ChatMessage`, `isLatest: boolean`
- User messages: right-aligned, `bg-green-100 text-green-900` (matches existing green palette)
- Assistant messages: left-aligned, `bg-white border border-gray-200`
- Render basic markdown: **bold**, *italic*, lists (use simple regex replacement, no library needed)
- Show relative timestamp below message

Create `src/components/chat/ChatInput.tsx`:
- Textarea that grows vertically (max 4 lines)
- Send button (uses existing `Button` component with primary variant)
- Disabled when `isLoading` — shows spinner on send button
- Submit on Enter (Shift+Enter for newline)
- Auto-focus on mount
- Placeholder: "Type your message..."

Create `src/components/chat/QuickReplyButtons.tsx`:
- Props: `options: string[]`, `onSelect: (option: string) => void`, `disabled: boolean`
- Renders a flex-wrap row of outline buttons
- Only shown on the latest assistant message when choices are present
- After selection, buttons disappear

Create `src/components/chat/StepIndicator.tsx`:
- Props: `currentStep: ChatStep`, `completedSteps: ChatStep[]`
- Horizontal row of 7 step dots/labels
- Current step highlighted (green-700), completed steps with checkmark, future steps gray
- Labels: Welcome, Basics, Style, Content, Photos, Contact, Review
- Compact design, sits at top of chat area

### Loop 5: Wire Chat Page

Modify `src/routes/chat.tsx`:
- Import `useAuth`, `useSiteSpec`, `useChat`, and all chat UI components
- On mount: if no `siteSpec` exists, call `createSiteSpec()` then init chat
- If `siteSpec` exists, call `initChat()` to restore history
- Layout:
  - Header bar: "Build Your Website" heading + link to `/dashboard` ("Edit in Dashboard →")
  - Step indicator below header
  - Chat container (scrollable messages area)
  - Chat input at bottom
- Handle loading states: show `LoadingSpinner` while siteSpec loads
- Handle errors: show error message with retry option
- Quick reply buttons: the assistant message content will include markers like `[CHOICES: Modern & Clean | Classic & Warm | Minimal & Calm]` which the UI parses into `QuickReplyButtons`. Alternatively, the `useChat` hook can extract choices from tool call context and pass them as state.

### Loop 6: AI Content Generation

This enhances the chatbot flow from Loops 2-3:

In `src/lib/chat-tools.ts`:
- The `generate_content` tool is already defined. When Claude calls it, the Edge Function processes it as part of the normal Claude conversation. Claude itself generates the content in its response text, and then calls `update_content` to save it.
- The flow is: Claude says "Here's a draft bio..." (text block) + calls `update_content` with bio field (tool_use block). The user can accept or request changes.

In `src/hooks/useChat.ts`:
- When processing a `generate_content` tool call, present the generated content in the assistant message
- Track generated-but-not-confirmed content so the user can accept/reject
- On acceptance (user says "yes", "looks good", etc.), Claude will call the appropriate `update_*` tool
- On rejection, conversation continues for revisions

Content generation happens at:
- **Content step**: bio, tagline, philosophy
- **Business basics step**: service descriptions
- **Contact step**: FAQ generation (if faq_enabled)
- **Review step**: summary displayed, option to regenerate any field

### Loop 7: Build Verification & Cleanup

1. Run `npx tsc --noEmit` — fix all type errors
2. Run `npm run build` — ensure Vite builds successfully
3. Check Deno compatibility of Edge Function (no Node-only APIs)
4. Review all files:
   - No `any` types
   - No unused imports or variables
   - British English in all user-facing strings
   - No API keys or secrets in client code
   - Proper error handling on all async operations
   - All new files follow CLAUDE.md folder structure
5. Verify all acceptance criteria from each loop

---

## Files Summary

### Files to Modify
- `src/routes/chat.tsx` — replace stub with full chatbot page
- `src/types/site-spec.ts` — add `ChatStep` type

### Files to Create
- `supabase/functions/chat/index.ts` — Claude API proxy Edge Function
- `src/lib/claude.ts` — Edge Function client wrapper
- `src/lib/chat-prompts.ts` — system prompt and welcome message
- `src/lib/chat-tools.ts` — tool definitions and tool-to-spec mapping
- `src/hooks/useChat.ts` — chat state management hook
- `src/components/chat/ChatContainer.tsx` — main chat layout
- `src/components/chat/MessageBubble.tsx` — message rendering
- `src/components/chat/ChatInput.tsx` — message input
- `src/components/chat/QuickReplyButtons.tsx` — quick reply option buttons
- `src/components/chat/StepIndicator.tsx` — 7-step progress indicator

---

## Acceptance Criteria

- [ ] Claude API proxy Edge Function deployed and callable from the client (API key never exposed to browser)
- [ ] Edge Function returns 401 for missing/invalid JWT, 403 for missing API key, 429 for rate limit
- [ ] Chat UI renders a message thread with user and assistant messages, input field, and send button
- [ ] System prompt follows the 7-step question flow (welcome → basics → style → content → photos → contact → review)
- [ ] Each chatbot answer writes to the correct site_spec field via function calling (tool_use)
- [ ] AI content generation works for bio, tagline, and FAQ — presented for approval before saving
- [ ] Chat history persisted in site_spec.chat_history and restored on return visits
- [ ] British English used throughout all chatbot responses
- [ ] Quick reply buttons appear for multiple-choice questions
- [ ] Step indicator shows progress through 7 steps
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run build` succeeds

---

## Security Notes

1. **API Key Isolation:** Claude API key fetched server-side via service role key. Never in any response or client log.
2. **JWT Validation:** Edge Function validates auth token before any action.
3. **Tenant Isolation:** User can only access their own tenant's API key (looked up from profile → tenant_id → tenant_secrets).
4. **Rate Limiting:** 30 requests/user/minute in Edge Function to prevent API abuse.
5. **Input Length:** Max 4000 characters per user message to prevent cost abuse.
6. **No Prompt Injection:** System prompt is a constant, not built from user input. User messages go in the `messages` array, never concatenated into system prompt.

---

## Context

### Existing patterns to follow
- `useAuth()` hook pattern: state + actions, cleanup on unmount, loading/error states
- `useSiteSpec()` pattern: optimistic updates with rollback, `useCallback` for memoised functions
- UI components: Tailwind only, props interfaces inline, `className` prop for customisation
- Route pages: default export, full-page layout, loading/error handling

### Key function locations
- Auth hook: `src/hooks/useAuth.ts` — provides `user`, `profile`, `role`
- Site spec hook: `src/hooks/useSiteSpec.ts` — provides `siteSpec`, `updateSiteSpec`, `createSiteSpec`
- Supabase client: `src/lib/supabase.ts` — `supabase` instance
- Types: `src/types/site-spec.ts` — `SiteSpec`, `ChatMessage`, `ServiceItem`, etc.
- UI primitives: `src/components/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `LoadingSpinner.tsx`
- Protected routing: `src/components/auth/ProtectedRoute.tsx`, `src/components/auth/RoleGate.tsx`

### Build command
```bash
npm run build && npx tsc --noEmit
```
