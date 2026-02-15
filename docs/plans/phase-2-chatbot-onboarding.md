# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T17:45:00Z
**Total Phases:** 6

Phase 2 of 6 — Chatbot Onboarding (High complexity)

---

# Detailed Plan: Phase 2 — Chatbot Onboarding

**Date:** 2026-02-15
**Status:** Approved
**Branch:** `phase-2-chatbot-onboarding`

## Overview

Build the Claude-powered chatbot that guides students through the 7-step site-building question flow. This phase delivers the primary value proposition — a non-technical birth worker answers questions in a natural conversation, and BirthBuild translates those answers into a structured site specification.

Key deliverables:
1. Supabase Edge Function proxying Claude API calls (API key never reaches browser)
2. Chat UI with message thread, input, and send button
3. System prompt implementing the 7-step question flow with function calling
4. Each chatbot answer writes to the correct `site_spec` field via structured tool use
5. AI content generation for bio, tagline, service descriptions, FAQ
6. Chat history persistence in `site_spec.chat_history` with restore on return visits
7. British English throughout all chatbot responses

## Pre-existing Code

From Phase 1:
- **Auth:** `useAuth()` hook returns `{ user, session, profile, role, loading, signInWithMagicLink, signOut }`
- **Site Spec:** `useSiteSpec()` hook returns `{ siteSpec, loading, error, updateSiteSpec, createSiteSpec }`
- **Types:** `SiteSpec`, `ChatMessage { role: "user"|"assistant", content: string, timestamp: string }`, all field types defined in `src/types/site-spec.ts`
- **DB:** `site_specs.chat_history` column (jsonb, default `[]`), `tenant_secrets.claude_api_key` (owner-only RLS)
- **UI:** `Button`, `Input`, `Card`, `LoadingSpinner` in `src/components/ui/`
- **Route:** `src/routes/chat.tsx` exists as a stub
- **Supabase client:** `src/lib/supabase.ts` with env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Routing:** Chat page at `/chat`, protected by `ProtectedRoute`

## Architecture Rules (MUST follow)

- TypeScript strict mode — no `any`, no implicit returns, no unused variables
- Functional components only — no class components
- Named exports — no default exports except route pages
- Custom hooks for all Supabase interactions — components never call Supabase directly
- Tailwind only — no inline styles, no CSS modules
- British English in all user-facing copy
- Edge Functions as API proxy — Claude API key never touches the client
- Chat history is append-only — never mutate previous messages
- Site spec is the single source of truth — chatbot writes structured data to site_spec fields
- Optimistic updates — write to local state immediately, sync to Supabase
- Error boundaries around async operations

## Loops

### Loop 1: Claude API Proxy Edge Function

**Files:**
- `supabase/functions/chat/index.ts` (new)

**Description:**
Create a Supabase Edge Function that receives chat messages from the client, retrieves the instructor's Claude API key from `tenant_secrets`, calls the Claude API, and returns the response.

**Implementation details:**
- Deno runtime (Supabase Edge Functions use Deno)
- Verify the JWT from the `Authorization` header using Supabase's `createClient` with the user's token
- Look up the user's `profile.tenant_id`, then fetch `tenant_secrets.claude_api_key` using the service role key (bypassing RLS)
- If no API key found, return 403 with message "Your instructor has not configured an API key"
- Call Claude API (`https://api.anthropic.com/v1/messages`) with:
  - Model: `claude-sonnet-4-5-20250929` (cost-effective for chat)
  - System prompt (passed from client or stored server-side)
  - Message history (from client)
  - Tools definition (function calling schema for site_spec field updates)
  - `max_tokens: 1024`
- Return the Claude response (message content + any tool_use blocks) as JSON
- Rate limit: max 30 requests per user per minute (simple in-memory counter per user ID, resets each minute)
- CORS headers for the Vite dev server origin

**Acceptance criteria:**
- [ ] Edge Function deploys and responds to POST requests with valid auth
- [ ] Returns 401 for missing/invalid JWT
- [ ] Returns 403 if tenant has no Claude API key
- [ ] Returns Claude API response including tool_use blocks
- [ ] API key never appears in response or client-accessible logs
- [ ] TypeScript compiles with no errors

