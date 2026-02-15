# Implementation Brief

**Task:** Instructor Admin Dashboard
**Phase:** 5
**Branch:** `phase-5-instructor-admin`
**PR Title:** `Phase 5: Instructor Admin`
**Priority:** P0
**Created:** 2026-02-15T19:35:00Z
**Created by:** Coordinator

---

## Summary

Build the instructor admin dashboard with session CRUD, bulk student invite flow, student overview table, read-only spec viewer, and usage metrics. Replace the two admin route stubs at `/admin/sessions` and `/admin/students` with full functionality. Create one new Edge Function (`invite`) for bulk magic link generation.

## Architecture Rules (MUST follow)

1. No `any` type — TypeScript strict mode
2. Functional components only — no class components
3. Named exports for all non-route files; `export default` only for route pages
4. British English in all user-facing copy
5. Reuse existing UI primitives: Button, Input, Card, LoadingSpinner from `src/components/ui/`
6. RLS-scoped queries — use anon Supabase client, never bypass RLS from client
7. Generic errors to user — no Supabase error details in UI
8. No `dangerouslySetInnerHTML`
9. Path alias: `@/` for `src/` imports
10. Green primary colour: `green-700` for primary actions
11. Content width: `max-w-6xl mx-auto` for admin pages (wider than student dashboard)

---

## Implementation Steps

### Loop 1: Admin Shell + Session CRUD Hook

**Create `src/components/admin/AdminShell.tsx`:**
- Layout shell for admin pages
- Header: "BirthBuild Admin" title, nav links (Sessions, Students), sign out button
- Active nav link: green bottom border (same pattern as TabNav)
- Uses `useAuth()` for sign out
- `children` prop for page content
- `max-w-6xl mx-auto` content width
- Full-height flex layout: `min-h-screen flex-col bg-gray-50`

**Create `src/hooks/useSessions.ts`:**
- `useSessions()` → `{ sessions, loading, error, createSession, archiveSession }`
- Fetch sessions for instructor's tenant: `supabase.from("sessions").select("*").eq("tenant_id", profile.tenant_id).order("created_at", { ascending: false })`
- `createSession(name: string)` → insert with tenant_id from profile
- `archiveSession(id: string)` → update status to "archived"
- Fetch student counts per session via separate query or aggregate

**Modify `src/types/database.ts`:**
- Add `SessionWithCounts` interface extending `Session` with `student_count: number` and `live_site_count: number`

**Verify:** `npm run build && npx tsc --noEmit`

### Loop 2: Sessions Page

**Modify `src/routes/admin/sessions.tsx`:**
- Replace stub with full sessions management page
- Wrap content in `AdminShell`
- Session list: Card per session showing name, status badge (active/archived), student count, live count, date
- "Create Session" button at top → opens inline form or modal
- Create form: session name input (required) + "Create" button with loading state
- "Archive" button on each active session (outline variant)
- Filter: "Active" / "All" toggle (default: Active)
- "View Students" link per session → navigates to `/admin/students?session={id}`
- Empty state: "No sessions yet. Create your first workshop session."
- Loading spinner while fetching

**Verify:** `npm run build && npx tsc --noEmit`

### Loop 3: Student Data Hook + Invite Edge Function

