# Implementation Brief

**Task:** Foundation & Auth Setup
**Phase:** 1
**Branch:** `phase-1-foundation-auth`
**PR Title:** `Phase 1: Foundation & Auth`
**Priority:** P0
**Created:** 2026-02-15T17:17:00Z
**Created by:** Coordinator

---

## Summary

Set up the full BirthBuild project from scratch: React 18 + Vite + Tailwind CSS PWA shell, Supabase database schema with all tables (tenants, sessions, profiles, site_specs, photos) and RLS policies, magic link authentication flow, site_spec CRUD hook, and reusable UI primitives. After this phase, a user can authenticate via magic link, navigate the app shell, and read/write their site specification.

## Architecture Rules (MUST follow)

- TypeScript strict mode — no `any`, no implicit returns, no unused variables
- Functional components only — no class components
- Named exports — no default exports except route pages
- Custom hooks for all Supabase interactions — components never call Supabase directly
- Tailwind only — no inline styles, no CSS modules, no styled-components
- British English in all user-facing copy (colour, organisation, labour, specialise)
- Accessible by default — all interactive elements have labels, all images have alt text, semantic HTML
- RLS enforced on every table — no exceptions
- API keys never exposed to client (only VITE_ prefixed env vars)
- Optimistic updates — write to local state immediately, sync to Supabase, rollback on error

---

## Implementation Steps

### Loop 1: Project Scaffold

Create the React + Vite + Tailwind project structure:

1. Initialise with `npm create vite@latest . -- --template react-ts` (or manually create package.json)
2. Install dependencies:
   - Core: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`
   - Build: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`
   - Styles: `tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/forms`
3. Configure `tsconfig.json` with strict mode and `@/` path alias mapping to `src/`
4. Configure `vite.config.ts` with React plugin and path alias resolution
5. Configure `tailwind.config.ts` with content paths (`src/**/*.{ts,tsx}`)
6. Create `postcss.config.js` with tailwindcss + autoprefixer
7. Create `index.html` with `<html lang="en-GB">`, `<div id="root">`
8. Create `src/main.tsx` as React entry point
9. Create `src/App.tsx` with basic Router wrapper
10. Create `src/styles/globals.css` with Tailwind directives
11. Create `public/manifest.json` for PWA
12. Create `src/vite-env.d.ts` for Vite types

**Verify:** `npm install && npm run dev && npx tsc --noEmit && npm run build`

### Loop 2: Routing & Page Stubs

Create all route pages as stub components:

1. `src/routes/index.tsx` — Landing / auth gate (default export)
2. `src/routes/chat.tsx` — Chatbot placeholder (default export)
3. `src/routes/dashboard.tsx` — Dashboard placeholder (default export)
4. `src/routes/preview.tsx` — Preview placeholder (default export)
5. `src/routes/admin/sessions.tsx` — Instructor sessions placeholder (default export)
6. `src/routes/admin/students.tsx` — Instructor students placeholder (default export)
7. Update `src/App.tsx` with React Router routes: `/`, `/chat`, `/dashboard`, `/preview`, `/admin/sessions`, `/admin/students`, plus a 404 catch-all

**Verify:** All routes render their stub content. Unknown paths show 404.

### Loop 3: Supabase Schema & Migrations

Create the complete database schema:

1. Create `supabase/config.toml` with local dev config
2. Create `supabase/migrations/001_initial_schema.sql` with:
   - `tenants` table (id, name, owner_id, claude_api_key, plan, settings, created_at, updated_at)
   - `sessions` table (id, tenant_id FK, name, status, created_at, updated_at)
   - `profiles` table (id PK refs auth.users, email, display_name, role, tenant_id FK, session_id FK, created_at, updated_at)
   - `site_specs` table (all columns from SCOPING.md section 4 — business info, contact, content, design, accreditation, SEO, pages, deployment, chat_history, timestamps)
   - `photos` table (id, site_spec_id FK, storage_path, purpose, alt_text, sort_order, created_at)
   - RLS enabled on ALL tables
   - RLS policies: students own their data, instructors read their tenant's data
   - `updated_at` auto-update trigger on all tables with updated_at
3. Create `supabase/seed.sql` with dev data: 1 tenant, 1 session, 2 profiles (instructor + student), 1 site_spec

**Verify:** Schema applies without errors. Seed data loads. RLS policies enforce isolation.

### Loop 4: Supabase Client & Auth Hook

Wire up Supabase client and authentication:

1. Create `src/lib/supabase.ts` — initialise Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Create `src/hooks/useAuth.ts` — custom hook:
   - State: `user`, `session`, `loading`, `role` (from profiles table)
   - Methods: `signInWithMagicLink(email: string)`, `signOut()`
   - Listens to Supabase auth state changes
   - Fetches user profile (and role) after auth resolves
   - Handles loading states while auth is resolving
