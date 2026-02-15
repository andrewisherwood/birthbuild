# QA Report -- Phase 1: Foundation & Auth

**Date:** 2026-02-15T17:35:00Z
**Branch:** phase-1-foundation-auth
**PR:** #1
**Result:** PASS (22/22 checks passed, 3 advisory notes)

---

## Build Verification

### BV-001: npm install
**Status:** PASS
**Detail:** `npm install` completed with 0 vulnerabilities. 155 packages installed.

### BV-002: TypeScript compilation
**Status:** PASS
**Detail:** `npx tsc --noEmit` passed with zero errors, zero warnings.

### BV-003: Production build
**Status:** PASS
**Detail:** `npm run build` (tsc -b && vite build) completed successfully. Output: dist/index.html (0.66 kB), dist/assets/index.css (16.28 kB), dist/assets/index.js (359.98 kB). Built in 2.32s.

---

## TypeScript Strict Mode Compliance

### TS-001: Strict mode enabled
**Status:** PASS
**Detail:** tsconfig.json has `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`, `"noUncheckedIndexedAccess": true`, `"forceConsistentCasingInFileNames": true`. This exceeds the minimum requirements.

### TS-002: No `any` types
**Status:** PASS
**Detail:** Searched all .ts and .tsx files in src/ for the `any` keyword. Zero occurrences found.

### TS-003: Path alias configured
**Status:** PASS
**Detail:** `@/*` alias resolves to `src/*` in both tsconfig.json (paths) and vite.config.ts (resolve.alias).

---

## Project Structure

### PS-001: All required files created
**Status:** PASS
**Detail:** All 27 files specified in the brief are present:
- Root config: package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, postcss.config.js, index.html
- Source: main.tsx, App.tsx, vite-env.d.ts, globals.css, 6 route files, supabase.ts, useAuth.ts, useSiteSpec.ts, database.ts, site-spec.ts, ProtectedRoute.tsx, RoleGate.tsx, Button.tsx, Input.tsx, Card.tsx, LoadingSpinner.tsx
- Public: manifest.json
- Supabase: config.toml, 001_initial_schema.sql, seed.sql

### PS-002: Folder structure matches CLAUDE.md
**Status:** PASS
**Detail:** src/routes/, src/components/ui/, src/components/auth/, src/hooks/, src/lib/, src/types/, src/styles/, supabase/migrations/, public/ all match the prescribed structure.

---

## Routing

### RT-001: All 6 routes configured
**Status:** PASS
**Detail:** App.tsx defines routes for /, /chat, /dashboard, /preview, /admin/sessions, /admin/students.

### RT-002: 404 catch-all route
**Status:** PASS
**Detail:** `<Route path="*" element={<NotFoundPage />} />` renders a 404 page for unknown paths.

### RT-003: Protected routes wrapped correctly
**Status:** PASS
**Detail:** /chat, /dashboard, /preview wrapped with ProtectedRoute. /admin/sessions and /admin/students wrapped with ProtectedRoute + RoleGate(role="instructor"). / is public (login page).

---

## Supabase Schema

### DB-001: All 5 tables created
**Status:** PASS
**Detail:** 001_initial_schema.sql creates tenants, sessions, profiles, site_specs, photos with correct column definitions matching SCOPING.md.