**Create `src/hooks/useStudents.ts`:**
- `useStudents(sessionId?: string)` → `{ students, loading, error, refetch }`
- Fetch profiles with `role = "student"` in instructor's tenant
- Filter by session_id if provided
- Join with site_specs to get: status, business_name, doula_name, deploy_url
- Calculate completion_percent client-side from filled required fields
- Return `StudentOverview[]`:
  ```typescript
  export interface StudentOverview {
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

**Create `supabase/functions/invite/index.ts`:**
- POST endpoint: `{ emails: string[], session_id: string }`
- CORS handling: same ALLOWED_ORIGINS as chat/build
- Auth: extract JWT, verify user via `userClient.auth.getUser()`
- Verify caller role is "instructor" via profile lookup (service role)
- Verify session_id is valid UUID (UUID_REGEX)
- Verify session belongs to caller's tenant (service role query)
- Verify session status is "active" (not archived)
- Max 50 emails per request
- Rate limit: 100 invites per hour per instructor
- For each email:
  - Validate email format
  - Check if user already exists (if so, just generate new magic link)
  - If new: create user via `serviceClient.auth.admin.createUser({ email, email_confirm: true })`
  - Create profile: `{ id: user.id, email, role: "student", tenant_id, session_id }`
  - Generate magic link: `serviceClient.auth.admin.generateLink({ type: "magiclink", email })`
  - Collect result: `{ email, success: true, magic_link }` or `{ email, success: false, error: "..." }`
- Return: `{ results: Array<{ email: string, success: boolean, magic_link?: string, error?: string }> }`

**Create `src/lib/invite.ts`:**
- `inviteStudents(emails: string[], sessionId: string): Promise<InviteResult[]>`
- Calls invite Edge Function with JWT from session
- Returns typed results

**Verify:** `npm run build && npx tsc --noEmit`

### Loop 4: Students Page + Invite Flow

**Modify `src/routes/admin/students.tsx`:**
- Replace stub with full student overview page
- Wrap content in `AdminShell`
- Session filter dropdown at top (populated from `useSessions`)
- Read `?session=` URL param for initial filter via `useSearchParams`
- Student table:
  - Columns: Name/Email, Session, Status, Progress, Actions
  - Status badges: Draft (gray bg), Building (yellow bg + pulse), Live (green bg), Error (red bg)
  - Progress: percentage bar (0-100%) or "Not started" if no spec
  - Actions: "View Spec" button, "View Site" link (if deploy_url)
- "Invite Students" button at top → opens invite modal
- Invite modal:
  - Textarea for emails (one per line or comma-separated)
  - Session selector dropdown
  - "Send Invites" button with loading state
  - Results: list of emails with success/failure + copy magic link buttons
  - Email validation before sending (reject obviously invalid)
- Empty state: "No students yet. Invite students from the Sessions page."
- Loading spinner while fetching

**Verify:** `npm run build && npx tsc --noEmit`

### Loop 5: Read-Only Spec Viewer

**Create `src/components/admin/SpecViewer.tsx`:**
- Props: `specId: string`, `onClose: () => void`
- Fetches full site_spec by ID via anon client (RLS permits instructor read)
- Display sections in Card components:
  - Business Details: business_name, doula_name, tagline, service_area
  - Design: palette (render colour swatches), typography, style
  - Content: bio (with expand/collapse if long), philosophy
  - Services: list with title, description, price per item
  - Testimonials: list of quotes with name and context
  - Contact: email, phone, booking_url, social links
  - Deployment: subdomain, status badge, deploy_url with link
- "Open Live Site" button if deploy_url exists
- "Close" button at top
- Loading and error states

**Modify `src/routes/admin/students.tsx`:**
- Clicking "View Spec" on a row sets a `selectedSpecId` state
- Render SpecViewer as a slide-over panel (fixed right, max-w-lg) or expandable section below the table
- Close handler clears selectedSpecId

**Verify:** `npm run build && npx tsc --noEmit`

### Loop 6: Usage Metrics + Final Polish

**Create `src/components/admin/UsageMetrics.tsx`:**
- Props: `tenantId: string`
- Fetches counts via Supabase:
  - Total students: count of profiles with role="student" and tenant_id
  - Total sessions: count of sessions with tenant_id
  - Live sites: count of site_specs with status="live" and tenant_id
  - Draft sites: count of site_specs with status="draft" and tenant_id
- Displays as a grid of metric cards (4 cards in a row):
  ```
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Students │ │ Sessions │ │   Live   │ │  Draft   │
  │    12    │ │     3    │ │ Sites: 8 │ │ Sites: 4 │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  ```
- Each card uses Card component with centered number + label
- Loading state: skeleton/shimmer placeholders

**Modify `src/routes/admin/sessions.tsx`:**
- Add UsageMetrics at top of page, above session list

**Final verification:**
- All admin pages have loading states
- All admin pages have empty states
- Session filter persists via URL params
- Navigation between sessions and students works
- Run `npm run build && npx tsc --noEmit` — must pass with 0 errors

---

## Files Summary

### Files to Modify
- `src/routes/admin/sessions.tsx` — Replace stub with full sessions page
- `src/routes/admin/students.tsx` — Replace stub with full students page
- `src/types/database.ts` — Add SessionWithCounts, StudentOverview types

### Files to Create
- `src/components/admin/AdminShell.tsx` — Admin layout shell
- `src/components/admin/SpecViewer.tsx` — Read-only spec display
- `src/components/admin/UsageMetrics.tsx` — Usage metric cards
- `src/hooks/useSessions.ts` — Sessions CRUD hook
- `src/hooks/useStudents.ts` — Students listing hook
- `src/lib/invite.ts` — Invite API client
- `supabase/functions/invite/index.ts` — Bulk invite Edge Function

---

## Acceptance Criteria

- [ ] Instructor can view, create, and archive workshop sessions
- [ ] Session list shows student count and live site count per session
- [ ] Instructor can paste student emails and generate magic links
- [ ] Invite results show success/failure per email with copyable magic links
- [ ] Student table shows name, email, status, progress, and actions
- [ ] Students filterable by session via dropdown
- [ ] Instructor can view any student's site_spec in read-only mode
- [ ] Usage metrics display correct counts at top of sessions page
- [ ] All admin pages wrapped in AdminShell with nav and sign out
- [ ] RLS prevents instructor from modifying student data (read-only)
- [ ] Build passes: `npm run build && npx tsc --noEmit` with 0 errors

---

## Security Notes

1. **Invite Edge Function**: Must use service role key for `auth.admin.*` operations. Verify caller is instructor role before proceeding. Validate session belongs to caller's tenant.
2. **UUID validation**: Validate session_id format before database queries (same UUID_REGEX pattern as build Edge Function).
3. **Email validation**: Basic format check on all emails before processing. Reject empty/malformed.
4. **Rate limiting**: 50 emails max per invite request. 100 invites per hour per instructor (in-memory rate limiter).
5. **Magic link security**: Links are returned to the instructor (trusted party) for distribution. Links are single-use by Supabase default.
6. **No write access**: Instructor can only READ student specs. SpecViewer is display-only.
7. **CORS**: Same allowed origins as other Edge Functions.
8. **Error messages**: Generic errors to client, detailed logging server-side.

---

## Context

### Existing patterns to follow
- `src/components/dashboard/DashboardShell.tsx` — Layout pattern (header + tabs + content)
- `src/hooks/useSiteSpec.ts` — Supabase CRUD hook pattern (fetch + state + error handling)
- `supabase/functions/build/index.ts` — Edge Function pattern (CORS, JWT auth, rate limiting, validation, service role)
- `src/components/ui/Card.tsx` — Card styling: `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`
- `src/components/ui/Button.tsx` — Button variants: primary (green-700), secondary (gray), outline (border)

### Key function locations
- Auth hook: `src/hooks/useAuth.ts` — `useAuth()` → `{ user, profile, role, signOut }`
- Supabase client: `src/lib/supabase.ts` — `supabase` export
- DB types: `src/types/database.ts` — `Tenant`, `Session`, `Profile`
- Site spec types: `src/types/site-spec.ts` — `SiteSpec`, `SiteSpecStatus`
- Existing RLS: `supabase/migrations/001_initial_schema.sql` — `sessions_instructor_all`, `profiles_instructor_read`, `site_specs_instructor_read`

### Build command
```bash
npm run build && npx tsc --noEmit
```
