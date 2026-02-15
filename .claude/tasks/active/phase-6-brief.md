# Implementation Brief

**Task:** Polish & Integration Testing
**Phase:** 6
**Branch:** `phase-6-polish-integration`
**PR Title:** `Phase 6: Polish & Integration Testing`
**Priority:** P0
**Created:** 2026-02-15T20:50:00Z
**Created by:** Coordinator

---

## Summary

Final phase: harden the app for production readiness. Add a global React error boundary, improve mobile responsiveness (dashboard tabs, admin student table), enhance generated site accessibility (heading hierarchy, focus-visible styles, colour contrast utility), add build-time validation warnings (alt text, contrast), and wire up the edit→rebuild flow with a stale build banner. No new Edge Functions or database changes.

## Architecture Rules (MUST follow)

1. **No `any` type** — TypeScript strict mode enforced
2. **Functional components only** — no class components (exception: ErrorBoundary requires class)
3. **Named exports** for all non-route files; `export default` only for route pages
4. **British English** in all user-facing copy ("Colour", "Organisation")
5. **Reuse existing UI primitives** — Button, Input, Card, LoadingSpinner
6. **Generic errors to user** — no Supabase error details in UI
7. **No `dangerouslySetInnerHTML`** — render via React components
8. **Path alias** — use `@/` for `src/` imports
9. **Green primary colour** — `green-700` for primary actions, `gray-*` for text/borders
10. **`max-w-5xl mx-auto`** — student dashboard content width; `max-w-6xl` for admin

---

## Implementation Steps

### Loop 1: Global Error Boundary

**Create:** `src/components/ErrorBoundary.tsx`
**Modify:** `src/App.tsx`

- Class component (required by React for error boundaries — only exception to functional-only rule)
- Catches render errors in any child component tree
- Fallback UI: centred card with "Something went wrong" heading, "Reload" button (calls `window.location.reload()`), generic message
- Logs error to `console.error`
- Wrap `<Routes>` in `App.tsx` with `<ErrorBoundary>`
- Green-themed reload button, consistent with app design

### Loop 2: Mobile Dashboard Tab Navigation

**Modify:** `src/components/dashboard/DashboardShell.tsx`

- Add `overflow-x-auto` and `scrollbar-hide` to the tab container
- Add CSS for hiding scrollbar (webkit + Firefox)
- Add gradient fade overlays on left/right edges when content overflows (use a ref + scroll listener)
- `whitespace-nowrap` on each tab, `text-sm` on mobile → `text-base sm:`
- Auto-scroll active tab into view on mount via `scrollIntoView({ inline: "center" })`
- Minimum 44px touch target height (WCAG 2.5.8) — `py-3` on tab buttons

### Loop 3: Mobile Admin Student Table

**Modify:** `src/routes/admin/students.tsx`

- Desktop (≥768px): keep existing table (`hidden md:block`)
- Mobile (<768px): card-based layout (`md:hidden`)
- Each student as a Card: name, email, session, status badge, progress bar, View Spec / View Site buttons
- Cards stack vertically with `space-y-3`
- Same empty state shown in both views
- SpecViewer slide-over still works from card action buttons

### Loop 4: Generated Site Accessibility Improvements

**Modify:** `src/lib/pages/contact.ts`, `src/lib/pages/shared.ts`, `src/lib/palettes.ts`

1. **Heading hierarchy** (`contact.ts`): Change "Find Me Online" from `<h3>` to `<h2>`. Audit other pages for heading gaps.
2. **Focus-visible styles** (`shared.ts`): Add `*:focus-visible { outline: 2px solid [primary]; outline-offset: 2px; }` to `generateCss()`
3. **Contrast ratio utility** (`palettes.ts`):
   - `getContrastRatio(hex1: string, hex2: string): number` — WCAG 2.1 relative luminance formula
   - `meetsContrastAA(foreground: string, background: string): boolean` — ratio >= 4.5
   - Export both functions

### Loop 5: Build Validation Enhancements

**Modify:** `src/hooks/useBuild.ts`, `src/hooks/useSiteSpec.ts`, `src/components/dashboard/PreviewTab.tsx`