### Loop 2: Chat Hook (`useChat`)

**Files:**
- `src/hooks/useChat.ts` (new)
- `src/lib/claude.ts` (new)

**Description:**
Create the `useChat` custom hook that manages chat state, sends messages to the Edge Function, processes Claude's response (including tool calls that update site_spec fields), and persists chat history.

**`src/lib/claude.ts`** — thin wrapper for calling the Edge Function:
- `sendChatMessage(messages: ChatMessage[], systemPrompt: string, tools: ToolDefinition[]): Promise<ClaudeResponse>`
- Uses `supabase.functions.invoke('chat', { body: { messages, system: systemPrompt, tools } })`
- Handles HTTP errors, returns typed response

**`src/hooks/useChat.ts`** — the core hook:
- State: `messages: ChatMessage[]`, `isLoading: boolean`, `error: string | null`, `currentStep: ChatStep`
- `sendMessage(content: string)`: appends user message, calls Edge Function, processes response
- `processToolCalls(toolCalls)`: when Claude returns tool_use blocks, extract field updates and call `updateSiteSpec(partial)`
- `initChat()`: on mount, loads existing `chat_history` from `siteSpec`, resumes from last step, or starts welcome step
- Persists full `chat_history` to `site_spec.chat_history` after each exchange (append-only)
- Tracks which question step the user is on via `currentStep` state
- Depends on `useSiteSpec()` for reading/writing spec fields and chat history

**Types to add to `src/types/site-spec.ts`:**
```
ChatStep = "welcome" | "basics" | "style" | "content" | "photos" | "contact" | "review" | "complete"
ToolDefinition (mirrors Claude API tool schema)
ClaudeResponse (content blocks + tool_use blocks)
```

**Acceptance criteria:**
- [ ] `useChat()` returns `{ messages, isLoading, error, currentStep, sendMessage }`
- [ ] Messages append correctly and persist to `site_spec.chat_history`
- [ ] Tool calls from Claude correctly update site_spec fields via `updateSiteSpec`
- [ ] Chat history restores on return visits (page reload / re-navigation)
- [ ] Loading state set during API call, cleared on response
- [ ] Error state set on failure with user-friendly message
- [ ] TypeScript compiles with no errors

### Loop 3: System Prompt & Function Calling Schema

**Files:**
- `src/lib/chat-prompts.ts` (new)
- `src/lib/chat-tools.ts` (new)

**Description:**
Define the system prompt and Claude tool definitions that drive the 7-step question flow.

**`src/lib/chat-prompts.ts`** — system prompt:
- Role: friendly, professional website-building assistant for birth workers
- Language: British English throughout
- Personality: warm, encouraging, knowledgeable about doula/midwife profession
- Constraints: never suggest medical language, follow client's lead on inclusive language, stay on task
- Flow instructions: guide through 7 steps in order (welcome → basics → style → content → photos → contact → review)
- At each content step, offer to generate AI content: "Would you like me to draft your bio based on what you've told me?"
- At review step, summarise all collected fields
- Use tool calls to write data — never just discuss, always save

**`src/lib/chat-tools.ts`** — Claude function calling schema:
Define tools that map to site_spec fields:

1. `update_business_info` — sets `business_name`, `doula_name`, `service_area`, `services`
2. `update_style` — sets `style`, `palette`, `typography`
3. `update_content` — sets `bio`, `tagline`, `philosophy`, `testimonials`, `faq_enabled`
4. `update_contact` — sets `email`, `phone`, `booking_url`, `social_links`, `doula_uk`, `training_provider`
5. `generate_content` — AI generates bio/tagline/service descriptions/FAQ from context
6. `update_pages` — sets which pages to include
7. `mark_step_complete` — signals step transition (tracked client-side)

Each tool has a JSON schema matching the exact types from `SiteSpec`. The `generate_content` tool takes a `field` parameter and `context` string, returns generated text that gets written to the appropriate field.

**Acceptance criteria:**
- [ ] System prompt produces British English responses
- [ ] System prompt follows 7-step flow in order
- [ ] All tool definitions have valid JSON schemas matching SiteSpec field types
- [ ] Tool names are clear and map to specific site_spec field groups
- [ ] Prompt instructs Claude to use tools for every data update (not just conversational)
- [ ] TypeScript compiles with no errors

