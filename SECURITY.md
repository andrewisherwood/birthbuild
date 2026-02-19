# Security Log

**Project:** BirthBuild
**Initialized:** 2026-02-15T17:14:44Z
**Last Updated:** 2026-02-18T12:00:00Z

## Overview

This is an append-only log of all security findings and events, populated by:
1. Automated post-commit hook scanning
2. Manual security agent reviews

---

## Automated Findings

_(No findings yet)_

---

## Manual Reviews

_(Entries added by Security Agent via /security-audit skill)_

### LLM Site Generation Feature (2026-02-18)
- **PR:** #9
- **Branch:** feature/llm-site-generation
- **Result:** ISSUES FOUND (14 findings: 0 Critical, 1 High, 4 Medium, 9 Low)
- **Scope:** 3 new Edge Functions (generate-design-system, generate-page, edit-section), shared edge helpers, HTML sanitiser, auth bypass module, checkpoint system, site editor UI
- **New API endpoints:** generate-design-system, generate-page, edit-section
- **New database tables:** site_checkpoints (with RLS)
- **Key findings:**
  - SEC-035 (High): HTML sanitiser regex bypass vectors (unclosed script tags, base tag, javascript: encoding)
  - SEC-036 (Medium): CSS output not sanitised (data exfiltration risk)
  - SEC-037 (Medium): Prompt injection surface in edit-section
  - SEC-038 (Medium): Iframe sandbox too permissive (srcdoc + allow-same-origin)
  - SEC-039 (Medium): Auth bypass module lacks token validation
  - SEC-040-048 (Low): Rate limit resets, missing body size limits, checkpoint race conditions, informational items
- **Automated findings triaged:** All CRITICAL/HIGH automated scanner findings confirmed as FALSE POSITIVES (server-side env access and RegExp.exec)
- **Remediation (commit `82cc0e2`):** ALL critical, high, and medium findings resolved:
  - SEC-035: Fixed — added unclosed script detection, `<base>` tag blocking, entity-encoded javascript: matching
  - SEC-036: Fixed — new `sanitiseCss()` strips `</style>` breakouts, `@import`, `expression()`, dangerous `url()`
  - SEC-037: Mitigated — hardcoded system prompts, output sanitisation applied
  - SEC-038: Fixed — iframe `sandbox=""` (removed `allow-same-origin`)
  - SEC-039: Fixed — try/catch on fetch/JSON, session merge on refresh
  - SEC-040-048: Fixed — DB-backed rate limiting, body size validation, checkpoint version retry, CSP headers, public photo URLs
- **Verdict:** ALL review items resolved. APPROVE for merge.
- **Full review:** See SECURITY_REVIEW.md

### Phase 6: Polish & Integration Testing (2026-02-15)
- **PR:** #6
- **Branch:** phase-6-polish-integration
- **Result:** CLEAN (0 findings)
- **Scope:** ErrorBoundary, mobile layouts, contrast ratio utility, stale build detection, 404 page, accessibility CSS
- **New API endpoints:** None
- **New database queries:** None
- **Prior findings verified:** SEC-017 through SEC-030 -- no regressions
- **Remaining Low/informational:** SEC-031, SEC-032, SEC-033, SEC-034 (unchanged from Phase 5)
- **Verdict:** APPROVE for merge
- **Full review:** See SECURITY_REVIEW.md

### Phase 5: Instructor Admin (2026-02-15)
- **PR:** #5
- **Branch:** phase-5-instructor-admin
- **Round 1 Result:** ISSUES FOUND (7 findings: 0 Critical, 1 High, 2 Medium, 4 Low)
  - SEC-028 (High): Cross-tenant profile reassignment via existing user re-invite
  - SEC-029 (Medium): Rate limiter counts emails before validation
  - SEC-030 (Medium): Magic links returned in API response body
  - SEC-031 (Low): PII (email addresses) logged in server console.error
  - SEC-032 (Low): Client-side 50-email limit not enforced
  - SEC-033 (Low): SpecViewer specId not UUID-validated
  - SEC-034 (Low): No session name length limit
- **Round 2 Result:** CLEAN -- all 3 mandatory findings RESOLVED (commit `bb8e39b`)
  - SEC-028 (Cross-tenant profile reassignment): RESOLVED -- tenant_id guard added
  - SEC-029 (Rate limiter logic): RESOLVED -- check-before-increment implemented
  - SEC-030 (Cache-Control on magic links): RESOLVED -- no-store header added
- **New vulnerabilities from fixes:** 0
- **Prior findings verified:** SEC-017 through SEC-022 -- no regressions
- **Remaining Low/informational:** SEC-031, SEC-032, SEC-033, SEC-034
- **Verdict:** APPROVE for merge
- **Full review:** See SECURITY_REVIEW.md