1. **Photo alt text warnings** (useBuild): After fetching photos, check for empty/null alt_text. Add non-blocking warning.
2. **Contrast ratio warning** (useBuild): Import `meetsContrastAA` from palettes. Check primary text vs background. Add non-blocking warning if fails AA.
3. **Stale build detection** (useSiteSpec): Compare `spec.updated_at` vs build timestamp. Export `isStale: boolean`.
4. **Rebuild banner** (PreviewTab): If site is live AND spec is stale, show banner: "You've made changes since your last build. Rebuild to update your live site."

### Loop 6: Final Polish + Build Verification

**Modify:** `src/routes/admin/sessions.tsx`, `src/App.tsx`

1. **Session cards**: Ensure "Create Session" button is `w-full sm:w-auto`
2. **404 page**: Add "Go Home" link, consistent styling
3. **Final build**: `npm run build && npx tsc --noEmit` — 0 errors

---

## Files Summary

### Files to Modify
- `src/App.tsx` — Wrap Routes with ErrorBoundary, improve 404 page
- `src/components/dashboard/DashboardShell.tsx` — Mobile tab scrolling
- `src/routes/admin/students.tsx` — Mobile card layout
- `src/lib/pages/contact.ts` — Heading hierarchy fix
- `src/lib/pages/shared.ts` — Focus-visible styles, skip link enhancement
- `src/lib/palettes.ts` — Contrast ratio utility functions
- `src/hooks/useBuild.ts` — Alt text and contrast warnings
- `src/hooks/useSiteSpec.ts` — Stale build detection
- `src/components/dashboard/PreviewTab.tsx` — Rebuild banner
- `src/routes/admin/sessions.tsx` — Mobile touch-ups

### Files to Create
- `src/components/ErrorBoundary.tsx` — React error boundary

---

## Acceptance Criteria

- [ ] Error boundary catches render errors and shows fallback UI with Reload button
- [ ] Dashboard tabs scroll horizontally on mobile with fade indicators
- [ ] Active tab auto-scrolls into view on mount
- [ ] Student table switches to card layout on mobile (<768px)
- [ ] All generated pages have sequential heading hierarchy
- [ ] Focus-visible outlines appear on keyboard navigation in generated sites
- [ ] Contrast ratio utility correctly calculates WCAG AA compliance
- [ ] Photos without alt text trigger a non-blocking build warning
- [ ] Poor contrast triggers a non-blocking build warning
- [ ] Stale build shows "Rebuild" banner when spec is newer than deploy
- [ ] 404 page has navigation back to home
- [ ] Build and type check pass with 0 errors
- [ ] No visual regressions on desktop

---

## Security Notes

- Error boundary must NOT expose stack traces or internal errors to users. Generic message only.
- Contrast ratio utility is pure computation — no security concern.
- No new API endpoints, Edge Functions, or database queries in this phase.
- All changes are client-side or in the static site generator.

---

## Context

### Existing patterns to follow
- Dashboard layout: `DashboardShell.tsx` with `TabNav` inline component
- Admin layout: `AdminShell.tsx` with green-700 active nav styling
- Card component: `src/components/ui/Card.tsx` — reuse for mobile cards
- Status badges: Already defined in `students.tsx` — reuse for mobile cards
- Build validation: `useBuild.ts` has `validationWarnings` array, `PreviewTab.tsx` renders them
- Colour palette types: `PaletteOption` in `palettes.ts` with hex colour values

### Key function locations
- TabNav component: inline in `src/components/dashboard/DashboardShell.tsx`
- Build trigger: `src/hooks/useBuild.ts` → `triggerBuild()`
- Validation warnings: `src/hooks/useBuild.ts` → returned in hook result
- Site CSS generation: `src/lib/pages/shared.ts` → `generateCss()`
- Palette definitions: `src/lib/palettes.ts` → `PALETTE_OPTIONS`
- Student table: `src/routes/admin/students.tsx` → main table JSX

### Build command
```bash
npm run build && npx tsc --noEmit
```
