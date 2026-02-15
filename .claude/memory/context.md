# Conductor Working Context

**Last Updated:** 2026-02-15T21:45:00Z
**Project:** BirthBuild
**Status:** All 6 phases complete — project delivered
**Session:** 1 (complete)

## Final State
- All 6 phases merged to main
- 6 PRs merged (#1–#6)
- 20 security findings fixed, 2 QA findings fixed
- 12 QA rounds total (2 per phase)
- Branch: `main`
- No open blockers

## Phase History (Final)

| Phase | Duration | Review Rounds | Notable |
|-------|----------|---------------|---------|
| 1 — Foundation & Auth | ~27 min | 2 (6 sec findings: 1 Crit, 2 High, 3 Low) | DB schema, RLS, auth, PWA shell |
| 2 — Chatbot Onboarding | ~35 min | 2 (7 sec findings: 5 Med, 2 Low) | Claude proxy, chat UI, 7-step flow, hardened server-side |
| 3 — Dashboard Form Editor | ~25 min | 2 (7 sec findings: 1 High, 2 Med, 4 Low) | 7-tab dashboard, 22 components, photo upload, storage policies |
| 4 — Build Pipeline & Deploy | ~35 min | 2 (9 sec findings: 4 Med, 5 Low) | 6 page generators, site gen, build Edge Fn, Netlify deploy, preview |
| 5 — Instructor Admin | ~30 min | 2 (7 sec findings: 1 High, 2 Med, 4 Low) | Admin shell, sessions CRUD, invite Edge Fn, student table, spec viewer, usage metrics |
| 6 — Polish & Integration | ~25 min | 2 (0 sec findings, 2 QA findings) | Error boundary, mobile responsive, WCAG accessibility, build validation, stale rebuild |

## Lessons Learned (for L3 promotion)

- **RLS policies**: All tables use `auth.uid()` checks; photos bucket has user-scoped storage policies
- **Server-side hardening**: System prompt and tool definitions hardcoded in Edge Functions, never from client
- **Input validation**: Validate ALL items in arrays; UUID regex for IDs; file path sanitisation in zip operations
- **Error messages**: Generic errors to client, detailed logs server-side
- **TypeScript strict mode**: No `any`, `noUnusedLocals`, `noUnusedParameters`
- **Worktree branch management**: Dev worktree cannot checkout `main` — use `dev/working`
- **gh pr merge**: Local branch deletion fails when dev worktree uses the branch — non-blocking
- **HTML escaping**: All user content in generated sites goes through `escapeHtml()`
- **JSON-LD safety**: After `JSON.stringify()`, `.replace(/</g, "\\u003c")`
- **URL scheme validation**: booking_url must start with `https://` or `http://`
- **Cross-tenant protection**: Always verify tenant_id before updating profiles in multi-tenant systems
- **Rate limiter pattern**: Check-before-increment to avoid inflating counters on rejected requests
- **Cache-Control: no-store**: Always set on responses containing authentication tokens
- **Heading hierarchy**: Audit ALL page generators for heading gaps, not just the one mentioned
- **Git rebase for push conflicts**: When QA pushes before Security, rebase before pushing

## Open Issues (Deferred)

- 9 Low/Informational security findings deferred (see STATUS.md)

## Decisions Log

- Adversarial review skipped for all phases (no OPENAI_API_KEY)
- Phase 2: React AST markdown renderer, server-side hardcoded prompts/tools
- Phase 3: Private storage bucket with user-scoped RLS, MIME-type extension derivation
- Phase 4: Client-side HTML generation with Edge Function handling only zip + deploy
- Phase 5: Invite Edge Function with service role for auth.admin.* operations
- Phase 6: ErrorBoundary as class component (only exception to functional-only rule)
