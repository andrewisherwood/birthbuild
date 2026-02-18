# Conductor Working Context

**Last Updated:** 2026-02-17T23:00:00Z
**Project:** BirthBuild
**Status:** LLM build + publish pipeline working end-to-end; PR review + E2E testing pending
**Branch:** `feature/llm-site-generation` (PR #9)

## Current State

- All 6 build phases merged to main + design editor feature + auth hotfixes
- **LLM site generation pipeline working end-to-end**: build, preview, publish all functional
- First published site live: https://shannon-mitchell.birthbuild.com (HTTPS enforced via Netlify)
- 13 commits on `feature/llm-site-generation` branch since diverging from main
- Supabase project: btkruvwxhyqotofpfbps (eu-west-1)
- Tenant: "BirthBuild Demo" (831498ce-9777-4fc0-a326-5647862d395a)
- Test site: "Shannon Birth Support" (site_spec_id: `7146f965-7ecc-440e-a5a1-ecb017d248ee`, subdomain: `shannon-mitchell`)
- Test users: hello@andrewisherwood.com (instructor), chefandrewisherwood@gmail.com (student), hello@andrewisherwood.me (student), andrew@bugle.agency (student)
- Session: "Demo Workshop" (a9ea233f-d417-4615-b04c-b4a75eb17579)

## Edge Function Versions Deployed

| Function | Version | Notes |
|----------|---------|-------|
| build | v8 | Returns 502 (not 200) on DB update failure; verify_jwt: false |
| publish | v4 | Netlify site ID recovery fallback; force_ssl: true; verify_jwt: false |
| generate-design-system | latest | LLM design system generation |
| generate-page | latest | LLM per-page generation |
| chat | v3 | Claude API proxy |
| delete-site | latest | Netlify + storage + DB cleanup |
| invite | latest | Magic link invites |
| design-chat | latest | Design conversation |

## Supabase Migrations Applied (remote)

- `001_initial_schema.sql` through `003_preview_publish.sql`
- `add_preview_status_to_check_constraint` — added "preview" to `valid_site_spec_status` check constraint (was missing, causing build's final DB update to silently fail)

## Critical Architecture: SDK Auth Bypass

The Supabase JS SDK's internal auth lock (`navigator.locks` or custom mutex) can get corrupted during browser sessions (React 18 double-mounts, WebSocket reconnection races), causing ALL auth-dependent SDK calls to hang indefinitely. This includes `getSession()`, `refreshSession()`, and `invoke()`.

**Solution (src/lib/auth-bypass.ts):**
- `getAccessTokenDirect()` — reads session from localStorage key `sb-<project-ref>-auth-token`, refreshes via raw fetch to GoTrue `/auth/v1/token?grant_type=refresh_token`
- `invokeEdgeFunctionBypass()` — wraps `getAccessTokenDirect()` + raw `fetch` to edge functions
- Used by: `useBuild.ts` (all build paths), `usePublish.ts` (publish/unpublish)
- The Supabase SDK is still used for: Realtime subscriptions, DB queries (`.from()`), Storage operations — these don't go through the auth lock

## Status Flow

```
draft → building → preview → live (with error as a retry state)
```

- **Build**: deploys to Netlify without custom domain → `.netlify.app` URL saved as `preview_url`
- **Publish**: adds `*.birthbuild.com` custom domain via Netlify API (+ `force_ssl: true`) → saved as `deploy_url`, status → `live`
- **Unpublish**: removes custom domain → status → `preview`

## What's Next

1. **PR Review**: Thorough review of PR #9 (`feature/llm-site-generation`) — 13 commits
2. **E2E Testing**: Full flow before inviting first instructor:
   - New student sign-up → chatbot → dashboard → LLM build → preview → publish → live site
   - Rebuild while live preserves live status
   - Unpublish flow
   - Template build path (non-LLM)
   - Instructor admin: create session, invite student, view student progress
3. **Known remaining items**:
   - Click "Force HTTPS" in Netlify dashboard for the existing shannon-mitchell site (future sites will auto-enforce via API)
   - 9 UX/bug issues from earlier live testing (see previous STATUS.md)
   - 9 Low/Informational security findings deferred from build phase
   - useAuth should be refactored to Context (architectural tech debt — not blocking launch)
   - generate-link Edge Function is unauthenticated — delete once SMTP configured

## Lessons Learned This Session

- **Never trust SDK auth calls in long-lived browser sessions**: The Supabase SDK's auth lock chain can become permanently corrupted. The only reliable approach for critical flows (build, publish) is to bypass the SDK entirely and read tokens from localStorage.
- **Check constraints must match application status values**: The `valid_site_spec_status` check constraint was missing "preview", causing the build function's final DB update to silently fail (returned 200 despite error).
- **Edge functions should return error status codes on DB failures**: The build function was returning HTTP 200 even when the final DB update failed, masking the check constraint issue. Now returns 502.
- **Netlify site ID recovery**: When `netlify_site_id` is null in DB (previous build's DB update failed), the publish function now looks up the site by name `birthbuild-<slug>.netlify.app` and persists the recovered ID.
- **force_ssl: true in Netlify API**: Include in the site PUT when adding a custom domain to auto-enforce HTTPS.
