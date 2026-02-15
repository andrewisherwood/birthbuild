# Security Review -- Phase 6: Polish & Integration Testing

**Date:** 2026-02-15T22:00:00Z
**Branch:** phase-6-polish-integration
**PR:** #6
**Reviewer:** Security Agent
**Result:** CLEAN (0 findings)

---

## Scope

Phase 6 is a polish and accessibility phase. No new API endpoints, Edge Functions, or database queries were added. Changes are limited to:

1. Global `ErrorBoundary` component (class component)
2. Mobile dashboard tab navigation improvements (scroll, fade overlays)
3. Mobile admin student table card layout
4. Generated site accessibility (heading hierarchy, focus-visible, contrast ratio utility)
5. Build validation warnings (alt text, contrast, stale build detection)
6. Final polish (404 page, responsive buttons)

---

## Review Details

### ErrorBoundary (`src/components/ErrorBoundary.tsx`)

**Requirement:** Must NOT expose stack traces, error messages, or internal details to users.

**Assessment: PASS**

- Fallback UI renders only generic text: "Something went wrong" and "An unexpected error occurred. Please reload the page to try again."
- No error object, stack trace, component name, or internal state is rendered to the DOM.
- The `getDerivedStateFromError()` method sets only a boolean flag (`hasError: true`) -- no error details stored in state.
- `componentDidCatch(error, errorInfo)` logs to `console.error` on the client side. This is visible only in browser DevTools (not in the rendered UI). This is standard React error boundary practice and is acceptable for production. The logged information is not transmitted to any external service. This is consistent with SEC-031 (Low) which documented a similar pattern server-side.
- No `dangerouslySetInnerHTML`, no `innerHTML`, no XSS vectors.

### Contrast Ratio Utility (`src/lib/palettes.ts`)

**Requirement:** Pure computation -- verify no injection vectors in hex string parsing.

**Assessment: PASS**

- `hexToRgbChannel(hex)`: Uses `hex.replace("#", "")` and `parseInt(substring, 16)`. If given invalid hex (e.g., "gggggg"), `parseInt` returns `NaN`. The `NaN` propagates through `linearise()` and `relativeLuminance()` to `getContrastRatio()`, which produces `NaN`. The `meetsContrastAA()` check (`NaN >= 4.5`) returns `false`, which is the safe direction -- it reports the contrast as failing, never as passing.
- No DOM manipulation, no string interpolation into HTML, no `eval`, no injection surface.
- All functions are pure (no side effects, no I/O, no state mutation).

### Stale Build Detection (`src/hooks/useSiteSpec.ts`)

**Requirement:** Check that stale build detection does not expose timestamps or internal state inappropriately.

**Assessment: PASS**

- `isStale` is a boolean derived by comparing `siteSpec.updated_at` (already available to the authenticated user via RLS) with a locally stored ref. No new data is fetched or exposed.
- The UI displays only a generic message: "You've made changes since your last build. Rebuild to update your live site." No timestamp, no internal state, no diff summary.
- The `lastBuildUpdatedAtRef` is a React ref (in-memory, not persisted to localStorage or any storage).

### Build Validation Warnings (`src/hooks/useBuild.ts`)

**Assessment: PASS**

- Warning messages are static strings with simple interpolation (e.g., `${missingAlt.length} photo(s) missing alt text`). The count is a number, not user-controlled text.
- Warnings are rendered via React JSX in `PreviewTab.tsx` using `{warning}` syntax (auto-escaped by React).
- No new API calls, no new data fetching. Colour data comes from the existing `getPaletteColours()` which reads from the already-loaded `siteSpec`.

### Mobile Tab Navigation (`src/components/dashboard/TabNav.tsx`)

**Assessment: PASS**

- UI-only changes: scroll event listeners, fade overlay divs, `scrollIntoView()`, `minHeight: "44px"` inline style.
- All overlay divs have `aria-hidden="true"` and `pointer-events-none` -- cannot be interacted with.
- No new data flows, no new state persisted, no security surface.

### Mobile Student Card Layout (`src/routes/admin/students.tsx`)

**Assessment: PASS**

- Duplicates the desktop table data in a card layout for mobile (`md:hidden`). Same data, same rendering.
- External links (`View Site`) use `target="_blank" rel="noopener noreferrer"` -- consistent with desktop version.
- `student.site_spec!.id` passed to `setSelectedSpecId()` -- same pattern as desktop table (SEC-033 Low finding from Phase 5 still applies but is informational).

### 404 Page (`src/App.tsx`)

**Assessment: PASS**

- Renders only static text: "404" and "The page you're looking for could not be found."
- No path reflection, no query parameter display, no user input rendered.
- `Link to="/"` is a static route -- no injection vector.

### Generated Site Accessibility Changes (`src/lib/pages/contact.ts`, `src/lib/pages/shared.ts`)

**Assessment: PASS**