### Loop 4: Chat UI Components

**Files:**
- `src/components/chat/ChatContainer.tsx` (new)
- `src/components/chat/MessageBubble.tsx` (new)
- `src/components/chat/ChatInput.tsx` (new)
- `src/components/chat/QuickReplyButtons.tsx` (new)
- `src/components/chat/StepIndicator.tsx` (new)

**Description:**
Build the chat UI that renders the message thread and provides input controls.

**`ChatContainer.tsx`** — main wrapper:
- Renders message list, auto-scrolls to bottom on new message
- Shows `StepIndicator` at top showing current step (1–7)
- Renders `ChatInput` at bottom
- Full-height layout (fills viewport below nav)

**`MessageBubble.tsx`** — renders a single message:
- User messages: right-aligned, coloured background (green-100)
- Assistant messages: left-aligned, white/gray background
- Renders markdown content (basic: bold, italic, lists)
- Timestamp shown subtly below message
- When assistant message contains "choices" (detected from content or tool calls), render `QuickReplyButtons`

**`ChatInput.tsx`** — message input:
- Text input field + send button
- Disabled when `isLoading` (show loading indicator on send button)
- Submit on Enter (not Shift+Enter, which adds newline)
- Auto-focus on mount
- Placeholder: "Type your message..."
- Textarea that grows vertically up to 4 lines

**`QuickReplyButtons.tsx`** — inline option buttons:
- Renders a row of buttons for multiple-choice responses
- E.g. style step: [Modern & Clean] [Classic & Warm] [Minimal & Calm]
- E.g. service type: [Birth Doula] [Postnatal Doula] [Both] [Other]
- Clicking a button sends it as a user message via `sendMessage()`
- Buttons disappear after one is clicked (only shown on latest assistant message)

**`StepIndicator.tsx`** — progress through 7 steps:
- Horizontal step dots or bar showing: Welcome, Basics, Style, Content, Photos, Contact, Review
- Current step highlighted, completed steps have checkmark
- Compact, sits at top of chat area

**Acceptance criteria:**
- [ ] Messages render with correct alignment (user right, assistant left)
- [ ] Auto-scroll to newest message
- [ ] Input disabled while waiting for response
- [ ] Quick reply buttons work and send as user messages
- [ ] Step indicator shows current progress through 7 steps
- [ ] Responsive layout works on mobile (375px)
- [ ] TypeScript compiles with no errors

### Loop 5: Wire Chat Page

**Files:**
- `src/routes/chat.tsx` (modify existing stub)

**Description:**
Replace the chat page stub with the full chatbot experience. Wire together `useChat`, `useSiteSpec`, `useAuth`, and the chat UI components.

**Implementation details:**
- On mount: check if user has an existing `siteSpec`. If not, call `createSiteSpec()` to initialise one.
- Pass siteSpec to `useChat()` which loads existing chat_history and resumes from the correct step.
- If chat_history is empty, the chatbot sends the welcome message automatically.
- Layout: full-screen chat with step indicator at top, messages in scrollable area, input at bottom.
- Header: show business name (if set) and a link to the dashboard for manual editing.
- Handle edge cases: loading states, error display, network failure recovery.

**Acceptance criteria:**
- [ ] Chat page loads with welcome message for new users
- [ ] Returning users see their previous chat history and resume from correct step
- [ ] Site spec auto-created on first visit if none exists
- [ ] Messages flow correctly: user types → loading → assistant responds
- [ ] Tool calls from Claude silently update site_spec fields
- [ ] Navigation link to dashboard present
- [ ] TypeScript compiles with no errors

### Loop 6: AI Content Generation

**Files:**
- Modifies `src/lib/chat-tools.ts` (add generate_content tool handling)
- Modifies `src/hooks/useChat.ts` (add generation flow)

**Description:**
Implement the AI content generation feature where Claude offers to draft content and the user can accept, edit, or reject it.

