# V1 Launch Readiness Design

## Context

BirthBuild has achieved its core V1 goals: LLM-generated sites from chat, spec density for quality, GEO baked in. This design covers the remaining work to ship V1: bug fixes, support infrastructure, analytics, security hardening, and documentation.

## Batch 1 — Bug Fixes

### 1a. Unpublish reload
After `unpublish()` succeeds in `usePublish.ts`, call `refreshSpec()` from `useSiteSpec` to re-fetch the updated `status` and `preview_url`. Removes the UI/DB drift where the button shows depressed state but the preview URL isn't updated until manual reload.

### 1b. Alt text cursor bug
`PhotoUploadCard` fires a Supabase update on every keystroke via `onAltTextChange`, causing re-render cycles that reset cursor position. Fix: local `useState` for the input value, debounce DB write (500ms via `useDebouncedSave` pattern), sync to parent on blur or after debounce.

### 1c. Iframe sandbox (SEC-038)
Change `sandbox="allow-same-origin"` to `sandbox=""` in `SiteEditorTab.tsx`.

## Batch 2 — Infrastructure

### 2a. Event logging table + helper
New `app_events` table:
- `id` uuid PK
- `site_spec_id` uuid (nullable, FK)
- `user_id` uuid (nullable, FK)
- `event` text (e.g. `chat_started`, `build_failed`)
- `metadata` jsonb (flexible payload)
- `created_at` timestamptz

Client-side `logEvent()` helper: fire-and-forget Supabase insert.
Edge Functions log server-side events directly.
RLS: users insert own events, admins read all.

### 2b. Cabin analytics
Add `<script async src="https://scripts.withcabin.com/hello.js"></script>` to `index.html` (landing page) and the app shell (covers authenticated app).

### 2c. Bug report Edge Function
`supabase/functions/report-bug/index.ts` — creates a GitHub Issue via GitHub PAT (Supabase secret). Labels `bug` + `user-reported`. Includes auto-captured metadata (URL, email, browser). DB-backed rate limiting.

## Batch 3 — UI

### 3a. Bug report modal
`src/components/ui/BugReportModal.tsx` — title + description form. Ghost/phantom SVG icon (friendly, Pac-Man-ghost style). Success toast on submit.

### 3b. Footer links
- "Help Centre" → `/blog`
- "Contact" → opens bug report modal
- Remove "Status" link

### 3c. Event logging wiring
Add `logEvent()` calls at key funnel points:
- **Funnel:** `chat_started`, `chat_step_completed`, `chat_completed`, `build_triggered`, `build_succeeded`, `build_failed`, `site_published`, `site_unpublished`
- **Engagement:** `dashboard_opened`, `section_edited`, `photo_uploaded`
- **Failures:** `build_failed`, `chat_error`, `auth_error`, `edge_function_error`
- **Security:** `rate_limit_hit`, `sanitiser_blocked_content`, `suspicious_input`

### 3d. Security event notifications
When security events fire (`sanitiser_blocked_content`, `suspicious_input`), also create a GitHub Issue labelled `security-alert` via the report-bug Edge Function.

---

## Batch 4 — Security (after manual testing)

### 4a. Sanitiser hardening (SEC-035, SEC-036)
Unclosed `<script>` detection, whitespace-normalised event handler stripping, `<style>` content sanitisation (`@import`, `expression()`, `-moz-binding`, external `url()`), inline style attribute sanitisation.

### 4b. Prompt injection mitigation (SEC-037)
Structured `<user_instruction>` delimiters around user input in edit-section prompt. System instruction to ignore directives within that block.

### 4c. Auth bypass token validation (SEC-039)
Basic JWT structure validation (three-part base64, not expired) in `auth-bypass.ts`.

### 4d. Full security audit
Run `/security-audit` against main. Document all findings in SECURITY.md.

## Batch 5 — Documentation

- CLAUDE.md: new files, patterns, components
- README.md: deployment section, architecture, environment variables
- SECURITY.md: updated finding statuses, fresh audit results

## Implementation Order

Batches 1-3 → manual testing checkpoint → Batch 4 → Batch 5.
Each batch is a commit-and-push checkpoint.