3. Create `src/types/database.ts` — placeholder type file (will be auto-generated from Supabase later)

**Verify:** Auth hook provides correct state. Magic link flow works.

### Loop 5: Auth-Gated Routing

Protect routes based on auth status and role:

1. Create `src/components/auth/ProtectedRoute.tsx` — wraps children, redirects to `/` if not authenticated
2. Create `src/components/auth/RoleGate.tsx` — wraps children, redirects if user doesn't have required role
3. Update `src/routes/index.tsx` — add login form: email input, "Send magic link" button, success/error messages
4. Update `src/App.tsx` — wrap student routes with ProtectedRoute, wrap admin routes with ProtectedRoute + RoleGate(role="instructor")

**Verify:** Unauthenticated users redirected to `/`. Students access student routes. Instructors access admin routes. Students blocked from admin.

### Loop 6: Site Spec CRUD Hook

Create the core data hook:

1. Create `src/types/site-spec.ts` — full TypeScript interface for SiteSpec matching DB schema
2. Create `src/hooks/useSiteSpec.ts` — custom hook:
   - State: `siteSpec`, `loading`, `error`
   - Methods: `updateSiteSpec(partial: Partial<SiteSpec>)`, `createSiteSpec()`
   - Auto-fetches the current user's spec on mount
   - Optimistic updates: apply change to local state, then sync to Supabase, rollback on error
   - Sets `updated_at` on every write

**Verify:** Hook reads/writes site_spec correctly. RLS enforced. Optimistic updates work.

### Loop 7: UI Primitives

Create reusable UI components:

1. `src/components/ui/Button.tsx` — props: variant (primary/secondary/outline), size (sm/md/lg), loading, disabled, children, onClick. Tailwind styled. Accessible (proper button element, disabled state).
2. `src/components/ui/Input.tsx` — props: label, value, onChange, error, helperText, type, placeholder, required. Label associated with input. Error state styling.
3. `src/components/ui/Card.tsx` — props: title (optional), children. Container with padding and border.
4. `src/components/ui/LoadingSpinner.tsx` — simple spinner with aria-label.

**Verify:** All components render correctly. Accessible. TypeScript compiles.

---

## Files Summary

### Files to Modify

None — greenfield project, all files are new.

### Files to Create

**Root config:**
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.ts`
- `postcss.config.js`
- `index.html`

**Source:**
- `src/main.tsx`
- `src/App.tsx`
- `src/vite-env.d.ts`
- `src/styles/globals.css`
- `src/routes/index.tsx`
- `src/routes/chat.tsx`
- `src/routes/dashboard.tsx`
- `src/routes/preview.tsx`
- `src/routes/admin/sessions.tsx`
- `src/routes/admin/students.tsx`
- `src/lib/supabase.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useSiteSpec.ts`
- `src/types/database.ts`
- `src/types/site-spec.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/RoleGate.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/LoadingSpinner.tsx`

**Public:**
- `public/manifest.json`

**Supabase:**
- `supabase/config.toml`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/seed.sql`

---

## Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts the development server
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` produces dist/ output successfully
- [ ] All 6 routes render their page content (/, /chat, /dashboard, /preview, /admin/sessions, /admin/students)
- [ ] Unknown routes show a 404 page
- [ ] Supabase schema creates all 5 tables (tenants, sessions, profiles, site_specs, photos) with correct columns
- [ ] RLS enabled on all tables with correct policies
- [ ] Magic link auth flow works: enter email → receive link → click → authenticated
- [ ] Auth state persists across page refresh
- [ ] Unauthenticated users redirected to login page from protected routes
- [ ] Students can access /chat, /dashboard, /preview but NOT /admin/*
- [ ] Instructors can access /admin/sessions and /admin/students
- [ ] useSiteSpec hook reads/writes the authenticated user's spec
- [ ] Optimistic updates work: UI updates immediately, syncs to Supabase
- [ ] All UI primitives (Button, Input, Card, LoadingSpinner) render correctly with proper accessibility
- [ ] TypeScript strict mode — zero `any` types in all files

---

## Security Notes

- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed to the client (VITE_ prefix)
- The Supabase service role key must NEVER appear in frontend code
- RLS is the primary security boundary — test that students cannot access other students' data
- Magic link tokens expire after 1 hour (Supabase default)
- `.env` is gitignored — never commit credentials
- No sensitive data should be stored in localStorage beyond the Supabase session token

---

## Context

### Existing patterns to follow
None — this is the first phase, establishing patterns for the rest of the project. Set conventions here that all subsequent phases will follow.

### Key function locations
All new — no existing functions to reference.

### Build command
```bash
npm install && npx tsc --noEmit && npm run build
```
