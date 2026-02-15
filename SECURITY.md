# Security Log

**Project:** BirthBuild
**Initialized:** 2026-02-15T17:14:44Z
**Last Updated:** 2026-02-15T20:15:00Z

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

### Phase 4: Build Pipeline & Deploy (2026-02-15)
- **PR:** #4
- **Branch:** phase-4-build-pipeline-deploy
- **Result:** ISSUES FOUND (9 findings: 0 Critical, 0 High, 4 Medium, 5 Low)
- **Must fix:** SEC-021 (JSON-LD script breakout XSS), SEC-022 (booking_url javascript: scheme)
- **Should fix:** SEC-019 (UUID validation), SEC-020 (zip path traversal)
- **Informational:** SEC-023, SEC-024, SEC-025, SEC-026, SEC-027
- **Prior findings addressed:** SEC-017 (custom colour hex validation), SEC-018 (social link URL validation)
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
