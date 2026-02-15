# QA Report — Phase 6: Polish & Integration Testing

**Date:** 2026-02-15T21:05:00Z
**Branch:** qa/phase-6-review (tracking origin/phase-6-polish-integration)
**PR:** #6
**Result:** FAIL (11/13 tests passed)

---

## Test Results

### TC-001: Build and type check pass with 0 errors
**Status:** PASS
**Steps:** Run `npm run build` in QA worktree -> Verify 0 errors -> Run `npx tsc --noEmit` -> Verify 0 errors
**Notes:** Build completed in 2.60s, 141 modules transformed. TypeScript type check produced no errors.

---

### TC-002: Error boundary catches render errors and shows fallback UI with Reload button
**Status:** PASS
**Steps:** Verify `src/components/ErrorBoundary.tsx` exists -> Confirm it is a class component extending `Component` -> Verify `getDerivedStateFromError` and `componentDidCatch` are implemented -> Verify fallback UI has "Something went wrong" heading + "Reload" button calling `window.location.reload()` -> Verify green-700 reload button -> Verify error boundary wraps `<Routes>` in App.tsx -> Verify no stack traces exposed to users
**Notes:**
- ErrorBoundary is a class component (the only permitted exception to functional-only rule).
- Fallback UI shows a centred card with "Something went wrong" heading, generic message, and green-700 Reload button.
- `componentDidCatch` logs to `console.error` only; no internal details exposed in the UI.
- In `App.tsx` (line 31-80), `<ErrorBoundary>` wraps `<Routes>`.
- Named export used (`export class ErrorBoundary`).

---

### TC-003: Dashboard tabs scroll horizontally on mobile with fade indicators
**Status:** PASS
**Steps:** Verify `src/components/dashboard/TabNav.tsx` has `overflow-x-auto` and `scrollbar-hide` on the scroll container -> Verify left/right gradient fade overlays exist, conditional on scroll position -> Verify `scrollbar-hide` CSS is defined in `globals.css` for WebKit, Firefox, and IE/Edge -> Verify `whitespace-nowrap` on tab buttons -> Verify `text-sm` base size on tabs
**Notes:**
- TabNav line 123: `overflow-x-auto scrollbar-hide` applied to the scrollable container.
- `globals.css` defines `.scrollbar-hide` with `-ms-overflow-style: none`, `scrollbar-width: none`, and `::-webkit-scrollbar { display: none }`.
- Left fade: line 106-111, conditional on `showLeftFade`, uses `bg-gradient-to-r from-white to-transparent`.
- Right fade: line 114-119, conditional on `showRightFade`, uses `bg-gradient-to-l from-white to-transparent`.
- Scroll listener updates fades on scroll and resize events.
- Tab buttons use `whitespace-nowrap` and `text-sm` base with `sm:text-base`.

---

### TC-004: Active tab auto-scrolls into view on mount
**Status:** PASS
**Steps:** Verify `TabNav.tsx` has a `useEffect` that calls `scrollIntoView({ inline: "center" })` on the active tab when `activeTab` changes
**Notes:**
- Lines 93-101: `useEffect` fires when `activeTab` changes, calls `activeTabRef.current.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })`.
- `activeTabRef` is conditionally assigned via `ref={isActive ? activeTabRef : undefined}` on each button.

---

### TC-005: 44px touch targets on dashboard tabs (WCAG 2.5.8)
**Status:** PASS
**Steps:** Verify tab buttons in TabNav have a minimum 44px touch target height
**Notes:**
- Line 146: `style={{ minHeight: "44px" }}` applied to each tab button.
- Additionally, `py-3` equivalent padding is applied via the class string.
- Meets WCAG 2.5.8 target size requirements.

---

### TC-006: Student table switches to card layout on mobile (<768px)
**Status:** PASS
**Steps:** Verify `src/routes/admin/students.tsx` has desktop table with `hidden md:block` -> Verify mobile card layout with `md:hidden` -> Verify each card has name, email, session, status badge, progress bar, and action buttons -> Verify `space-y-3` stacking -> Verify same empty state for both views -> Verify SpecViewer triggered from card action buttons
**Notes:**
- Desktop table: line 247, `Card className="hidden overflow-hidden p-0 md:block"`.
- Mobile cards: line 357, `div className="space-y-3 md:hidden"`.
- Each card contains: name/email (with truncation), status badge (reuses `StatusBadge`), session name, progress bar, View Spec button (triggers `setSelectedSpecId`), and View Site link.
- Empty state (lines 237-243) is shown for both views since it is rendered before the conditional desktop/mobile blocks.
- SpecViewer slide-over (lines 421-426) is triggered from both desktop table and mobile card action buttons.

---

