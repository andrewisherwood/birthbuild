# Conductor Long-Term Memory

**Last Updated:** 2026-02-15T17:14:34Z
**Projects Completed:** 0
**Total Phases Completed:** 0

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

### What Doesn't Work
- **useAuth as a hook (not Context):** 14 independent instances each create their own onAuthStateChange subscription and fetch profile on every auth event. Token refreshes (tab visibility change) cascade across all instances simultaneously. This is the root cause of multiple loading/spinner bugs. Should be refactored to a single AuthProvider context.
- **useEffect deps on Supabase object references:** `user`, `session`, `profile` objects change identity on every token refresh even when the underlying user hasn't changed. Any useEffect depending on these objects will re-fire unnecessarily.
- **Deploying auth changes directly to production:** Auth flow is fragile and hard to test without a local Supabase instance. Changes to useAuth broke magic link login in production. Always test auth changes locally first.

---

## Project History

No projects completed yet

---

## Trends

- Average phase duration: N/A
- Most common blocker: N/A
- Highest-value suggestion type: N/A
- Most frequent security finding: N/A
