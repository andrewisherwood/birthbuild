# Conductor Working Context

**Last Updated:** 2026-02-16T16:00:00Z
**Project:** BirthBuild
**Status:** MVP live — auth/loading bugs partially fixed, architectural refactor needed
**Session:** 3 (auth fixes + design editor feature)

## Current State
- All 6 build phases merged to main + design editor feature + auth hotfixes
- First live site deployed: andrew-isherwood.birthbuild.com
- 5 Edge Functions deployed: chat (v3), build (v1), invite (v1), generate-link (v1, temporary), design-chat (v1)
- Supabase project: btkruvwxhyqotofpfbps (eu-west-1)
- Tenant: "BirthBuild Demo" (831498ce-9777-4fc0-a326-5647862d395a)
- Test users: hello@andrewisherwood.com (instructor), chefandrewisherwood@gmail.com (student), hello@andrewisherwood.me (student), andrew@bugle.agency (student)
- Session: "Demo Workshop" (a9ea233f-d417-4615-b04c-b4a75eb17579)
- 16 known issues from live testing (see STATUS.md) — 4 fixed, 12 open
- **Critical architectural issue:** useAuth is a hook, not a shared Context — causes cascading re-renders and loading state bugs across 14 independent instances

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

## Open Issues

- 9 UX/bug issues from live testing (see STATUS.md Known Issues table)
- 9 Low/Informational security findings deferred from build phase
- generate-link Edge Function is unauthenticated — delete once SMTP configured

## Decisions Log

- Adversarial review skipped for all phases (no OPENAI_API_KEY)
- Phase 2: React AST markdown renderer, server-side hardcoded prompts/tools
- Phase 3: Private storage bucket with user-scoped RLS, MIME-type extension derivation
- Phase 4: Client-side HTML generation with Edge Function handling only zip + deploy
- Phase 5: Invite Edge Function with service role for auth.admin.* operations
- Phase 6: ErrorBoundary as class component (only exception to functional-only rule)
- Session 2: All Edge Functions deployed with verify_jwt: false (they handle auth internally)
- Session 2: Tool-use loop handled server-side in chat Edge Function (not client-side) to keep client simple
- Session 2: Temporary generate-link Edge Function deployed (no JWT) as workaround for email rate limits
- Session 2: Multi-tenant model confirmed: instructors supply their own Claude API key via tenant_secrets