### DB-002: RLS enabled on all tables
**Status:** PASS
**Detail:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` present for all 5 tables: tenants (line 19), sessions (line 48), profiles (line 87), site_specs (line 165), photos (line 195).

### DB-003: RLS policies enforce isolation
**Status:** PASS
**Detail:** 10 RLS policies implemented:
- tenants: owner_all (CRUD for owner), members_read (SELECT for tenant members)
- sessions: instructor_all (CRUD for tenant owner), student_read (SELECT for assigned student)
- profiles: own_all (CRUD for own profile), instructor_read (SELECT for tenant members)
- site_specs: student_all (CRUD for own specs), instructor_read (SELECT for tenant specs)
- photos: student_all (CRUD for own spec photos), instructor_read (SELECT for tenant spec photos)
All policies correctly use `auth.uid()` for access control.

### DB-004: updated_at auto-update trigger
**Status:** PASS
**Detail:** `handle_updated_at()` trigger function created with SECURITY DEFINER. Triggers attached to tenants, sessions, profiles, site_specs (all tables that have updated_at).

### DB-005: Seed data valid
**Status:** PASS
**Detail:** seed.sql creates 2 auth.users (instructor + student), 1 tenant, 1 session, 2 profiles, 1 site_spec. All foreign key references are consistent.

---

## Authentication

### AU-001: Magic link implementation
**Status:** PASS
**Detail:** useAuth.ts implements `signInWithMagicLink(email)` using `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })`. Returns `{ error: string | null }`.

### AU-002: Auth state management
**Status:** PASS
**Detail:** useAuth.ts subscribes to `supabase.auth.onAuthStateChange()`, fetches profile after auth resolves, tracks user/session/profile/role/loading state. Cleanup unsubscribes on unmount. Mounted flag prevents state updates after unmount.

### AU-003: Login form UI
**Status:** PASS
**Detail:** src/routes/index.tsx has email input with label ("Email address"), htmlFor/id association, submit button ("Send magic link"), loading state with spinner, error display with role="alert", and success confirmation message.

---

## useSiteSpec Hook

### SS-001: Optimistic update pattern
**Status:** PASS
**Detail:** useSiteSpec.ts implements the optimistic update pattern correctly: saves previous state, applies optimistic change to local state immediately, syncs to Supabase, rolls back to previous state on error.

### SS-002: CRUD operations
**Status:** PASS
**Detail:** Provides `updateSiteSpec(partial)` and `createSiteSpec()`. Auto-fetches current user's spec on mount using `user_id` filter with `maybeSingle()`.

---

## UI Primitives & Accessibility

### UI-001: All 4 primitives created with proper accessibility
**Status:** PASS
**Detail:**
- **Button.tsx**: Uses semantic `<button>` element, supports type/disabled/loading props, disabled state via `disabled:opacity-50 disabled:cursor-not-allowed`, focus-visible outline. Named export.
- **Input.tsx**: Label associated via htmlFor/id, aria-invalid on error, aria-describedby linking to error/helper text, error messages use role="alert". Named export.
- **Card.tsx**: Clean container with optional title rendered as `<h2>`. Named export.
- **LoadingSpinner.tsx**: Has role="status", aria-label="Loading", sr-only text "Loading...". Named export.

---

## Coding Standards Compliance

### CS-001: Named exports (except route pages)
**Status:** PASS
**Detail:** Only route files (index.tsx, chat.tsx, dashboard.tsx, preview.tsx, admin/sessions.tsx, admin/students.tsx) use default exports. All other components and hooks use named exports.

### CS-002: Functional components only
**Status:** PASS
**Detail:** No class components found. All components are functional.

### CS-003: Tailwind only (no inline styles)
**Status:** PASS
**Detail:** No `style=` attributes found in any TSX file. All styling uses Tailwind utility classes.

### CS-004: British English in user-facing copy
**Status:** PASS
**Detail:** No American spellings found in user-facing copy. The index.html uses `lang="en-GB"`. Type definitions use British spelling (e.g., `CustomColours`, `custom_colours`).

---

## Security

### SC-001: No API keys exposed
**Status:** PASS
**Detail:** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` referenced in client code (via import.meta.env). No service role key, no Claude API key, no Netlify key in frontend source. .env is in .gitignore and not committed.

### SC-002: .env not committed
**Status:** PASS
**Detail:** `.env`, `.env.local`, `.env.*.local` all in .gitignore. `git show HEAD:.env` confirms no .env file exists in the repository.

---

## Advisory Notes (non-blocking)

These are architecture observations for consideration in future phases. They do not affect the PASS verdict.

### NOTE-001: useAuth creates independent subscriptions per call site
**Severity:** Low
**Detail:** Each component that calls `useAuth()` creates its own Supabase auth state listener and profile fetch. In the current Phase 1 routing structure (ProtectedRoute -> RoleGate -> Page), a single admin page load triggers 3 separate auth subscriptions and 3 profile fetches. This works correctly but is inefficient. Recommend refactoring to a React Context provider pattern (AuthProvider) in a future phase so auth state is shared via context rather than duplicated.

### NOTE-002: No CHECK constraints on role/status columns
**Severity:** Low
**Detail:** The `profiles.role` column is typed as `text` with default `'student'` but no CHECK constraint to restrict values to `('student', 'instructor', 'admin')`. Similarly `sessions.status` and `site_specs.status` lack CHECK constraints. The TypeScript types enforce this at the application layer, but a database constraint would provide an additional safety net.

### NOTE-003: SocialLinks interface uses index signature
**Severity:** Low
**Detail:** `SocialLinks` in site-spec.ts has `[key: string]: string | undefined` which, while not technically `any`, is a broad index signature. This is acceptable for extensibility but could allow arbitrary keys. Consider whether a stricter union type is preferable in future phases.

---

## Summary

- **Passed:** 22
- **Failed:** 0
- **Advisory Notes:** 3
- **Total Checks:** 22

**Verdict: PASS**

The Phase 1 implementation is complete and correct. All required files are present, TypeScript compiles cleanly in strict mode with no `any` types, the production build succeeds, the database schema includes all 5 tables with RLS enabled and correct policies, the auth hook implements magic link correctly with proper state management, the useSiteSpec hook follows the optimistic update pattern, all UI primitives are accessible, British English is used consistently, and no security issues were found (no exposed API keys, no committed credentials).
