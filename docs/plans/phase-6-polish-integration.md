# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T20:50:00Z
**Total Phases:** 6

Phase 6 of 6 — Polish & Integration Testing

---

# Detailed Plan: Phase 6 — Polish & Integration Testing

**Date:** 2026-02-15
**Status:** Approved
**Branch:** `phase-6-polish-integration`

## Overview

Final phase: polish the app for production readiness. Add a global React error boundary, improve mobile responsiveness (dashboard tabs, admin tables), enhance generated site accessibility (heading hierarchy, colour contrast utility, alt text validation), and wire up the edit→rebuild flow with a post-edit rebuild prompt. This phase is about hardening what exists rather than building new features.

**Key architectural decisions:**
- Error boundary wraps all routes in App.tsx — catches render errors, provides "Reload" action
- Mobile table view for admin students page — card layout below 768px breakpoint
- Dashboard TabNav becomes horizontally scrollable with gradient fade indicators on mobile
- Generated site accessibility improvements are made in existing page generators (no new files)
- Alt text validation added as a build-time warning (not a blocker) in useBuild
- No new Edge Functions or database changes needed

## Pre-existing Code

| File | Purpose |
|------|---------|
| `src/App.tsx` | Route definitions — error boundary wraps all routes |
| `src/components/dashboard/DashboardShell.tsx` | Dashboard layout with TabNav |
| `src/components/dashboard/PreviewTab.tsx` | Build trigger, preview, subdomain management |
| `src/hooks/useBuild.ts` | Build orchestration, validation, Realtime subscription |
| `src/hooks/useSiteSpec.ts` | Site spec CRUD with optimistic updates |
| `src/components/admin/AdminShell.tsx` | Admin layout shell |
| `src/routes/admin/students.tsx` | Student table with status badges |
| `src/routes/admin/sessions.tsx` | Session cards with metrics |
| `src/lib/pages/shared.ts` | Shared HTML generation, CSS, accessibility |
| `src/lib/pages/home.ts` | Home page generator with JSON-LD |
| `src/lib/pages/contact.ts` | Contact page generator |
| `src/lib/pages/about.ts` | About page generator |
| `src/lib/pages/services.ts` | Services page generator |
| `src/lib/pages/testimonials.ts` | Testimonials page generator |
| `src/lib/pages/faq.ts` | FAQ page generator |
| `src/lib/site-generator.ts` | Site generation orchestrator |
| `src/lib/palettes.ts` | Colour palette definitions |
| `src/components/ui/*` | Button, Input, Card, LoadingSpinner |

## Architecture Rules (MUST follow)

1. **No `any` type** — TypeScript strict mode enforced
2. **Functional components only** — no class components
3. **Named exports** for all non-route files; `export default` only for route pages
4. **British English** in all user-facing copy ("Colour", "Organisation")
5. **Reuse existing UI primitives** — Button, Input, Card, LoadingSpinner
6. **RLS-scoped queries** — use anon client, never bypass RLS from client
7. **Generic errors to user** — no Supabase error details in UI
8. **No `dangerouslySetInnerHTML`** — render via React components
9. **Path alias** — use `@/` for `src/` imports
10. **Green primary colour** — `green-700` for primary actions, `gray-*` for text/borders
11. **`max-w-5xl mx-auto`** — student dashboard content width; `max-w-6xl` for admin

## Loops

### Loop 1: Global Error Boundary

**Files to create:**
- `src/components/ErrorBoundary.tsx` — React error boundary with fallback UI

**Files to modify:**
- `src/App.tsx` — Wrap Routes with ErrorBoundary

**Details:**

`ErrorBoundary.tsx`:
- Class component (required for React error boundaries — only exception to functional-only rule)
- Catches render errors in any child component tree
- Fallback UI: centred card with "Something went wrong" heading, "Reload" button, and generic message
- Logs error to `console.error` (no external service yet)
- `componentDidCatch` logs error info
- Green-themed reload button, consistent with app design
- Does NOT catch async/event handler errors (those are handled by hooks)

`App.tsx` integration:
- Wrap the `<Routes>` element with `<ErrorBoundary>`
- ErrorBoundary sits inside BrowserRouter (needs routing context for potential navigation)

**Acceptance criteria:**
- [ ] Error boundary catches render errors and shows fallback UI
- [ ] Reload button works (calls `window.location.reload()`)
- [ ] App continues to work normally when no errors occur
- [ ] TypeScript compiles with no errors

