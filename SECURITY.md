# Security Log

**Project:** BirthBuild
**Initialized:** 2026-02-15T17:14:44Z
**Last Updated:** 2026-02-15T17:14:44Z

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

_(No reviews yet)_

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
