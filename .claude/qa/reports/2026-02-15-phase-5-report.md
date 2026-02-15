# QA Report -- Phase 5: Instructor Admin Dashboard

**Date:** 2026-02-15T20:15:00Z
**Branch:** phase-5-instructor-admin
**PR:** #5
**Result:** PASS (22/22 tests passed)

---

## Test Results

### TC-001: Build passes with zero errors
**Status:** PASS
**Steps:** Run `npm run build` in the worktree root. Verify exit code 0 with no warnings or errors.
**Detail:** Vite build completed successfully -- 140 modules transformed, output produced at `dist/`.

### TC-002: TypeScript type check passes with zero errors
**Status:** PASS
**Steps:** Run `npx tsc --noEmit` in the worktree root. Verify exit code 0.
**Detail:** Clean type check, no diagnostics.

### TC-003: No `any` type in Phase 5 files
**Status:** PASS
**Steps:** Grep for `\bany\b` across all Phase 5 source files: `src/components/admin/`, `src/routes/admin/`, `src/hooks/useSessions.ts`, `src/hooks/useStudents.ts`, `src/lib/invite.ts`, `supabase/functions/invite/index.ts`.
**Detail:** Zero matches. All types are explicit. `Record<string, unknown>` and `Array<Record<string, unknown>>` used where dynamic shapes are needed (useStudents spec mapping), which is correct.

### TC-004: Functional components only (no class components)
**Status:** PASS
**Steps:** Grep for `class\s+\w+\s+extends\s+(React\.)?Component` in all Phase 5 files.
**Detail:** Zero matches. All components are functional.

### TC-005: Named exports for non-route files, default only for route pages
**Status:** PASS
**Steps:** Grep for `export default` across all Phase 5 files.
**Detail:** Only two `export default` found -- both in route pages: `src/routes/admin/sessions.tsx` (AdminSessionsPage) and `src/routes/admin/students.tsx` (AdminStudentsPage). All other Phase 5 files (`AdminShell.tsx`, `SpecViewer.tsx`, `UsageMetrics.tsx`, `useSessions.ts`, `useStudents.ts`, `invite.ts`) use named exports only.

### TC-006: British English in user-facing copy
**Status:** PASS
**Steps:** Grep for American English patterns (`color`, `organization`, `labor` without trailing `u`, `specialize`) in admin components and routes. Verify British variants used.
**Detail:** Zero American English matches. Confirmed British spelling: "authorisation" (invite Edge Function line 119), "Colour" in SpecViewer variable/prop names (`ColourSwatch`, `colour`).

### TC-007: Reuses existing UI primitives (Button, Input, Card, LoadingSpinner)
**Status:** PASS
**Steps:** Grep for imports from `@/components/ui/` across all admin components and route pages.
**Detail:** All five Phase 5 UI files import from the shared primitives. Button used in AdminShell, SpecViewer, sessions, students. Card used in SpecViewer, UsageMetrics, sessions, students. Input used in sessions. LoadingSpinner used in SpecViewer, sessions, students.

### TC-008: AdminShell has header, nav links (Sessions, Students), and sign out
**Status:** PASS
**Steps:** Read `src/components/admin/AdminShell.tsx`. Verify header title "BirthBuild Admin", nav items for Sessions (/admin/sessions) and Students (/admin/students), sign out button using `useAuth().signOut`, active link with green-700 border, `max-w-6xl mx-auto` content width, `min-h-screen flex-col bg-gray-50` layout.
**Detail:** All elements present. Header with title and sign-out Button (outline variant). Nav with `NAV_ITEMS` array containing Sessions and Students. Active link detection via `useLocation()` with `border-green-700 text-green-700` styling. `aria-current="page"` on active link. Content wrapper: `max-w-6xl mx-auto`, flex min-h-screen layout.

### TC-009: Sessions page -- create form with loading state
**Status:** PASS
**Steps:** Read `src/routes/admin/sessions.tsx`. Verify "Create Session" button toggles inline form. Form has session name Input (required), Create button with `loading={creating}`, Cancel button. Form `onSubmit` calls `handleCreate()`.
**Detail:** Create form shown via `showCreateForm` state toggle. Input has label "Session name", placeholder "e.g. Spring 2026 Workshop", `required` prop, `disabled={creating}`. Create button has `loading={creating}` and `disabled={!newSessionName.trim()}`. Cancel resets form.

### TC-010: Sessions page -- session cards with name, status badge, counts, date
**Status:** PASS
**Steps:** Read session card rendering in sessions.tsx. Verify each Card shows session name (h3), status badge (active=green, archived=gray), student count, live site count, created date.
**Detail:** All fields rendered. Status badge uses conditional classes: `bg-green-100 text-green-800` for active, `bg-gray-100 text-gray-600` for archived. Counts shown with correct singular/plural handling. Date formatted with `en-GB` locale (day month year).

### TC-011: Sessions page -- archive button and filter (Active/All)
**Status:** PASS
**Steps:** Verify Archive button on each active session (outline variant, with loading state). Verify Active/All filter toggle defaults to Active.
**Detail:** Archive button rendered conditionally (`session.status === "active"`), uses `loading={archivingId === session.id}`. Filter toggle with two buttons: Active (default) and All. Active filter state is `"active"`, applies `sessions.filter((s) => s.status === "active")`. Selected filter has `bg-green-700 text-white`.

