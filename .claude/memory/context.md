# Conductor Working Context

**Last Updated:** 2026-02-15T18:50:00Z
**Project:** BirthBuild
**Current Phase:** 4 of 6 — Build Pipeline & Deploy
**Session:** 1 (continued)

## Active State
- Phase 3 merged, entering Phase 4 planning
- Branch: `main`
- No blockers
- All worktrees synced to main

## Phase History (Summary)

| Phase | Duration | Review Rounds | Notable |
|-------|----------|---------------|---------|
| 1 — Foundation & Auth | ~27 min | 2 (6 sec findings: 1 Crit, 2 High, 3 Low) | DB schema, RLS, auth, PWA shell |
| 2 — Chatbot Onboarding | ~35 min | 2 (7 sec findings: 5 Med, 2 Low) | Claude proxy, chat UI, 7-step flow, hardened server-side |
| 3 — Dashboard Form Editor | ~25 min | 2 (7 sec findings: 1 High, 2 Med, 4 Low) | 7-tab dashboard, 22 components, photo upload, storage policies |

## Active Lessons (Relevant to Current Phase)

- **RLS policies**: All tables use `auth.uid()` checks; photos bucket has user-scoped storage policies with `storage.foldername()` and `auth.uid()::text`
- **tenant_secrets**: Claude API keys stored per-tenant with owner-only RLS — Edge Functions use service role to read
- **Server-side hardening**: System prompt and tool definitions hardcoded in Edge Functions, never accepted from client
- **dangerouslySetInnerHTML banned**: Use React-based rendering for user/AI content
- **Input validation**: Validate ALL items in arrays; add total payload size limits; derive file extensions from MIME type not filename
- **Error messages**: Generic errors to client, detailed logs server-side
- **TypeScript strict mode**: No `any`, `noUnusedLocals`, `noUnusedParameters` enforced
- **Worktree branch management**: Dev worktree cannot checkout `main` — use `dev/working` branch with `git reset --hard`
- **gh pr merge local branch deletion**: Fails when dev worktree uses the branch — non-blocking
- **Storage path security**: Always verify storage paths start with `photos/{user_id}/` before operations; use MIME_TO_EXT map not filename extension
- **Supabase Storage bucket**: `photos` bucket created as private with user-scoped INSERT/SELECT/DELETE policies in migration 002

## Existing Architecture (for Phase 4)

- **Site spec hook**: `src/hooks/useSiteSpec.ts` — `{ siteSpec, loading, error, updateSiteSpec, createSiteSpec }` with optimistic updates
- **Auth hook**: `src/hooks/useAuth.ts` — `{ user, session, profile, role, loading, signInWithMagicLink, signOut }`
- **Chat hook**: `src/hooks/useChat.ts` — manages chat state, tool calls, step progression
- **Debounced save hook**: `src/hooks/useDebouncedSave.ts` — 500ms debounce wrapper around updateSiteSpec
- **Photo upload hook**: `src/hooks/usePhotoUpload.ts` — Supabase Storage CRUD with MIME validation, user-scoped paths
- **Types**: `src/types/site-spec.ts` — `SiteSpec`, `ChatMessage`, `ChatStep`, style types, `ServiceItem`, `Testimonial`, `CustomColours`
- **UI primitives**: Button, Input, Card, LoadingSpinner in `src/components/ui/`
- **Dashboard components**: 22 components in `src/components/dashboard/` — DashboardShell, TabNav, ProgressIndicator, all 7 tab panels, ServiceEditor, TestimonialEditor, PhotoUploadCard, AskAiButton, ToggleSwitch, etc.
- **Chat components**: ChatContainer, MessageBubble, ChatInput, QuickReplyButtons, StepIndicator in `src/components/chat/`
- **Supabase client**: `src/lib/supabase.ts` — typed client
- **Claude API**: `src/lib/claude.ts` — `sendChatMessage({ messages })` calls Edge Function
- **Routes**: `/` (landing), `/auth` (magic link), `/chat` (onboarding), `/dashboard` (full 7-tab editor), `/preview` (stub)
- **DB Migrations**: 001_initial_schema.sql (tables + RLS), 002_storage_policies.sql (photos bucket + policies)
- **SiteSpec fields**: business_name, doula_name, tagline, bio, philosophy, service_area, services[], testimonials[], style, palette, custom_colours, typography, font_heading, font_body, email, phone, booking_url, social_links, pages[], primary_keyword, include_faq, include_blog, build_status, published_url, subdomain

## Open Issues

- 4 Low/Informational security findings from Phase 3 deferred to Phase 4+:
  - SEC-015: No client-side rate limiting on Ask AI
  - SEC-016: Console.error logs Supabase error objects
  - SEC-017: Custom colour values without validation
  - SEC-018: Social link URLs not validated beyond HTML5

## Decisions Log (This Session)

- Adversarial review skipped for all phases (no OPENAI_API_KEY)
- Phase 2 security fixes: React AST markdown renderer, server-side hardcoded prompts/tools, generic errors, full message validation
- Phase 3 security fixes: Private storage bucket with user-scoped RLS, MIME-type extension derivation, path verification before delete

## Context for Next Session

If context is cleared, rebuild from:
1. `.claude/memory/stream.jsonl` (recent events)
2. `STATUS.md` (human-visible progress)
3. Active status files in `.claude/status/`