### Phase 4: Build Pipeline & Deploy (2026-02-15)
- **PR:** #4
- **Branch:** phase-4-build-pipeline-deploy
- **Round 1 Result:** ISSUES FOUND (9 findings: 0 Critical, 0 High, 4 Medium, 5 Low)
- **Round 2 Result:** CLEAN -- all 4 Medium findings RESOLVED (commit `e16e802`)
  - SEC-019 (UUID validation): RESOLVED
  - SEC-020 (zip path traversal): RESOLVED
  - SEC-021 (JSON-LD script breakout XSS): RESOLVED
  - SEC-022 (booking_url javascript: scheme): RESOLVED
- **Remaining Low/informational:** SEC-023, SEC-024, SEC-025, SEC-026, SEC-027
- **Prior findings verified:** SEC-017, SEC-018 -- no regressions
- **Verdict:** APPROVE for merge
- **Full review:** See SECURITY_REVIEW.md

### Phase 3: Dashboard Form Editor (2026-02-15)
- **PR:** #3
- **Branch:** phase-3-dashboard-form-editor
- **Result:** ISSUES FOUND (7 findings: 0 Critical, 1 High, 2 Medium, 4 Low)
- **Fixed by Dev Agent:** SEC-012, SEC-013, SEC-014 (verified in Round 2)
- **Informational:** SEC-015, SEC-016, SEC-017, SEC-018
- **Full review:** See SECURITY_REVIEW.md (Phase 3 section)

---

## Scan Categories

### Secrets/Keys (CRITICAL)
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRIVATE_KEY`
- `password=`
- `secret=`
- `api_key=`
- `token=`
- `AWS_SECRET`
- `GITHUB_TOKEN`
- `-----BEGIN.*KEY-----`

### Dangerous Functions (HIGH)
- `eval(`
- `dangerouslySetInnerHTML`
- `innerHTML`
- `document.write`
- `exec(`
- `child_process`
- `Function(`
- `setTimeout(` with string arg
- `setInterval(` with string arg

### Environment Leaks (LOW)
- `process.env.`
- `console.log`
- `console.debug`
- `console.trace`

### Security TODOs (LOW)
- `TODO.*security`
- `FIXME.*auth`
- `HACK`

### Scan — 016135c (2026-02-16T13:00:14Z)

**Commit:** `016135c` | **Files scanned:** 6 | **Findings:** 2

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/invite/index.ts:133


### Scan — dadef1f (2026-02-16T13:36:35Z)

**Commit:** `dadef1f` | **Files scanned:** 30 | **Findings:** 6

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/build/index.ts:362
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/chat/index.ts:373
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/delete-site/index.ts:80
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/publish/index.ts:109
- **HIGH** `exec(` — src/hooks/useChat.ts:66


### Scan — 61b1058 (2026-02-16T13:46:01Z)

**Commit:** `61b1058` | **Files scanned:** 8 | **Findings:** 3

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/build/index.ts:362
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/publish/index.ts:109


### Scan — 21bce34 (2026-02-16T15:00:05Z)

**Commit:** `21bce34` | **Files scanned:** 11 | **Findings:** 2

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/design-chat/index.ts:230


### Scan — d0beae7 (2026-02-17T07:10:33Z)

**Commit:** `d0beae7` | **Files scanned:** 19 | **Findings:** 4

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/_shared/edge-helpers.ts:94
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/_shared/edge-helpers.ts:156
- **HIGH** `exec(` — src/lib/section-parser.ts:49


### Scan — 4001961 (2026-02-17T17:08:21Z)

**Commit:** `4001961` | **Files scanned:** 17 | **Findings:** 10

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/_shared/edge-helpers.ts:100
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/_shared/edge-helpers.ts:162
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/build/index.ts:368
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/chat/index.ts:380
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/delete-site/index.ts:86
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/design-chat/index.ts:236
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/invite-instructor/index.ts:91
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/invite/index.ts:139
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/publish/index.ts:115


### Scan — 82cc0e2 (2026-02-18T11:38:40Z)

**Commit:** `82cc0e2` | **Files scanned:** 18 | **Findings:** 16

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/_shared/edge-helpers.ts:133
- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/_shared/edge-helpers.ts:195
- **HIGH** `exec(` — src/lib/section-parser.ts:36
- **LOW** `console.log` — src/hooks/useBuild.ts:337
- **LOW** `console.log` — src/hooks/useBuild.ts:354
- **LOW** `console.log` — src/hooks/useBuild.ts:361
- **LOW** `console.log` — src/hooks/useBuild.ts:373
- **LOW** `console.log` — src/hooks/useBuild.ts:378
- **LOW** `console.log` — src/hooks/useBuild.ts:409
- **LOW** `console.log` — src/hooks/useBuild.ts:430
- **LOW** `console.log` — src/hooks/useBuild.ts:434
- **LOW** `console.log` — src/hooks/useBuild.ts:466
- **LOW** `console.log` — src/hooks/useBuild.ts:520
- **LOW** `console.log` — src/hooks/useBuild.ts:582
- **LOW** `console.log` — src/hooks/useBuild.ts:617


### Scan — 23b2962 (2026-02-19T20:24:37Z)

**Commit:** `23b2962` | **Files scanned:** 10 | **Findings:** 2

- **CRITICAL** `SUPABASE_SERVICE_ROLE_KEY` — supabase/functions/chat/index.ts:625

