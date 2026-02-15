# Changes Requested — Phase 4

**Source:** QA Report + Security Review
**PR:** #4
**Round:** 1 (Max: 3)
**Requested:** 2026-02-15T19:25:00Z

---

## From QA

**No blocking issues.** QA passed 36/36 checks. No action required.

---

## From Security

### SEC-021 (Medium): JSON-LD `</script>` Breakout XSS
**Files:** `src/lib/pages/home.ts`, `src/lib/pages/faq.ts`
**Issue:** JSON-LD schema blocks use `JSON.stringify()` to embed user content into `<script type="application/ld+json">` tags. `JSON.stringify` does NOT escape the sequence `</script>`, which allows a user to break out of the script tag and inject arbitrary HTML/JavaScript. This is a stored XSS vector on generated public sites.
**Fix:** After `JSON.stringify()`, replace all `<` characters with `\u003c`:
```typescript
const safeJson = JSON.stringify(schemaData).replace(/</g, "\\u003c");
```
Apply this to both `home.ts` and `faq.ts` where JSON-LD is generated.

### SEC-022 (Medium): booking_url Rendered as href Without Scheme Validation
**File:** `src/lib/pages/contact.ts`
**Issue:** `booking_url` is rendered as `<a href="...">` without validating the URL scheme. A `javascript:alert(1)` value would pass `escapeHtml()` and be rendered as a clickable link.
**Fix:** Validate that `booking_url` starts with `https://` or `http://` before rendering as a link. If invalid, omit the booking link section entirely.

### SEC-019 (Medium): Missing UUID Format Validation on site_spec_id
**File:** `supabase/functions/build/index.ts`
**Issue:** `site_spec_id` is validated as a non-empty string but not as a UUID format. It is passed to database queries via service role client.
**Fix:** Add UUID regex validation before the database query:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(body.site_spec_id)) {
  // return 400 "Invalid site specification ID."
}
```

### SEC-020 (Medium): No File Path Sanitisation in Zip Creation
**File:** `supabase/functions/build/index.ts`
**Issue:** File paths from the client are written directly into the ZIP archive without sanitisation. A modified client could send paths like `../../../etc/passwd`.
**Fix:** Validate each file path in the validation loop: must not contain `..`, must not start with `/`, should match expected pattern (e.g., alphanumeric with `.html`, `.xml`, `.txt`, `.css` extensions), max length 100 chars.

---

## Instructions

1. Read all issues above
2. Fix all mandatory issues (SEC-021, SEC-022, SEC-019, SEC-020 — 4 fixes)
3. SEC-023 through SEC-027 are Low/Informational — no action required for this phase
4. Test locally: `npm run build && npx tsc --noEmit`
5. Push to same branch: `git push origin phase-4-build-pipeline-deploy`

**Coordinator will re-run QA and Security. If all issues resolve -> merge. If new issues -> next round.**
