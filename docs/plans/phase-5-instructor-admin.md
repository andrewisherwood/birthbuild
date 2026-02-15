# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T19:35:00Z
**Total Phases:** 6

Phase 5 of 6 — Instructor Admin Dashboard

---

# Detailed Plan: Phase 5 — Instructor Admin

**Date:** 2026-02-15
**Status:** Approved
**Branch:** `phase-5-instructor-admin`

## Overview

Build the instructor admin dashboard with session CRUD, bulk student invite flow (magic link generation), student overview table with progress/status, read-only spec viewer, and usage metrics. This phase replaces the two admin route stubs (`/admin/sessions`, `/admin/students`) with full functionality.

The instructor dashboard follows the same layout patterns as the student dashboard (DashboardShell, Card, Button, Input) but with instructor-specific views and data fetching scoped to the instructor's tenant.

**Key architectural decisions:**
- All queries use the anon Supabase client (RLS enforces tenant scoping via existing policies)
- No new Edge Functions needed — all data accessible via existing RLS policies
- Student invite uses Supabase Admin API via a lightweight Edge Function (to create users and send magic links programmatically)
- Session-based filtering via URL params or dropdown select
- Read-only spec viewer reuses site-spec types but renders all fields as display-only

## Pre-existing Code

| File | Purpose |
|------|---------|
| `src/routes/admin/sessions.tsx` | Stub — "Sessions" placeholder (11 lines) |
| `src/routes/admin/students.tsx` | Stub — "Students" placeholder (11 lines) |
| `src/components/auth/RoleGate.tsx` | Role check — already wraps admin routes |
| `src/components/auth/ProtectedRoute.tsx` | Auth check — already wraps admin routes |
| `src/App.tsx` | Routes defined at `/admin/sessions` and `/admin/students` with instructor RoleGate |
| `src/hooks/useAuth.ts` | Exposes `profile.tenant_id` and `role` |
| `src/types/database.ts` | `Tenant`, `Session`, `Profile`, `Photo` types |
| `src/types/site-spec.ts` | `SiteSpec`, `SiteSpecStatus` types |
| `src/components/ui/*` | Button, Input, Card, LoadingSpinner |
| `supabase/migrations/001_initial_schema.sql` | sessions, profiles, site_specs tables with instructor RLS |

**Existing RLS policies that support Phase 5:**
- `sessions_instructor_all`: Instructor can CRUD sessions in their tenant
- `profiles_instructor_read`: Instructor can read profiles in their tenant
- `site_specs_instructor_read`: Instructor can read specs in their tenant
- `photos_instructor_read`: Instructor can read photos for specs in their tenant

## Architecture Rules (MUST follow)

1. **No `any` type** — TypeScript strict mode enforced
2. **Functional components only** — no class components
3. **Named exports** for all non-route files; `export default` only for route pages
4. **British English** in all user-facing copy ("Colour", "Organisation")
5. **`escapeHtml` not needed** — React handles XSS in JSX automatically
6. **Reuse existing UI primitives** — Button, Input, Card, LoadingSpinner
7. **RLS-scoped queries** — use anon client, never bypass RLS from client
8. **Generic errors to user** — no Supabase error details in UI
9. **No `dangerouslySetInnerHTML`** — render via React components
10. **Path alias** — use `@/` for `src/` imports
11. **Green primary colour** — `green-700` for primary actions, `gray-*` for text/borders
12. **`max-w-5xl mx-auto`** — content width constraint

## Loops

### Loop 1: Admin Shell + Session CRUD Hooks

**Files to create:**
- `src/components/admin/AdminShell.tsx` — Layout shell for admin pages (header with nav, content area)
- `src/hooks/useSessions.ts` — Hook for sessions CRUD (list, create, archive)

**Files to modify:**
- `src/types/database.ts` — Add `SessionWithCounts` type (session + student_count + live_count)

**Details:**

