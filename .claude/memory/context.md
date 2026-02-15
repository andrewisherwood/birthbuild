# Conductor Working Context

**Last Updated:** 2026-02-15T19:30:00Z
**Project:** BirthBuild
**Current Phase:** 5 of 6 — Instructor Admin
**Session:** 1 (continued)

## Active State
- Phase 4 merged, entering Phase 5 planning
- Branch: `main`
- No blockers
- All worktrees synced to main

## Phase History (Summary)

| Phase | Duration | Review Rounds | Notable |
|-------|----------|---------------|---------|
| 1 — Foundation & Auth | ~27 min | 2 (6 sec findings: 1 Crit, 2 High, 3 Low) | DB schema, RLS, auth, PWA shell |
| 2 — Chatbot Onboarding | ~35 min | 2 (7 sec findings: 5 Med, 2 Low) | Claude proxy, chat UI, 7-step flow, hardened server-side |
| 3 — Dashboard Form Editor | ~25 min | 2 (7 sec findings: 1 High, 2 Med, 4 Low) | 7-tab dashboard, 22 components, photo upload, storage policies |
| 4 — Build Pipeline & Deploy | ~35 min | 2 (9 sec findings: 4 Med, 5 Low) | 6 page generators, site gen, build Edge Fn, Netlify deploy, preview |

## Active Lessons (Relevant to Current Phase)

- **RLS policies**: All tables use `auth.uid()` checks; photos bucket has user-scoped storage policies
- **tenant_secrets**: Claude API keys stored per-tenant with owner-only RLS
- **Server-side hardening**: System prompt and tool definitions hardcoded in Edge Functions, never from client
- **dangerouslySetInnerHTML banned**: Use React-based rendering for user/AI content
- **Input validation**: Validate ALL items in arrays; total payload size limits; derive file extensions from MIME type; UUID regex validation for IDs; file path sanitisation in zip operations
- **Error messages**: Generic errors to client, detailed logs server-side
- **TypeScript strict mode**: No `any`, `noUnusedLocals`, `noUnusedParameters`
- **Worktree branch management**: Dev worktree cannot checkout `main` — use `dev/working`; QA uses `qa/working`; audit uses `audit/working`
- **gh pr merge**: Local branch deletion fails when dev worktree uses the branch — non-blocking
- **Storage path security**: Verify paths start with `photos/{user_id}/`; use MIME_TO_EXT map
- **HTML escaping**: All user content in generated sites goes through `escapeHtml()` — covers `<`, `>`, `&`, `"`, `'`
- **JSON-LD safety**: After `JSON.stringify()`, `.replace(/</g, "\\u003c")` to prevent `</script>` breakout XSS
- **URL scheme validation**: booking_url must start with `https://` or `http://`; social links must start with `https://`
- **Build Edge Function patterns**: JWT auth, rate limiting (5/hr in-memory), UUID validation, file path sanitisation, ownership check via service role

## Existing Architecture (for Phase 5)

- **Site spec hook**: `src/hooks/useSiteSpec.ts` — CRUD with optimistic updates
- **Auth hook**: `src/hooks/useAuth.ts` — user, session, profile, role
- **Build hook**: `src/hooks/useBuild.ts` — triggerBuild, Realtime subscription, validation
- **Chat hook**: `src/hooks/useChat.ts` — chat state, tool calls, step progression
- **Debounced save hook**: `src/hooks/useDebouncedSave.ts` — 500ms debounce
- **Photo upload hook**: `src/hooks/usePhotoUpload.ts` — Storage CRUD with MIME validation
- **Types**: `src/types/site-spec.ts` — SiteSpec, ChatMessage, ChatStep, style types
- **UI primitives**: Button, Input, Card, LoadingSpinner in `src/components/ui/`
- **Dashboard**: 22 components in `src/components/dashboard/`
- **Chat**: ChatContainer, MessageBubble, ChatInput, QuickReplyButtons, StepIndicator
- **Site generation**: `src/lib/palettes.ts`, `src/lib/wordmark.ts`, `src/lib/site-generator.ts`, 6 page generators in `src/lib/pages/`, `src/lib/pages/shared.ts`
- **Supabase client**: `src/lib/supabase.ts`
- **Claude API**: `src/lib/claude.ts`
- **Edge Functions**: `supabase/functions/chat/index.ts`, `supabase/functions/build/index.ts`
- **Routes**: `/` (landing), `/auth` (magic link), `/chat` (onboarding), `/dashboard` (7-tab editor), `/preview` (full-page iframe)
- **DB Migrations**: 001_initial_schema.sql (tables + RLS), 002_storage_policies.sql (photos bucket + policies)
- **DB Tables**: tenants, tenant_secrets, sessions, profiles, site_specs, photos — all with RLS
- **Roles**: `student` and `instructor` in profiles table; used for routing and access control

## Open Issues

- 5 Low/Informational security findings deferred:
  - SEC-015: No client-side rate limiting on Ask AI
  - SEC-016: Console.error logs Supabase error objects
  - SEC-023: Error response echoes user file path (build Edge Fn)
  - SEC-024: Custom colour validation only in site-generator (not Edge Fn)
  - SEC-025: Social link validation allows non-URL strings that start with https://

## Decisions Log (This Session)

- Adversarial review skipped for all phases (no OPENAI_API_KEY)
- Phase 2: React AST markdown renderer, server-side hardcoded prompts/tools
- Phase 3: Private storage bucket with user-scoped RLS, MIME-type extension derivation
- Phase 4: Client-side HTML generation with Edge Function handling only zip + deploy (keeps generation DRY)

## Context for Next Session

If context is cleared, rebuild from:
1. `.claude/memory/stream.jsonl` (recent events)
2. `STATUS.md` (human-visible progress)
3. Active status files in `.claude/status/`
