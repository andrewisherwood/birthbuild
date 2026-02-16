# Project Status

**Project:** BirthBuild
**Started:** 2026-02-15T17:15:00Z
**Last Updated:** 2026-02-16T00:10:00Z
**Current Phase:** Post-MVP — Live Testing & Fixes

## Progress

| Phase | Feature | Plan | Dev | QA | Security | Merged |
|-------|---------|------|-----|-----|----------|--------|
| 1 | Foundation & Auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Chatbot Onboarding | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Dashboard Form Editor | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | Build Pipeline & Deploy | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | Instructor Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 | Polish & Integration Testing | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7 | Live Deployment & Hotfixes | — | 🔧 | — | — | — |

## Current Activity

**Post-MVP live testing session (2026-02-16)**
- End-to-end flow verified: chatbot → site spec → build → deploy to subdomain
- First live site deployed: `andrew-isherwood.birthbuild.com`
- All 4 Edge Functions deployed to Supabase (chat, build, invite, generate-link)
- Multiple hotfixes applied (see Session 2 below)

## Live Deployment

| Component | Status | URL |
|-----------|--------|-----|
| Admin PWA | ✅ Live | birthbuild.com |
| Supabase project | ✅ Live | btkruvwxhyqotofpfbps.supabase.co |
| Edge Functions (4) | ✅ Deployed | chat v3, build v1, invite v1, generate-link v1 |
| First generated site | ✅ Live | andrew-isherwood.birthbuild.com |

## Known Issues (from live testing)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Chat feels slow during tool-use steps (multiple sequential Claude API calls) | Medium | Open |
| 2 | Text input lag in chat (possible re-render issue) | Medium | Open |
| 3 | No "next" button between chat steps — user must prompt manually | Medium | Open |
| 4 | Chat ↔ dashboard navigation lacks clear flow/CTA | Medium | Open |
| 5 | Photo thumbnails broken in dashboard (storage URLs not resolving) | Medium | Open |
| 6 | Multiple empty draft site_spec rows created per user | Low | Open |
| 7 | Supabase free-tier email rate limits block magic links during testing | Low | Workaround (generate-link Edge Function) |
| 8 | Custom SMTP (Resend) not configured | Low | Blocked (Resend outage) |
| 9 | Build status badge still shows "Draft" when viewing wrong site_spec row | Low | Open |

## Review Stats

| Metric | Value |
|--------|-------|
| Plans reviewed | 6 |
| Suggestions accepted | 0 |
| Suggestions rejected | 0 |
| QA rounds (total) | 12 |
| Security findings fixed | 20 |
| QA findings fixed | 2 |
| Avg phase duration | ~30 min |

## Session 2 — Live Deployment Hotfixes (2026-02-16)

| Timestamp | Fix |
|-----------|-----|
| ~22:30 | Fixed white screen: added try-catch to `useAuth.getInitialSession()` so loading spinner resolves on error |
| ~22:35 | Applied DB migration: `handle_new_user` trigger, backfilled profiles, fixed search_path on 5 functions, added 8 FK indexes, reloaded PostgREST cache |
| ~22:40 | Resolved 5/6 Supabase security advisories (Function Search Path Mutable, Unindexed Foreign Keys) |
| ~22:45 | Deployed chat Edge Function (was missing from Supabase) |
| ~22:50 | Created tenant "BirthBuild Demo" + tenant_secrets row; set hello@ as instructor, chef@ as student |
| ~23:05 | Deployed temporary `generate-link` Edge Function to bypass email rate limits |
| ~23:15 | Redeployed chat Edge Function with `verify_jwt: false` (function handles auth internally) |
| ~23:30 | Added tool-use loop to chat Edge Function — auto-sends `tool_result` back to Claude and continues until text response |
| ~23:55 | Deployed build + invite Edge Functions |
| ~00:00 | NETLIFY_API_TOKEN configured as Edge Function secret |
| ~00:01 | First live site deployed to andrew-isherwood.birthbuild.com |

## Audit Trail (Session 1 — Build Phase)