`AdminShell.tsx`:
- Header with "BirthBuild Admin" title, nav links to Sessions and Students
- Active link highlighted with green bottom border (same pattern as TabNav)
- Sign out button in header (reuse `useAuth().signOut`)
- `children` prop for page content
- `max-w-6xl mx-auto` content width (slightly wider than student dashboard for tables)

`useSessions.ts`:
- `useSessions()` returns `{ sessions, loading, error, createSession, archiveSession }`
- Fetches sessions for instructor's tenant: `supabase.from("sessions").select("*").eq("tenant_id", profile.tenant_id).order("created_at", { ascending: false })`
- `createSession(name: string)` — inserts new session with tenant_id
- `archiveSession(id: string)` — updates status to "archived"
- Returns `Session[]` from database.ts types

`SessionWithCounts` type:
- Extends `Session` with `student_count: number` and `live_site_count: number`
- These counts come from a joined query or separate count queries

**Acceptance criteria:**
- [ ] AdminShell renders header with nav links and sign out
- [ ] useSessions hook fetches, creates, and archives sessions
- [ ] TypeScript compiles with no errors

---

### Loop 2: Sessions Page

**Files to modify:**
- `src/routes/admin/sessions.tsx` — Full implementation replacing stub

**Details:**

Replace the stub with a complete sessions management page:

1. **Session list view** (default):
   - Uses `useSessions()` hook
   - Card per session showing: name, status badge (active/archived/completed), student count, live sites count, created date
   - "Create Session" button (primary) at top
   - "Archive" button (outline) on each active session card
   - Filter toggle: "Active" / "All" sessions (default: Active)
   - Empty state: "No sessions yet. Create your first workshop session."

2. **Create session modal/form**:
   - Input: session name (required)
   - Button: "Create Session" (primary, with loading state)
   - On success: session appears in list, form closes
   - On error: inline error message

3. **Session card layout**:
   ```
   ┌────────────────────────────────────────┐
   │ Workshop Session Name          Active  │
   │ 12 students · 8 live sites             │
   │ Created 15 Feb 2026                    │
   │                                        │
   │ [View Students]  [Archive]             │
   └────────────────────────────────────────┘
   ```
   - "View Students" navigates to `/admin/students?session={id}`

**Acceptance criteria:**
- [ ] Sessions page lists all sessions for the instructor's tenant
- [ ] Create session form works and adds session to list
- [ ] Archive button updates session status
- [ ] "View Students" link navigates to students page filtered by session
- [ ] Empty state shown when no sessions exist
- [ ] Loading spinner shown while fetching

---

### Loop 3: Student Data Hooks + Invite Edge Function

**Files to create:**
- `src/hooks/useStudents.ts` — Hook for student listing and filtering
- `supabase/functions/invite/index.ts` — Edge Function for bulk student invite
- `src/lib/invite.ts` — Client-side function to call invite Edge Function

**Details:**

`useStudents.ts`:
- `useStudents(sessionId?: string)` returns `{ students, loading, error }`
- Fetches profiles with `role = 'student'` in instructor's tenant
- Optionally filtered by session_id
- Joins with site_specs to get status, business_name, deploy_url, completion %
- Returns `StudentOverview[]` type:
  ```typescript
  interface StudentOverview {
    id: string;
    email: string;
    display_name: string | null;
    session_id: string | null;
    site_spec: {
      id: string;
      status: SiteSpecStatus;
      business_name: string | null;
      doula_name: string | null;
      deploy_url: string | null;
      completion_percent: number;
    } | null;
  }
  ```
- Completion percent calculated client-side from filled fields

`supabase/functions/invite/index.ts`:
- POST endpoint accepting `{ emails: string[], session_id: string }`
- JWT auth — verifies caller is instructor
- Validates session belongs to instructor's tenant
- For each email:
  - Creates user via Supabase Admin Auth API (`supabase.auth.admin.createUser`)
  - Creates profile with role="student", tenant_id, session_id
  - Generates magic link via `supabase.auth.admin.generateLink({ type: "magiclink", email })`