---

### Loop 2: Mobile Dashboard Tab Navigation

**Files to modify:**
- `src/components/dashboard/DashboardShell.tsx` — Improve TabNav for mobile

**Details:**

Improve the TabNav component within DashboardShell for mobile screens:

1. **Horizontal scroll with fade indicators**:
   - Add `overflow-x-auto scrollbar-hide` to the tab container
   - Add CSS for `scrollbar-hide` (webkit scrollbar none) if not already present
   - Add gradient fade overlays on left/right edges when scrollable (`bg-gradient-to-r from-white` / `bg-gradient-to-l from-white`)
   - Use a `useRef` + scroll event listener to show/hide fades based on scroll position

2. **Tab styling for mobile**:
   - `whitespace-nowrap` on each tab to prevent text wrapping
   - `text-sm` on mobile, `text-base` on `sm:` breakpoint
   - Ensure active tab is scrolled into view on mount (using `scrollIntoView({ inline: "center" })`)

3. **Touch-friendly**:
   - Minimum touch target 44px height (WCAG 2.5.8)
   - `py-3` padding on tab buttons

**Acceptance criteria:**
- [ ] Tabs scroll horizontally on mobile without breaking layout
- [ ] Active tab auto-scrolls into view
- [ ] Fade indicators show when content overflows
- [ ] Touch targets are at least 44px
- [ ] No visual regression on desktop

---

### Loop 3: Mobile Admin Student Table

**Files to modify:**
- `src/routes/admin/students.tsx` — Add mobile card layout

**Details:**

The student table works well on desktop but needs a responsive alternative for mobile:

1. **Desktop (≥768px)**: Keep existing table layout — no changes
2. **Mobile (<768px)**: Switch to card-based layout:
   - Each student rendered as a Card component
   - Card shows: name, email, session name, status badge, progress bar, action buttons
   - Cards stack vertically with `space-y-3`
   - Use `hidden md:block` for the table, `md:hidden` for the card list

Card layout:
```
┌──────────────────────────────────┐
│ Jane Smith                 ● Live│
│ jane@example.com                 │
│ Workshop 1                       │
│ ████████████████░░░░ 85%        │
│ [View Spec]  [View Site ↗]      │
└──────────────────────────────────┘
```

**Acceptance criteria:**
- [ ] Table hidden on mobile, card layout shown
- [ ] Cards on mobile, table on desktop
- [ ] All student data visible in card layout
- [ ] Status badges and progress bars render correctly in cards
- [ ] View Spec and View Site buttons work from cards

---

### Loop 4: Generated Site Accessibility Improvements

**Files to modify:**
- `src/lib/pages/contact.ts` — Fix heading hierarchy (h1 → h2 instead of h3)
- `src/lib/pages/shared.ts` — Add focus-visible styles, improve skip-link styling
- `src/lib/pages/home.ts` — Add alt="" to decorative SVG wordmark
- `src/lib/pages/about.ts` — Add heading hierarchy check
- `src/lib/palettes.ts` — Add WCAG contrast ratio utility function

**Details:**

1. **Heading hierarchy fix** (`contact.ts`):
   - Change "Find Me Online" from `<h3>` to `<h2>` for proper heading sequence (h1 → h2)
   - Audit all page generators for heading gaps

2. **Focus-visible styles** (`shared.ts`):
   - Add `*:focus-visible { outline: 2px solid [primary]; outline-offset: 2px; }` to generateCss
   - Ensures keyboard navigation is visible on all interactive elements

3. **Contrast ratio utility** (`palettes.ts`):
   - Add `getContrastRatio(hex1: string, hex2: string): number` function
   - Implements WCAG 2.1 relative luminance formula
   - Add `meetsContrastAA(foreground: string, background: string): boolean` (ratio >= 4.5 for normal text, >= 3 for large text)
   - Export for use in build validation

4. **Wordmark alt text** (`home.ts`):
   - Wordmark SVG in header should have `aria-label` with business name
   - Already handled via `<img alt="...">` — verify it's correct

5. **Skip link enhancement** (`shared.ts`):
   - Ensure skip link has visible focus state (already exists but verify)
   - Skip link should use the primary colour from palette for border

**Acceptance criteria:**
- [ ] All generated pages have sequential heading hierarchy (no gaps)
- [ ] Focus-visible outlines appear on keyboard navigation
- [ ] Contrast ratio utility correctly calculates WCAG AA compliance
- [ ] Skip link visible on keyboard focus
- [ ] TypeScript compiles with no errors