| Timestamp | Event |
|-----------|-------|
| 2026-02-15T17:15:00Z | Coordinator onboarded, 6 phases planned |
| 2026-02-15T17:17:00Z | Phase 1 plan approved, brief handed to dev |
| 2026-02-15T17:27:00Z | Phase 1 PR #1 opened |
| 2026-02-15T17:31:00Z | QA round 1: PASS, Security round 1: 6 findings (1 Critical, 2 High, 3 Low) |
| 2026-02-15T17:38:00Z | Dev fixed all security findings |
| 2026-02-15T17:41:00Z | QA round 2: PASS, Security round 2: PASS (all findings resolved) |
| 2026-02-15T17:42:17Z | Phase 1 merged (PR #1) |
| 2026-02-15T17:43:00Z | Phase 2 plan approved, brief handed to dev |
| 2026-02-15T17:55:00Z | Phase 2 PR #2 opened |
| 2026-02-15T18:08:00Z | QA round 1: PASS, Security round 1: 5 Medium + 2 Low findings |
| 2026-02-15T18:10:00Z | Dev fixed 5 mandatory security findings (SEC-007 through SEC-011) |
| 2026-02-15T18:15:00Z | QA round 2: PASS, Security round 2: PASS (all findings resolved) |
| 2026-02-15T18:18:00Z | Phase 2 merged (PR #2) |
| 2026-02-15T18:26:00Z | Phase 3 plan approved, brief handed to dev |
| 2026-02-15T18:35:00Z | Phase 3 PR #3 opened (22 new files, 7-tab dashboard) |
| 2026-02-15T18:40:00Z | QA round 1: PASS (24/24), Security round 1: 3 High/Medium + 4 Low findings |
| 2026-02-15T18:45:00Z | Dev fixed 3 mandatory security findings (SEC-012, SEC-013, SEC-014) |
| 2026-02-15T18:48:00Z | QA round 2: PASS (6/6), Security round 2: PASS (all findings resolved) |
| 2026-02-15T18:50:00Z | Phase 3 merged (PR #3) |
| 2026-02-15T18:55:00Z | Phase 4 plan approved, brief handed to dev |
| 2026-02-15T19:15:00Z | Phase 4 PR #4 opened (12 new files, 5 modified — site gen, build edge fn, preview) |
| 2026-02-15T19:22:00Z | QA round 1: PASS (36/36), Security round 1: 9 findings (4 Medium, 5 Low) |
| 2026-02-15T19:25:00Z | Dev fixed 4 mandatory security findings (SEC-019 through SEC-022) |
| 2026-02-15T19:30:00Z | QA round 2: PASS (36/36), Security round 2: PASS (all Medium findings resolved) |
| 2026-02-15T19:30:00Z | Phase 4 merged (PR #4) |
| 2026-02-15T19:35:00Z | Phase 5 plan approved (6 loops), brief handed to dev |
| 2026-02-15T19:50:00Z | Phase 5 PR #5 opened (7 new files, 3 modified — admin shell, sessions, students, invite edge fn) |
| 2026-02-15T20:00:00Z | QA round 1: PASS (22/22), Security round 1: 7 findings (1 High, 2 Medium, 4 Low) |
| 2026-02-15T20:35:00Z | Dev fixed 3 mandatory security findings (SEC-028, SEC-029, SEC-030) |
| 2026-02-15T20:40:00Z | QA round 2: PASS (8/8), Security round 2: APPROVE (all findings resolved) |
| 2026-02-15T20:45:00Z | Phase 5 merged (PR #5) |
| 2026-02-15T20:50:00Z | Phase 6 plan approved (6 loops), brief handed to dev |
| 2026-02-15T21:15:00Z | Phase 6 PR #6 opened (1 new file, 10 modified — error boundary, mobile responsive, accessibility, build validation) |
| 2026-02-15T21:25:00Z | QA round 1: 11/13 (2 heading hierarchy gaps), Security round 1: APPROVE (CLEAN) |
| 2026-02-15T21:30:00Z | Dev fixed 2 QA findings (heading hierarchy in services.ts and about.ts) |
| 2026-02-15T21:40:00Z | QA round 2: PASS (13/13), Security round 2: APPROVE (CLEAN) |
| 2026-02-15T21:45:00Z | Phase 6 merged (PR #6) |
| 2026-02-15T21:45:00Z | All phases complete — project delivered |