### TC-007: All generated pages have sequential heading hierarchy
**Status:** FAIL
**Steps:** Audit all generated page files for heading gaps -> Check contact.ts "Find Me Online" changed from h3 to h2 -> Audit home.ts, services.ts, about.ts, testimonials.ts, faq.ts for heading hierarchy
**Expected:** Every generated page should have sequential headings (h1 -> h2 -> h3, no levels skipped)
**Actual:**
- `contact.ts`: FIXED. "Find Me Online" is now `<h2>` (line 82). Sequential: h1 -> h2. Correct.
- `home.ts`: h1 (hero) -> h2 (Services) -> h3 (service cards) -> h2 (Testimonials) -> h2 (About) -> h2 (CTA). Correct -- h3 cards are properly nested under h2.
- `services.ts`: h1 (Services title) -> h3 (individual service cards, line 31). **Gap: h1 directly to h3, skipping h2.** Then h2 (CTA). Incorrect sequence.
- `about.ts`: h1 (About title) -> h3 (Qualifications, line 69) -> h2 (Philosophy) -> h2 (CTA). **Gap: h1 directly to h3, skipping h2.** Incorrect sequence.
**Notes:** The contact.ts fix was applied correctly. However, the acceptance criterion states "All generated pages have sequential heading hierarchy" and the brief instructs to "Audit other pages for heading gaps." Two pages still have gaps: `services.ts` (h1 -> h3) and `about.ts` (h1 -> h3). The `services.ts` service cards use `<h3>` but sit directly under the `<h1>` section without an intermediate `<h2>`. Similarly, `about.ts` has a `<h3>` for qualifications directly under the page `<h1>`.

---

### TC-008: Focus-visible outlines appear on keyboard navigation in generated sites
**Status:** PASS
**Steps:** Verify `src/lib/pages/shared.ts` `generateCss()` includes `*:focus-visible` rule with outline using the primary colour
**Notes:**
- Lines 239-242 in `shared.ts`:
  ```css
  *:focus-visible {
    outline: 2px solid var(--colour-primary);
    outline-offset: 2px;
  }
  ```
- Comment references WCAG 2.4.7.
- Applied globally to all elements in generated sites.

---

### TC-009: Contrast ratio utility correctly calculates WCAG AA compliance
**Status:** PASS
**Steps:** Verify `src/lib/palettes.ts` exports `getContrastRatio(hex1, hex2)` and `meetsContrastAA(foreground, background)` -> Verify WCAG 2.1 relative luminance formula -> Verify AA threshold is 4.5 -> Verify both functions are exported
**Notes:**
- `getContrastRatio` (line 118): exported, uses WCAG 2.1 relative luminance formula via `hexToRgbChannel`, `linearise`, and `relativeLuminance` helper functions. Returns `(lighter + 0.05) / (darker + 0.05)`.
- `meetsContrastAA` (line 130): exported, returns `getContrastRatio(foreground, background) >= 4.5`.
- Linearisation uses the correct threshold (0.04045) and exponent (2.4).
- Both functions are properly typed with `string` parameters and return `number` / `boolean`.

---

### TC-010: Photos without alt text trigger a non-blocking build warning
**Status:** PASS
**Steps:** Verify `src/hooks/useBuild.ts` checks photos for empty/null alt text after fetching -> Verify warning is added to `validationWarnings` array -> Verify it is non-blocking (build proceeds)
**Notes:**
- Lines 169-174 in `useBuild.ts`: After fetching photos, filters for photos with empty or null `altText`, pushes a descriptive warning to the `warnings` array.
- Warning message: `"{N} photo(s) missing alt text. Adding descriptive alt text improves accessibility."`
- Non-blocking: the warning is added to the array but does not prevent the build from proceeding (build continues to `generateSite` on line 187).

---

### TC-011: Poor contrast triggers a non-blocking build warning
**Status:** PASS
**Steps:** Verify `useBuild.ts` imports `meetsContrastAA` from palettes -> Verify it checks primary text vs background -> Verify warning is non-blocking
**Notes:**
- Line 14: `import { getPaletteColours, meetsContrastAA } from "@/lib/palettes"`.
- Lines 177-182: Gets resolved palette colours, checks `meetsContrastAA(colours.text, colours.background)`. If fails, pushes warning: "Text colour may not meet WCAG AA contrast requirements against the background."
- Non-blocking: warning added to array, build proceeds.

---

### TC-012: Stale build shows "Rebuild" banner when spec is newer than deploy
**Status:** PASS
**Steps:** Verify `src/hooks/useSiteSpec.ts` exports `isStale: boolean` -> Verify stale detection logic compares `updated_at` vs build timestamp -> Verify `src/components/dashboard/PreviewTab.tsx` accepts `isStale` prop -> Verify rebuild banner shown when site is live AND stale -> Verify `src/routes/dashboard.tsx` passes `isStale` to PreviewTab
**Notes:**
- `useSiteSpec.ts` line 10: `isStale: boolean` in return type. Line 83-87: `isStale` computed as `siteSpec.status === "live" && lastBuildUpdatedAtRef.current !== null && siteSpec.updated_at > lastBuildUpdatedAtRef.current`.
- `lastBuildUpdatedAtRef` is set when status transitions to "building" or on initial load when "live" (lines 67-78).
- `PreviewTab.tsx` line 15: accepts `isStale?: boolean` prop. Line 163: destructures with default `false`.
- Lines 271-280: Rebuild banner rendered when `isLive && isStale && !building`, showing: "You've made changes since your last build. Rebuild to update your live site."
- `dashboard.tsx` line 18: destructures `isStale` from `useSiteSpec()`. Line 77: passes `isStale={isStale}` to `<PreviewTab>`.

