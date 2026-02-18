# Conductor Long-Term Memory

**Last Updated:** 2026-02-17T23:00:00Z
**Projects Completed:** 0
**Total Phases Completed:** 6

---

## Agent Patterns

### Dev Agent
No patterns observed yet

### QA Agent
No patterns observed yet

### Security Agent
No patterns observed yet

### Adversarial Review (GPT)
No patterns observed yet

---

## Architecture Patterns

### What Works
- useSiteSpec: extracting `userId = user?.id ?? null` as a stable primitive for useEffect deps avoids re-fetches on token refresh
- onAuthStateChange as sole session source: eliminates race between getSession() and URL hash token processing on magic link redirects
- Defensive try/catch around ALL async chains in useEffect: prevents stuck loading states when any step throws
- **SDK auth bypass for critical flows:** Reading session from localStorage (`sb-<ref>-auth-token`) and refreshing via raw GoTrue fetch completely avoids the SDK's internal auth lock. This is the ONLY reliable approach for build/publish in long-lived browser sessions. See `src/lib/auth-bypass.ts`.
- **invokeEdgeFunctionBypass pattern:** Wraps token retrieval + raw fetch. Used by useBuild and usePublish. Supabase SDK still fine for Realtime subscriptions, DB queries, and Storage.
- **Netlify site ID recovery:** When `netlify_site_id` is missing from DB, look up by site name `birthbuild-<slug>.netlify.app` and persist.
- **force_ssl: true in Netlify PUT:** Auto-enforces HTTPS when adding custom domain.

### What Doesn't Work
- **useAuth as a hook (not Context):** 14 independent instances each create their own onAuthStateChange subscription and fetch profile on every auth event. Token refreshes (tab visibility change) cascade across all instances simultaneously. This is the root cause of multiple loading/spinner bugs. Should be refactored to a single AuthProvider context.
- **useEffect deps on Supabase object references:** `user`, `session`, `profile` objects change identity on every token refresh even when the underlying user hasn't changed. Any useEffect depending on these objects will re-fire unnecessarily.
- **Deploying auth changes directly to production:** Auth flow is fragile and hard to test without a local Supabase instance. Changes to useAuth broke magic link login in production. Always test auth changes locally first.
- **Supabase SDK auth lock in long-lived sessions:** The SDK's `navigator.locks` (or custom mutex) can get permanently corrupted by React 18 double-mounts or WebSocket reconnection races. Once corrupted, ALL auth-dependent calls (`getSession`, `refreshSession`, `invoke`) hang indefinitely with no recovery. This took 10 debugging iterations across 2 sessions to resolve.
- **Returning HTTP 200 on partial failures:** The build function returned 200 even when the final DB update failed (check constraint violation), masking the real error. Edge functions should return error status codes for any failure.

---

## Project History

No projects completed yet

---

## Trends

- Average phase duration: N/A
- Most common blocker: N/A
- Highest-value suggestion type: N/A
- Most frequent security finding: N/A