- Returns `{ results: Array<{ email, success, magic_link?, error? }> }`
- Rate limit: 50 invites per call (prevent abuse)
- CORS: same pattern as chat/build Edge Functions

`src/lib/invite.ts`:
- `inviteStudents(emails: string[], sessionId: string)` — calls the Edge Function
- Returns typed result

**Acceptance criteria:**
- [ ] useStudents hook fetches student profiles with site_spec join
- [ ] Session filtering works via sessionId parameter
- [ ] Invite Edge Function creates users and generates magic links
- [ ] Invite validates instructor role and session ownership
- [ ] Rate limit prevents more than 50 emails per call
- [ ] TypeScript compiles with no errors

---

### Loop 4: Students Page + Invite Flow

**Files to modify:**
- `src/routes/admin/students.tsx` — Full implementation replacing stub

**Details:**

Replace the stub with a complete student overview page:

1. **Student table view**:
   - Session filter dropdown at top (populated from useSessions)
   - Reads `?session=` URL param for initial filter
   - Table columns: Name/Email, Session, Site Status, Completion %, Actions
   - Status badges: Draft (gray), Building (yellow/pulse), Live (green), Error (red)
   - Completion shown as progress bar (0-100%)
   - Actions: "View Spec" button → navigates to read-only spec view (inline or modal)
   - If deploy_url exists: "View Site" link (opens in new tab)
   - Empty state: "No students yet. Invite students from the Sessions page."

2. **Invite modal** (accessible from sessions page and students page):
   - Textarea: paste emails (one per line or comma-separated)
   - Session selector dropdown
   - "Send Invites" button (primary, with loading state)
   - Results display: list of emails with success/failure status
   - Copy magic links to clipboard for manual distribution
   - Email validation before sending (basic format check)

3. **Table layout** (responsive):
   ```
   | Name/Email         | Session    | Status  | Progress | Actions      |
   |--------------------|------------|---------|----------|--------------|
   | Jane Smith         | Workshop 1 | ● Live  | ████ 85% | View Spec ↗  |
   | jane@example.com   |            |         |          |              |
   |--------------------|------------|---------|----------|--------------|
   | Sarah Jones        | Workshop 1 | ○ Draft | ██   40% | View Spec    |
   | sarah@example.com  |            |         |          |              |
   ```

**Acceptance criteria:**
- [ ] Students page shows table of all students in instructor's tenant
- [ ] Session filter dropdown filters students by session
- [ ] Status badges show correct colours and labels
- [ ] Completion percentage shown as progress bar
- [ ] Invite modal sends emails and displays results with magic links
- [ ] "View Spec" button opens read-only spec viewer
- [ ] "View Site" link opens deployed site in new tab
- [ ] Empty state shown when no students exist

---

### Loop 5: Read-Only Spec Viewer

**Files to create:**
- `src/components/admin/SpecViewer.tsx` — Read-only display of a student's site_spec

**Files to modify:**
- `src/routes/admin/students.tsx` — Integrate SpecViewer as expandable row or slide-over panel

**Details:**

`SpecViewer.tsx`:
- Accepts `specId: string` prop
- Fetches full site_spec by ID (instructor can read via RLS)
- Displays all sections in read-only format:
  - Business Details: business_name, doula_name, tagline, service_area
  - Design: palette (colour swatches), typography, style
  - Content: bio, philosophy (truncated with "show more")
  - Services: list of service cards (title, description, price)
  - Testimonials: list of quotes
  - Contact: email, phone, booking_url, social links
  - SEO: primary_keyword, pages enabled
  - Deployment: subdomain, status, deploy_url
- Card-based layout, grouped by section
- "Open Live Site" button if deploy_url exists
- Loading and error states

**Integration in students.tsx:**
- Clicking "View Spec" on a student row expands a detail panel below the row (or opens a slide-over)
- Panel contains SpecViewer component
- Close button to collapse