### TC-012: Sessions page -- "View Students" link per session
**Status:** PASS
**Steps:** Verify each session card has a "View Students" link navigating to `/admin/students?session={id}`.
**Detail:** Link component renders `to={/admin/students?session=${session.id}}` with styled text and border.

### TC-013: Sessions page -- empty and loading states
**Status:** PASS
**Steps:** Verify LoadingSpinner shown when `loading` is true. Verify empty state message when no sessions.
**Detail:** Loading state renders LoadingSpinner with sr-only text "Loading sessions...". Empty state text varies by filter: "No active sessions..." for Active filter, "No sessions yet. Create your first workshop session." for All filter.

### TC-014: Students page -- table with Name/Email, Session, Status, Progress, Actions columns
**Status:** PASS
**Steps:** Read `src/routes/admin/students.tsx`. Verify HTML table with proper thead/tbody, all five columns present.
**Detail:** Semantic table with `<thead>` (bg-gray-50), five column headers (Name/Email, Session, Status, Progress, Actions). Name column shows `display_name` falling back to email. Session column maps session_id to name via `sessionNameMap`.

### TC-015: Students page -- status badges with correct colours
**Status:** PASS
**Steps:** Verify StatusBadge component renders correct styles for each SiteSpecStatus.
**Detail:** StatusBadge defined at top of students.tsx. Styles: Draft = `bg-gray-100 text-gray-700`, Building = `bg-yellow-100 text-yellow-800 animate-pulse`, Live = `bg-green-100 text-green-800`, Error = `bg-red-100 text-red-700`. "Not started" shown when no site_spec.

### TC-016: Students page -- progress bars with percentage
**Status:** PASS
**Steps:** Verify ProgressBar component renders a visual bar and percentage text.
**Detail:** ProgressBar shows a `h-2 w-24` track with dynamic width inner bar (`bg-green-600`). Percentage displayed as text (`{percent}%`). "Not started" shown when no site_spec.

### TC-017: Students page -- session filter via dropdown and URL params
**Status:** PASS
**Steps:** Verify session filter dropdown populated from `useSessions()`. Verify `useSearchParams` reads `?session=` param for initial filter. Verify filter changes update URL params.
**Detail:** `<select>` with id "session-filter" and associated label. Options include "All sessions" (empty value) plus all sessions from hook. `handleFilterChange` updates search params via `setSearchParams`. Initial value read from `searchParams.get("session")`.

### TC-018: Students page -- invite modal with email textarea, session selector, results, copy links
**Status:** PASS
**Steps:** Verify invite modal opens on "Invite Students" button click. Modal has session selector (active sessions only), email textarea, Send Invites button with loading state, results display with success/failure badges and copy magic link buttons.
**Detail:** Modal rendered with `role="dialog"`, `aria-modal="true"`, `aria-label="Invite students"`. Session selector filters to active sessions via `useMemo`. Email textarea with placeholder and max-50 note. Client-side email validation with `EMAIL_REGEX`. Results view shows count summary, per-email success/failure with colour-coded borders, "Copy magic link" button using `navigator.clipboard.writeText`. Done button closes modal and resets state.

### TC-019: SpecViewer -- read-only display of all spec sections
**Status:** PASS
**Steps:** Read `src/components/admin/SpecViewer.tsx`. Verify all sections: Business Details (business_name, doula_name, tagline, service_area), Design (palette with colour swatches, typography, style), Content (bio with expand/collapse, philosophy), Services (list with title/description/price), Testimonials (quotes with name/context), Contact (email, phone, booking_url, social links), Deployment (status badge, subdomain, deploy_url with link, "Open Live Site" button).
**Detail:** All seven sections present in Card components. Business Details uses definition list (`<dl>`). Design shows palette name with display names map, custom colour swatches via ColourSwatch component (renders visual swatch with `backgroundColor`). Content uses ExpandableText for bio and philosophy (collapse at 300 chars). Services rendered as list with title/description/price. Testimonials use `<blockquote>` with name and optional context. Contact shows all fields with external links. Deployment shows StatusBadge, subdomain as `{slug}.birthbuild.com`, deploy_url as link, plus "Open Live Site" Button.

### TC-020: SpecViewer -- slide-over panel with close button, loading/error states
**Status:** PASS
**Steps:** Verify SpecViewer renders as a fixed right panel (`fixed inset-y-0 right-0 max-w-lg`). Verify Close button, LoadingSpinner, and error message.
**Detail:** Panel uses `fixed inset-y-0 right-0 z-50 w-full max-w-lg` with `overflow-y-auto border-l shadow-xl`. Sticky header with "Site Specification" title and Close button. Loading state shows LoadingSpinner with sr-only text. Error state shows generic message "Failed to load site specification." in a red alert. Mounted/unmounted guard prevents state updates after unmount.