**Flow:**
1. During the Content step, Claude asks about the user's background
2. User provides rough notes or a few sentences
3. Claude calls `generate_content` tool with field="bio" and the user's input as context
4. The Edge Function processes this — Claude generates a polished bio from the notes
5. The generated text is presented to the user: "Here's a draft bio I wrote based on what you told me: [bio text]. Would you like to use this, or shall I adjust it?"
6. If user accepts, the bio is saved to `site_spec.bio` via `update_content` tool call
7. If user wants changes, conversation continues until they're happy

**Content types that support generation:**
- `bio` — polished professional biography from notes
- `tagline` — 3 tagline options from business name + service area
- `services[].description` — service description from service type
- `faq` — standard doula FAQ localised to service area (generates FAQ items for the spec)
- `philosophy` — professional philosophy statement from conversation context

**Acceptance criteria:**
- [ ] Claude offers to generate content at appropriate steps
- [ ] Generated content presented for user approval before saving
- [ ] User can request revisions to generated content
- [ ] At least bio, tagline, and FAQ generation work end-to-end
- [ ] Generated content uses British English
- [ ] TypeScript compiles with no errors

### Loop 7: Build Verification & Cleanup

**Files:**
- All files from Loops 1–6

**Description:**
Run full build verification, fix any TypeScript errors, ensure all acceptance criteria are met.

**Steps:**
1. Run `npx tsc --noEmit` — fix all type errors
2. Run `npm run build` — ensure Vite builds successfully
3. Verify the Edge Function compiles (Deno check)
4. Review all files for:
   - No `any` types
   - No unused imports
   - British English in user-facing strings
   - No API keys or secrets in client code
   - Proper error handling on all async operations
5. Ensure all new files follow the folder structure from CLAUDE.md

**Acceptance criteria:**
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] No `any` types anywhere in new code
- [ ] All user-facing strings use British English
- [ ] Edge Function has no TypeScript/Deno errors

---

## Security Considerations

1. **API Key Isolation:** The Claude API key is fetched server-side in the Edge Function using the service role key. It never appears in any client response. The Edge Function validates the user's JWT before making any API call.

2. **Input Sanitisation:** User messages are passed as strings to the Claude API. The Edge Function must not interpolate user content into system prompts — use the Claude API's `messages` array properly (system prompt separate from user messages).

3. **Rate Limiting:** The Edge Function implements per-user rate limiting (30 requests/minute) to prevent API abuse. This is a simple in-memory counter that resets per minute — adequate for MVP.

4. **Tenant Isolation:** The Edge Function looks up the user's `tenant_id` from their profile, then fetches the API key for that specific tenant. A user cannot access another tenant's API key.

5. **Tool Call Validation:** When processing Claude's tool calls client-side, validate that the tool name is one of the expected tools and that the arguments match the expected schema before writing to site_spec.

6. **No Chat Injection:** The system prompt is defined server-side or as a constant in the client. User messages cannot override the system prompt. Claude's tool definitions prevent arbitrary field writes.

## Edge Cases

1. **No API Key:** Instructor hasn't set up their Claude API key → Edge Function returns 403, chat shows friendly message: "Your instructor needs to set up their API key before you can use the chatbot."
2. **Claude API Down:** Edge Function receives 5xx from Claude → return 502 to client, show retry option
3. **Rate Limit Hit:** User sends too many messages → show "Please wait a moment before sending another message"
4. **Empty Chat History:** First visit → auto-send welcome message, start at step 1
5. **Partial Progress:** User completed steps 1–3 then left → restore chat_history, resume at step 4
6. **Long Messages:** User pastes a very long message → Edge Function enforces max 4000 character limit on user messages
7. **Network Disconnect:** User loses connection mid-conversation → show error, allow retry of last message
8. **Concurrent Edits:** User has both chat and dashboard open → both read/write the same site_spec row; last write wins (acceptable for MVP)

## Sequencing Notes

- **Loop 1 first:** The Edge Function is the foundation — nothing else works without it
- **Loop 2 + Loop 3 together:** The chat hook depends on the prompt and tool definitions, develop them in tandem
- **Loop 4 independent of 2/3:** UI components can be built with mock data, then wired up
- **Loop 5 wires everything together:** Depends on Loops 1–4
- **Loop 6 enhances the flow:** Content generation is an enhancement to the base chat flow from Loop 5
- **Loop 7 last:** Final verification after all features are implemented