---

### TC-013: 404 page has navigation back to home
**Status:** PASS
**Steps:** Verify `src/App.tsx` 404 route renders a page with "Go Home" link -> Verify link navigates to "/" -> Verify consistent styling (green-700 button)
**Notes:**
- `App.tsx` lines 12-27: `NotFoundPage` function renders "404" heading, descriptive text, and a `<Link to="/">Go Home</Link>`.
- Go Home link uses green-700 button styling with `bg-green-700`, `hover:bg-green-800`, and focus-visible outline.
- Route registered at line 78: `<Route path="*" element={<NotFoundPage />} />`.

---

### TC-014: Session create button has responsive width (w-full sm:w-auto)
**Status:** PASS
**Steps:** Verify `src/routes/admin/sessions.tsx` "Create Session" button has `w-full sm:w-auto` class
**Notes:**
- Line 57: `className="w-full sm:w-auto"` applied to the Create Session `<Button>`.

---

### TC-015: No visual regressions on desktop (architecture rules compliance)
**Status:** FAIL
**Steps:** Verify no `any` types -> Verify functional components only (except ErrorBoundary) -> Verify named exports -> Verify British English -> Verify green-700 primary colour -> Verify path aliases (@/) -> Verify no default exports except route pages
**Expected:** Full compliance with architecture rules
**Actual:**
- No `any` types: PASS. Grep for `: any` patterns returns no matches across the entire `src/` directory.
- Functional components only: PASS. Only one class component exists (`ErrorBoundary`), which is the permitted exception.
- Named exports: PASS. ErrorBoundary, TabNav, PreviewTab, and all hooks use named exports. Route pages use default exports as permitted.
- British English: PASS. "Colour" used in generated CSS variable names and warning messages. "Organisation" not applicable in current copy.
- Green-700 primary colour: PASS. All primary action buttons use `bg-green-700`.
- Path aliases: PASS. All internal imports use `@/` prefix. External library imports (react, react-router-dom) correctly use package names.
- Non-route imports from third-party packages are correctly excluded from the path alias check.

**However, the heading hierarchy issue from TC-007 constitutes a visual/semantic regression in the generated site output, as the acceptance criterion "All generated pages have sequential heading hierarchy" is not fully met.**

---

## Architecture Compliance Summary

| Rule | Status |
|------|--------|
| No `any` types | PASS |
| Functional components only (except ErrorBoundary) | PASS |
| Named exports (non-route files) | PASS |
| British English in user-facing copy | PASS |
| Green-700 primary colour | PASS |
| Path aliases (@/) | PASS |
| No dangerouslySetInnerHTML | PASS |
| max-w-5xl for student dashboard | PASS |
| max-w-6xl for admin | PASS |

---

## Summary

- **Passed:** 11
- **Failed:** 2
- **Total:** 13 (15 acceptance criteria items tested as 13 test cases, some criteria grouped)

### Failures Detail

1. **TC-007 (Heading hierarchy):** The contact page h3->h2 fix was applied correctly, but `services.ts` (h1 -> h3 on line 31) and `about.ts` (h1 -> h3 on line 69) still have heading level gaps. The acceptance criterion states "All generated pages have sequential heading hierarchy" and the brief explicitly asked to "Audit other pages for heading gaps." These two pages were not addressed.

2. **TC-015 (No visual regressions):** Marked as FAIL solely because of the heading hierarchy issue from TC-007, which represents a semantic structure regression in generated site output that would affect screen reader navigation and WCAG compliance.

### Recommended Fixes

1. **`src/lib/pages/services.ts` line 31:** Change `<h3>` to `<h2>` for individual service card titles, since they sit directly under the page `<h1>`. Alternatively, wrap them under a section with its own `<h2>` grouping.
2. **`src/lib/pages/about.ts` line 69:** Change `<h3>Qualifications &amp; Accreditation</h3>` to `<h2>Qualifications &amp; Accreditation</h2>`, since it sits directly under the page `<h1>`.

All other Phase 6 acceptance criteria are fully met. The error boundary, mobile tab navigation, mobile student cards, focus-visible styles, contrast ratio utility, build validation warnings, stale build detection, rebuild banner, 404 page, and responsive session button are all correctly implemented.