### TC-021: UsageMetrics -- four metric cards at top of sessions page
**Status:** PASS
**Steps:** Read `src/components/admin/UsageMetrics.tsx`. Verify four MetricCards (Students, Sessions, Live Sites, Draft Sites) in a 4-column grid. Verify counts fetched via Supabase with `{ count: "exact", head: true }`. Verify skeleton loading state. Verify integration in sessions page.
**Detail:** Four parallel Supabase queries: profiles (role=student, tenant_id), sessions (tenant_id), site_specs (status=live, tenant_id), site_specs (status=draft, tenant_id). All use `{ count: "exact", head: true }` for efficient counting. Grid layout: `grid-cols-2 gap-4 sm:grid-cols-4`. Each MetricCard shows shimmer placeholders (animate-pulse) while loading, then `text-3xl font-bold` number with label below. Component integrated in sessions.tsx: `{profile?.tenant_id && <UsageMetrics tenantId={profile.tenant_id} />}` above session list.

### TC-022: Security -- no service role key in client code, generic errors, RLS-scoped queries
**Status:** PASS
**Steps:** (a) Grep for `service.role` and `SUPABASE_SERVICE_ROLE_KEY` in `src/`. (b) Verify all user-facing error messages are generic. (c) Verify all client-side queries use anon client from `src/lib/supabase.ts`. (d) Verify invite Edge Function uses service client only server-side. (e) Verify no `dangerouslySetInnerHTML`.
**Detail:**
- (a) Zero matches for service role key in client code.
- (b) Error messages confirmed generic: "Failed to load sessions. Please try again.", "Failed to create session. Please try again.", "Failed to archive session. Please try again.", "Failed to load students. Please try again.", "Failed to load site specification.", "Something went wrong. Please try again." No Supabase error details leak to UI.
- (c) All hooks and components import `supabase` from `@/lib/supabase.ts` which creates client with `VITE_SUPABASE_ANON_KEY`.
- (d) Invite Edge Function correctly uses `SUPABASE_SERVICE_ROLE_KEY` only on the Deno server side via `Deno.env.get()`. JWT auth validates the caller. Role check, tenant ownership check, session status check all present. UUID validation via `UUID_REGEX`. Email validation. Rate limiting (100/hr/instructor, 50/request max).
- (e) Zero matches for `dangerouslySetInnerHTML` in admin components.

---

## Edge Function Deep Dive: `supabase/functions/invite/index.ts`

| Check | Result |
|-------|--------|
| CORS handling (same origins as chat/build) | PASS -- identical `ALLOWED_ORIGINS` array and `corsHeaders` function |
| OPTIONS preflight handling | PASS -- returns `"ok"` with CORS headers |
| JWT auth via Authorization header | PASS -- uses `userClient.auth.getUser()` |
| Instructor role verification | PASS -- service client profile lookup, checks `role !== "instructor"` |
| Session ownership validation (tenant match) | PASS -- `session.tenant_id !== tenantId` check |
| Session status check (active only) | PASS -- `session.status !== "active"` returns 400 |
| UUID validation on session_id | PASS -- `UUID_REGEX.test(body.session_id)` |
| Email validation per address | PASS -- `EMAIL_REGEX.test(email)` |
| Max 50 emails per request | PASS -- `body.emails.length > MAX_EMAILS_PER_REQUEST` returns 400 |
| Rate limiting (100/hr/instructor) | PASS -- in-memory `rateLimitMap` with 1-hour window |
| New user creation via admin API | PASS -- `serviceClient.auth.admin.createUser()` |
| Magic link generation | PASS -- `serviceClient.auth.admin.generateLink({ type: "magiclink" })` |
| Profile creation for new students | PASS -- inserts with role, tenant_id, session_id |
| Existing user handling | PASS -- updates session_id if user already exists |
| Error per email (not batch fail) | PASS -- each email processed individually with try/catch |
| Generic errors to client, detailed server logs | PASS -- `console.error` for details, generic messages in response |

---

## Architecture Compliance Summary

| Rule | Status |
|------|--------|
| No `any` type | PASS |
| Functional components only | PASS |
| Named exports (default only for route pages) | PASS |
| British English in user-facing copy | PASS |
| Reuses existing UI primitives | PASS |
| RLS-scoped queries (anon client in client code) | PASS |
| Generic error messages to user | PASS |
| No `dangerouslySetInnerHTML` | PASS |
| Path alias `@/` for imports | PASS |
| Green primary colour (green-700) | PASS |
| Content width `max-w-6xl mx-auto` | PASS |
| No service role key in client code | PASS |

---

## New Types Added to `src/types/database.ts`

| Type | Fields | Status |
|------|--------|--------|
| `SessionWithCounts` | Extends `Session` with `student_count: number`, `live_site_count: number` | PASS |
| `StudentOverview` | `id`, `email`, `display_name`, `session_id`, `site_spec: { id, status, business_name, doula_name, deploy_url, completion_percent } \| null` | PASS |

---

## Summary

- **Passed:** 22
- **Failed:** 0
- **Total:** 22

All acceptance criteria met. Build and type check clean. Architecture rules followed. Security model sound -- no service role key exposure, generic error messages, RLS-scoped client queries, full validation in the invite Edge Function.