**Acceptance criteria:**
- [ ] SpecViewer renders all site_spec fields in read-only format
- [ ] Palette shown as colour swatches
- [ ] Services and testimonials shown as lists
- [ ] Loading spinner while fetching spec
- [ ] Integrated into students page with expand/collapse

---

### Loop 6: Usage Metrics + Final Polish

**Files to create:**
- `src/components/admin/UsageMetrics.tsx` — Usage stats display

**Files to modify:**
- `src/routes/admin/sessions.tsx` — Add metrics summary at top

**Details:**

`UsageMetrics.tsx`:
- Accepts `tenantId: string` prop
- Queries aggregate data:
  - Total students (count of profiles with role=student in tenant)
  - Total sessions (count of sessions in tenant)
  - Active sites (count of site_specs with status="live" in tenant)
  - Sites building (count with status="building")
  - Draft specs (count with status="draft")
- Displays as a row of metric cards:
  ```
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Students │ │ Sessions │ │   Live   │ │  Draft   │
  │    12    │ │     3    │ │ Sites: 8 │ │ Sites: 4 │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  ```
- Note: Claude API token usage tracking is deferred (requires server-side logging not yet implemented). Display "Coming soon" placeholder for this metric.

**Integration in sessions.tsx:**
- UsageMetrics rendered at top of sessions page, above session list

**Final polish:**
- Verify all admin pages work with loading states
- Verify empty states for zero sessions, zero students
- Verify session filter persists via URL params
- Verify navigation between sessions and students pages
- Run `npm run build && npx tsc --noEmit`

**Acceptance criteria:**
- [ ] Usage metrics display correct counts
- [ ] Metrics update after creating sessions or inviting students
- [ ] All admin pages have proper loading and empty states
- [ ] Navigation between admin pages works smoothly
- [ ] Build and type check pass with no errors

---

## Security Considerations

1. **Invite Edge Function auth**: Must verify caller is an instructor (check profile.role via service role), not just authenticated. Validate session_id belongs to caller's tenant before associating students.

2. **Magic link generation**: Use `supabase.auth.admin.generateLink` which requires the service role key. Never expose service role key to client. The Edge Function returns magic links to the instructor for distribution — the instructor is trusted to distribute them.

3. **RLS enforcement**: All client-side queries use the anon key. Existing RLS policies already scope data to the instructor's tenant. No new RLS policies needed for read operations.

4. **Input validation on invite**: Validate email format, limit batch size (max 50), validate session_id as UUID, prevent duplicate invites (check if user already exists).

5. **No write access to student data**: Instructor can only READ student specs via RLS. The SpecViewer is display-only by design and by RLS policy.

6. **CORS on invite Edge Function**: Same allowed origins as chat/build functions.

7. **Rate limiting on invite**: Prevent abuse — max 50 emails per request, in-memory rate limit per instructor.

## Edge Cases

1. **Student already exists**: If an email is already registered, the invite should return a success with a note that a new magic link was generated (not create a duplicate user).
2. **Session archived**: Instructor should not be able to invite students to an archived session. Validate session status in the Edge Function.
3. **Zero students in session**: Show meaningful empty state with CTA to invite students.
4. **Student with no site_spec**: Show "Not started" instead of completion percentage.
5. **Large number of students**: Table should handle 50+ rows without performance issues. Consider pagination if > 100 students.
6. **Concurrent session creation**: Two rapid clicks shouldn't create duplicate sessions. Disable button during creation.

## Sequencing Notes

- **Loop 1 must complete first** — AdminShell and hooks are used by all subsequent loops
- **Loop 2 depends on Loop 1** — Sessions page uses useSessions hook
- **Loop 3 can partially overlap with Loop 2** — useStudents hook is independent, but invite Edge Function needs testing
- **Loop 4 depends on Loops 2 + 3** — Students page uses both hooks and the invite function
- **Loop 5 depends on Loop 4** — SpecViewer integrates into the students page
- **Loop 6 depends on all previous** — metrics aggregate data from all features
