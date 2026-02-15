# Conductor Working Context

**Last Updated:** 2026-02-15T18:18:00Z
**Project:** BirthBuild
**Current Phase:** 3 of 6 — Dashboard Form Editor
**Session:** 1 (continued)

## Active State
- Phase 2 merged, entering Phase 3 planning
- Branch: `main`
- No blockers
- All worktrees synced to main

## Phase History (Summary)

| Phase | Duration | Review Rounds | Notable |
|-------|----------|---------------|---------|
| 1 — Foundation & Auth | ~27 min | 2 (6 sec findings: 1 Crit, 2 High, 3 Low) | DB schema, RLS, auth, PWA shell |
| 2 — Chatbot Onboarding | ~35 min | 2 (7 sec findings: 5 Med, 2 Low) | Claude proxy, chat UI, 7-step flow, hardened server-side |

## Active Lessons (Relevant to Current Phase)

- **RLS policies**: Phase 1 established tenant isolation pattern — all tables use `auth.uid()` checks; Phase 3 must follow same pattern for any new tables
- **tenant_secrets**: Claude API keys stored per-tenant with owner-only RLS — Edge Functions use service role to read
- **Server-side hardening**: System prompt and tool definitions must be hardcoded in Edge Functions, never accepted from client (SEC-009/010 lesson)
- **dangerouslySetInnerHTML banned**: Use React-based rendering for user/AI content (SEC-007 lesson)
- **Input validation**: Validate ALL items in arrays, not just the last one; add total payload size limits (SEC-011 lesson)
- **Error messages**: Generic errors to client, detailed logs server-side (SEC-008 lesson)
- **TypeScript strict mode**: No `any`, `noUnusedLocals`, `noUnusedParameters` enforced — dev must handle all strict checks
- **Worktree branch management**: Dev worktree cannot checkout `main` (already used by main worktree) — use `dev/working` branch with `git reset --hard`
- **gh pr merge local branch deletion**: Fails when dev worktree uses the branch — non-blocking, PR merges successfully

## Existing Architecture (for Phase 3)

- **Site spec hook**: `src/hooks/useSiteSpec.ts` — `{ siteSpec, loading, error, updateSiteSpec, createSiteSpec }` with optimistic updates
- **Auth hook**: `src/hooks/useAuth.ts` — `{ user, session, profile, role, loading, signInWithMagicLink, signOut }`
- **Chat hook**: `src/hooks/useChat.ts` — manages chat state, tool calls, step progression
- **Types**: `src/types/site-spec.ts` — `SiteSpec`, `ChatMessage`, `ChatStep`, style types, `ServiceItem`, `Testimonial`
- **UI primitives**: Button, Input, Card, LoadingSpinner in `src/components/ui/`
- **Chat components**: ChatContainer, MessageBubble, ChatInput, QuickReplyButtons, StepIndicator in `src/components/chat/`
- **Supabase client**: `src/lib/supabase.ts` — typed client
- **Routes**: `/` (landing), `/auth` (magic link), `/chat` (onboarding), `/dashboard` (stub), `/preview` (stub)
- **Photos table**: `photos` table in DB with Supabase Storage integration ready

## Open Issues

None

## Decisions Log (This Session)

- Adversarial review skipped for both phases (no OPENAI_API_KEY)
- Phase 2 security fixes: React AST markdown renderer, server-side hardcoded prompts/tools, generic errors, full message validation

## Context for Next Session

If context is cleared, rebuild from:
1. `.claude/memory/stream.jsonl` (recent events)
2. `STATUS.md` (human-visible progress)
3. Active status files in `.claude/status/`