---

### Loop 5: Build Validation Enhancements

**Files to modify:**
- `src/hooks/useBuild.ts` — Add photo alt text warnings, contrast warnings

**Details:**

Enhance build-time validation to surface accessibility warnings:

1. **Photo alt text warnings**:
   - After fetching photos, check if any have empty or null `alt_text`
   - If so, add a warning to the validation result: "Some photos are missing alt text. This affects accessibility."
   - Warning is non-blocking (build can still proceed) — shown in yellow in PreviewTab
   - PreviewTab already shows `validationWarnings` — add these to the same array

2. **Contrast ratio warning**:
   - Import `meetsContrastAA` from palettes
   - Check primary text colour against background: if custom palette fails AA, add warning
   - "Your colour palette may have contrast issues. This could affect readability."
   - Non-blocking warning

3. **Rebuild prompt after edits**:
   - In `useSiteSpec.ts`, track whether spec has been modified since last build via a `staleRef`
   - Compare `spec.updated_at` vs `spec.deployed_at` (or build timestamp)
   - Export `isStale: boolean` from the hook
   - In `PreviewTab.tsx`, if site is live AND spec is stale, show a banner: "You've made changes since your last build. Rebuild to update your live site."
   - This addresses the SCOPING.md requirement for edit→rebuild flow

**Acceptance criteria:**
- [ ] Photos without alt text trigger a non-blocking warning
- [ ] Poor contrast ratio triggers a non-blocking warning
- [ ] Stale build detection shows "Rebuild" banner when spec is newer than deploy
- [ ] Warnings display correctly in PreviewTab
- [ ] Build still works with warnings (not blocking)

---

### Loop 6: Final Polish + Build Verification

**Files to modify:**
- `src/routes/admin/sessions.tsx` — Responsive touch-ups (card grid on mobile)
- `src/routes/index.tsx` — 404 page styling consistency

**Details:**

1. **Session cards responsive** (`sessions.tsx`):
   - Cards already use Card component — verify they stack on mobile
   - Ensure "Create Session" button is full-width on mobile (`w-full sm:w-auto`)
   - Verify invite modal is mobile-friendly (full-screen on mobile)

2. **404 page** (`App.tsx`):
   - Add a "Go Home" link to the 404 page
   - Consistent styling with the rest of the app

3. **Final build verification**:
   - `npm run build && npx tsc --noEmit` — must pass with 0 errors
   - Verify all existing functionality still works (no regressions)
   - Check that generated HTML includes all accessibility improvements

**Acceptance criteria:**
- [ ] Session cards responsive on mobile
- [ ] 404 page has navigation back to home
- [ ] Build and type check pass with 0 errors
- [ ] No visual regressions on desktop

---

## Security Considerations

1. **Error boundary**: Must not expose stack traces or internal errors to users. The fallback UI shows a generic message only. `console.error` for dev debugging only.

2. **Contrast ratio utility**: Pure computation, no security concern. Operates on hex colour strings only — validate input format.

3. **No new API endpoints**: This phase adds no new Edge Functions or database queries. All changes are client-side or in the static site generator.

4. **Alt text validation**: Non-blocking — does not prevent builds. Users are warned but not forced. No new data flows.

## Edge Cases

1. **Error boundary in development**: React's development mode shows error overlay on top of error boundary. This is expected and should not be suppressed.
2. **TabNav with 1 tab**: If somehow only 1 tab is shown, horizontal scroll should not activate. Fade indicators should not appear.
3. **Empty student list on mobile**: Card layout should show the same empty state as the table view.
4. **Custom palette with identical fg/bg**: Contrast ratio would be 1:1 — warning should fire. Edge case: palette not yet selected (null) should skip contrast check.
5. **Stale build with no deploy_url**: If site has never been built, `isStale` should be false (nothing to be stale against). Only show rebuild banner when a previous build exists.
6. **Very long business name in mobile card**: Should truncate with ellipsis rather than breaking layout.

## Sequencing Notes

- **Loop 1 must complete first** — ErrorBoundary wraps all routes, affects all subsequent testing
- **Loops 2 and 3 are independent** — mobile dashboard and mobile admin can be done in parallel
- **Loop 4 is independent** — generated site accessibility is separate from the React app
- **Loop 5 depends on Loop 4** — uses contrast ratio utility from palettes.ts
- **Loop 6 depends on all previous** — final verification of everything
