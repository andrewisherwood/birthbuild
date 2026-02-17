# Debug Brief: "Generate My Site" Button Fails Silently

**Status: RESOLVED (2026-02-17)**

## Problem

The "Generate My Site" button on the Preview & Publish tab does nothing when clicked. No error message appears, no loading spinner activates, and no network requests are made. This occurs on the Netlify deploy preview for PR #9 (`deploy-preview-9--birthbuild.netlify.app`).

The site under test is "Shannon Birth Support" (site_spec_id: `7146f965-7ecc-440e-a5a1-ecb017d248ee`).

## Root Causes (Multiple)

### 1. Supabase SDK Auth Lock Corruption

The Supabase JS SDK's internal auth lock (`navigator.locks` or custom mutex) can get permanently corrupted during a browser session, caused by React 18 Strict Mode double-mounts or WebSocket reconnection races. Once corrupted, ALL SDK auth calls (`getSession()`, `refreshSession()`, `invoke()`) hang indefinitely — never resolving, never rejecting.

**Fix:** Created `src/lib/auth-bypass.ts` that reads the persisted session directly from `localStorage` (key: `sb-<project-ref>-auth-token`) and refreshes via raw `fetch` to the GoTrue endpoint `/auth/v1/token?grant_type=refresh_token`. All edge function calls use `invokeEdgeFunctionBypass()` which wraps this token retrieval + raw fetch — zero SDK involvement.

### 2. Missing "preview" in Check Constraint

The Postgres `valid_site_spec_status` check constraint only allowed `draft`, `building`, `live`, `error` — the value `preview` was missing because migration `003_preview_publish.sql` had not been applied to production. When the build function tried to update status to "preview" after a successful Netlify deploy, the DB update silently failed (the function returned HTTP 200 despite the error).

**Fix:** Applied migration `add_preview_status_to_check_constraint` to add "preview". Changed build function to return HTTP 502 when DB update fails.

### 3. Publish Function Missing netlify_site_id

Because the build function's DB update failed (check constraint), `netlify_site_id` was never saved. The publish function required it and would fail.

**Fix:** Added fallback lookup in publish function: when `netlify_site_id` is null, looks up the Netlify site by name (`birthbuild-<slug>.netlify.app`) and persists the recovered ID.

## Chronological Fix History

| Commit | Fix | Result |
|--------|-----|--------|
| `e8c7bd1` | Added `getSession()` check before build | Still failed — cached expired session |
| `17dcd76` | Changed to `refreshSession()` | Still failed — destructuring crash on null |
| `41f7825` | Safe destructuring for refreshSession | Still failed — SDK auth lock corrupted |
| `565bf6e` | Added 5s timeout to auth calls | Still failed — timeout fires but SDK never unblocks |
| `f07d936` | Pass explicit access token to edge calls | Still failed — token obtained via SDK |
| `479d6f3` | Bypass SDK invoke() with raw fetch | Build worked, but still used SDK for session |
| `e7d7d0f` | In-memory mutex replacing no-op lock | Partially fixed — new sessions work, corrupted sessions still stuck |
| `25d2a23` | Bypass SDK invoke for publish | Publish still hung — `refreshSession()` hangs through SDK lock |
| `98488da` | **Complete SDK bypass via localStorage** | **RESOLVED** — all edge function calls work |
| `06e70c8` | Force HTTPS on published sites | Enhancement — `force_ssl: true` in Netlify API |

## Key Files (Final State)

| File | Role |
|------|------|
| `src/lib/auth-bypass.ts` | Complete SDK bypass: localStorage token read + GoTrue refresh + raw edge function invocation |
| `src/hooks/useBuild.ts` | Build orchestration — all paths use `invokeEdgeFunctionBypass` |
| `src/hooks/usePublish.ts` | Publish/unpublish — uses `invokeEdgeFunctionBypass` |
| `supabase/functions/build/index.ts` | Returns 502 on DB update failure (was 200) |
| `supabase/functions/publish/index.ts` | Recovers missing `netlify_site_id` via name lookup; `force_ssl: true` |

## Key Lesson

Never rely on the Supabase SDK's auth module for critical user-facing flows in long-lived browser sessions. The SDK's internal lock chain can become permanently corrupted with no recovery path short of a page reload. For any operation that must succeed (build, publish, etc.), bypass the SDK entirely and manage tokens via direct localStorage access + raw GoTrue API calls.