- `contact.ts`: Changed `<h3>` to `<h2>` for heading hierarchy. No security impact.
- `shared.ts`: Added `*:focus-visible { outline: 2px solid var(--colour-primary); outline-offset: 2px; }`. CSS-only change. The `var(--colour-primary)` value is set from palette colours that are already validated by `isValidHexColour()` (SEC-017).

### Scrollbar Hide CSS (`src/styles/globals.css`)

**Assessment: PASS**

- CSS-only utility class `.scrollbar-hide`. No JavaScript, no security impact.

### Responsive Button (`src/routes/admin/sessions.tsx`)

**Assessment: PASS**

- Added `className="w-full sm:w-auto"` to the Create Session button. CSS-only. No security impact.

---

## Prior Findings Regression Check

| Finding | File | Check | Status |
|---------|------|-------|--------|
| SEC-017 (Phase 3) | `src/lib/site-generator.ts` | `isValidHexColour()` present | No regression |
| SEC-018 (Phase 3) | `src/lib/pages/shared.ts` | `isValidSocialLink()` present | No regression |
| SEC-019 (Phase 4) | `supabase/functions/build/index.ts`:444 | `UUID_REGEX` validation present | No regression |
| SEC-020 (Phase 4) | `supabase/functions/build/index.ts`:476-508 | `SAFE_PATH_REGEX` allowlist present | No regression |
| SEC-021 (Phase 4) | `src/lib/pages/home.ts`:143, `src/lib/pages/faq.ts`:116 | `.replace(/</g, "\\u003c")` present | No regression |
| SEC-022 (Phase 4) | `src/lib/pages/contact.ts`:58 | `bookingUrl.startsWith("https://")` check present | No regression |
| SEC-028 (Phase 5) | `supabase/functions/invite/index.ts`:353 | Cross-tenant guard present | No regression |
| SEC-029 (Phase 5) | `supabase/functions/invite/index.ts`:67-68 | Check-before-increment logic present | No regression |
| SEC-030 (Phase 5) | `supabase/functions/invite/index.ts`:462 | `Cache-Control: no-store` header present | No regression |

---

## Checklist Results

### Authentication & Authorization
- [PASS] No new auth flows or endpoints introduced in Phase 6
- [PASS] ErrorBoundary does not bypass ProtectedRoute or RoleGate -- wraps Routes at the top level of App.tsx
- [PASS] Admin routes still protected by `ProtectedRoute` + `RoleGate role="instructor"` (unchanged)

### Data Security
- [PASS] No new database queries added (all hooks use existing Supabase anon client with RLS)
- [PASS] No sensitive data exposed in error boundary fallback UI
- [PASS] Stale build detection uses only data already available to the authenticated user
- [PASS] No new server-side logging added

### Frontend Security
- [PASS] No `dangerouslySetInnerHTML` or `innerHTML` usage in any changed file
- [PASS] No `document.write` or `eval` usage
- [PASS] All user-provided data rendered via React JSX auto-escaping
- [PASS] Validation warnings use static strings with numeric interpolation only
- [PASS] External links in mobile card layout use `target="_blank" rel="noopener noreferrer"`
- [PASS] 404 page does not reflect any user input (no path or query parameter display)
- [PASS] No sensitive data stored in localStorage

### API Security
- [PASS] No new API endpoints or Edge Functions added in Phase 6
- [PASS] No changes to existing Edge Functions
- [PASS] Build validation (alt text, contrast) runs entirely client-side before the existing build API call

### Dependencies
- [PASS] No new npm dependencies added in Phase 6
- [PASS] No changes to package.json or lockfile in the PR diff
- [PASS] No new Edge Function imports

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

---

## Merge Recommendation

**APPROVE.** Phase 6 is a clean polish and accessibility phase with no security findings. All changes are UI-only (ErrorBoundary, mobile layouts, CSS, validation warnings) or pure computation (contrast ratio utility). No new API endpoints, no new database queries, no new authentication flows. All prior findings (SEC-017 through SEC-030) have been verified with no regressions.

**Open Low findings from previous phases (do not block merge):**
- SEC-031 (Low): PII in server logs (informational, GDPR concern)
- SEC-032 (Low): Client-side 50-email limit not enforced (server enforces correctly)
- SEC-033 (Low): SpecViewer specId not UUID-validated (RLS provides protection)
- SEC-034 (Low): No session name length limit (database constraints provide protection)

---

## Round 2 Verification (2026-02-15)

**Context:** Dev agent fixed 2 QA findings (heading hierarchy gaps identified by the accessibility audit).

**Changes in Round 2:**
- `src/lib/pages/about.ts`: Changed `<h3>` to `<h2>` for "Qualifications & Accreditation" section
- `src/lib/pages/services.ts`: Changed `<h3>` to `<h2>` for service card titles

**Security Assessment:** Both changes are pure HTML semantic updates with no security impact. The content escaping via `escapeHtml()` in services.ts remains in place. No changes to auth, data handling, API calls, or validation logic.

**Result:** CLEAN — Round 1 APPROVE verdict confirmed for merge.

---

## Previous Reviews

The Phase 5, Phase 4, and Phase 3 security reviews are preserved in version control history.
