# Conductor Working Context

**Last Updated:** 2026-02-15T20:45:00Z
**Project:** BirthBuild
**Current Phase:** 6 of 6 — Polish & Integration Testing
**Session:** 1 (continued)

## Active State
- Phase 5 merged, entering Phase 6 planning
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
| 5 — Instructor Admin | ~30 min | 2 (7 sec findings: 1 High, 2 Med, 4 Low) | Admin shell, sessions CRUD, invite Edge Fn, student table, spec viewer, usage metrics |

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
- **Invite Edge Function patterns**: JWT auth, instructor role check, session ownership validation, cross-tenant protection (tenant_id check on existing profiles), rate limiting (100/hr, check-before-increment), Cache-Control: no-store on magic link responses
- **Git rebase for push conflicts**: When QA pushes before Security (or vice versa), rebase before pushing to resolve non-fast-forward errors

## Existing Architecture (for Phase 6)

- **Hooks**: useAuth, useSiteSpec, useChat, useBuild, useDebouncedSave, usePhotoUpload, useSessions, useStudents
- **UI primitives**: Button, Input, Card, LoadingSpinner in `src/components/ui/`
- **Dashboard**: 22 components in `src/components/dashboard/`
- **Admin**: AdminShell, SpecViewer, UsageMetrics in `src/components/admin/`
- **Chat**: ChatContainer, MessageBubble, ChatInput, QuickReplyButtons, StepIndicator
- **Site generation**: palettes, wordmark, site-generator, 6 page generators, shared utilities
- **Edge Functions**: chat, build, invite
- **Routes**: `/` (landing), `/auth` (magic link), `/chat` (onboarding), `/dashboard` (7-tab editor), `/preview` (full-page iframe), `/admin/sessions`, `/admin/students`
- **DB Tables**: tenants, tenant_secrets, sessions, profiles, site_specs, photos — all with RLS
- **Types**: `src/types/site-spec.ts`, `src/types/database.ts` (SessionWithCounts, StudentOverview)

## Open Issues

- 9 Low/Informational security findings deferred:
  - SEC-015: No client-side rate limiting on Ask AI
  - SEC-016: Console.error logs Supabase error objects
  - SEC-023: Error response echoes user file path (build Edge Fn)
  - SEC-024: Custom colour validation only in site-generator (not Edge Fn)
  - SEC-025: Social link validation allows non-URL strings that start with https://
  - SEC-031: PII (email addresses) logged in server console.error (invite Edge Fn)
  - SEC-032: Client-side 50-email limit not enforced (server enforces correctly)
  - SEC-033: SpecViewer specId not UUID-validated (RLS provides protection)
  - SEC-034: No session name length limit (database constraints suffice)

## Decisions Log (This Session)

- Adversarial review skipped for all phases (no OPENAI_API_KEY)
- Phase 2: React AST markdown renderer, server-side hardcoded prompts/tools
- Phase 3: Private storage bucket with user-scoped RLS, MIME-type extension derivation
- Phase 4: Client-side HTML generation with Edge Function handling only zip + deploy (keeps generation DRY)
- Phase 5: Invite Edge Function with service role for auth.admin.* operations; magic links returned to instructor for manual distribution

## Context for Next Session

If context is cleared, rebuild from:
1. `.claude/memory/stream.jsonl` (recent events)
2. `STATUS.md` (human-visible progress)
3. Active status files in `.claude/status/`
