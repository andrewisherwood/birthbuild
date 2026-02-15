# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T17:16:00Z
**Total Phases:** 6

Phase 1: Foundation & Auth ← CURRENT
Phase 2: Chatbot Onboarding
Phase 3: Dashboard Form Editor
Phase 4: Build Pipeline & Deploy
Phase 5: Instructor Admin
Phase 6: Polish & Integration Testing

---

# Detailed Plan: Phase 1 — Foundation & Auth

**Date:** 2026-02-15
**Status:** Planning
**Branch:** `feature/phase-1-foundation-auth`

## Overview

Set up the full project skeleton: React + Vite + Tailwind PWA shell, Supabase database schema with all tables and RLS policies, magic link authentication, and site_spec CRUD. After this phase, a user can authenticate via magic link, land on a route-stubbed app, and read/write their site_spec.

## Pre-existing Code

None — greenfield project. The repo contains only documentation files (CLAUDE.md, SCOPING.md, README.md), configuration (.gitignore, .env), and MAI pipeline infrastructure (.claude/, STATUS.md, etc.).

## Architecture Rules (MUST follow)

- TypeScript strict mode — no `any`, no implicit returns, no unused variables
- Functional components only — no class components
- Named exports — no default exports except route pages
- Custom hooks for all Supabase interactions — components never call Supabase directly
- Tailwind only — no inline styles, no CSS modules
- British English in all user-facing copy
- RLS enforced on every table — no exceptions
- API keys never exposed to client

## Loops

### Loop 1: Project Scaffold

**Goal:** Working React + Vite + Tailwind project that builds and runs.

**Files to create/modify:**
- `package.json` — dependencies: react, react-dom, react-router-dom, @supabase/supabase-js, tailwindcss, postcss, autoprefixer, vite, @vitejs/plugin-react, typescript
- `tsconfig.json` — strict mode, path aliases (`@/` → `src/`)
- `vite.config.ts` — React plugin, path aliases
- `tailwind.config.ts` — content paths, custom theme extensions for BirthBuild palette presets
- `postcss.config.js` — tailwind + autoprefixer
- `index.html` — root HTML with `<div id="root">`, lang="en-GB"
- `src/main.tsx` — React entry point, render App
- `src/App.tsx` — React Router setup with all route stubs
- `src/styles/globals.css` — Tailwind directives (@tailwind base/components/utilities)
- `src/vite-env.d.ts` — Vite type references
- `public/manifest.json` — PWA manifest with BirthBuild branding

**Acceptance criteria:**
- [ ] `npm install` succeeds
- [ ] `npm run dev` starts dev server
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` produces dist/ output

### Loop 2: Routing & Page Stubs

**Goal:** All routes defined with placeholder pages that render correctly.

**Files to create/modify:**
- `src/routes/index.tsx` — Landing / auth gate page
- `src/routes/chat.tsx` — Chatbot placeholder
- `src/routes/dashboard.tsx` — Dashboard placeholder
- `src/routes/preview.tsx` — Preview placeholder
- `src/routes/admin/sessions.tsx` — Instructor sessions placeholder
- `src/routes/admin/students.tsx` — Instructor students placeholder
- `src/App.tsx` — update with React Router routes for all paths

**Acceptance criteria:**
- [ ] Navigating to `/`, `/chat`, `/dashboard`, `/preview`, `/admin/sessions`, `/admin/students` renders a named stub component
- [ ] Unknown routes show a 404 fallback
- [ ] TypeScript compiles cleanly

### Loop 3: Supabase Schema & Migrations

**Goal:** Complete database schema with all tables and RLS policies.

**Files to create/modify:**
- `supabase/config.toml` — Supabase local config
- `supabase/migrations/001_initial_schema.sql` — DDL for: tenants, sessions, profiles, site_specs, photos tables as defined in SCOPING.md section 4
- RLS policies: students see own data, instructors see tenant data, all tables RLS-enabled
- `supabase/seed.sql` — Dev seed data: 1 tenant, 1 session, 2 profiles (1 instructor, 1 student), 1 site_spec

**Acceptance criteria:**
- [ ] All 5 tables created with correct columns and constraints
- [ ] RLS enabled on all tables with correct policies
- [ ] `updated_at` auto-updates via trigger
- [ ] Seed data loads without errors

### Loop 4: Supabase Client & Auth Hook

**Goal:** Supabase client initialised, useAuth hook provides auth state and magic link methods.

**Files to create/modify:**
- `src/lib/supabase.ts` — Supabase client init from env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- `src/hooks/useAuth.ts` — custom hook: signInWithMagicLink(email), signOut(), user, session, loading, role
- `src/types/database.ts` — placeholder for generated Supabase types (will be auto-generated)

**Acceptance criteria:**
- [ ] Supabase client connects to local or remote instance
- [ ] `useAuth` hook exposes: user, session, loading, role, signInWithMagicLink(), signOut()
- [ ] Magic link flow: enter email → receive link → click → authenticated
- [ ] Role derived from profiles table after auth
- [ ] Auth state persisted across page refreshes

### Loop 5: Auth-Gated Routing

**Goal:** Routes protected based on authentication and role. Unauthenticated users see landing/login. Students see chatbot/dashboard. Instructors see admin routes.

**Files to create/modify:**
- `src/components/auth/ProtectedRoute.tsx` — wraps routes requiring auth, redirects to `/` if unauthenticated
- `src/components/auth/RoleGate.tsx` — wraps routes requiring specific role (instructor), redirects if wrong role
- `src/routes/index.tsx` — update with login form (email input + "Send magic link" button)
- `src/App.tsx` — wrap routes with ProtectedRoute / RoleGate as appropriate

**Acceptance criteria:**
- [ ] Unauthenticated user on any protected route is redirected to `/`
- [ ] Authenticated student can access `/chat`, `/dashboard`, `/preview`
- [ ] Authenticated instructor can access `/admin/sessions`, `/admin/students`
- [ ] Student cannot access admin routes
- [ ] Login form sends magic link and shows confirmation message

### Loop 6: Site Spec CRUD Hook

**Goal:** Custom hook for full CRUD on site_specs table, respecting RLS.

**Files to create/modify:**
- `src/types/site-spec.ts` — TypeScript type definition for SiteSpec matching the DB schema
- `src/hooks/useSiteSpec.ts` — custom hook: getSiteSpec(), createSiteSpec(), updateSiteSpec(partial), deleteSiteSpec()
- Optimistic updates pattern: update local state immediately, sync to Supabase, rollback on error

**Acceptance criteria:**
- [ ] `useSiteSpec` hook provides: siteSpec, loading, error, updateSiteSpec(partial), createSiteSpec()
- [ ] Reading returns only the authenticated user's spec (RLS enforced)
- [ ] Partial updates merge with existing spec and set updated_at
- [ ] Optimistic update: UI reflects change immediately, reverts on error
- [ ] TypeScript types match the database schema exactly

### Loop 7: UI Primitives

**Goal:** Reusable UI components used across all routes (Button, Input, Card, Loading).

**Files to create/modify:**
- `src/components/ui/Button.tsx` — variants: primary, secondary, outline; sizes: sm, md, lg; loading state
- `src/components/ui/Input.tsx` — text input with label, error message, optional helper text
- `src/components/ui/Card.tsx` — container with padding, border, optional title
- `src/components/ui/LoadingSpinner.tsx` — simple loading indicator
- All using Tailwind classes, accessible by default (labels, aria attributes)

**Acceptance criteria:**
- [ ] Button renders with correct variant styles and handles click/loading
- [ ] Input renders with label, handles change, shows error state
- [ ] Card renders children with consistent spacing
- [ ] All components accessible (proper roles, labels, focus states)
- [ ] TypeScript compiles cleanly

---

## Security Considerations

- **Supabase anon key** is safe to expose (it's a public key), but the **service role key** must NEVER appear in client code. Only edge functions use the service role key.
- **RLS is the primary security boundary.** Every table must have RLS enabled. Test that students cannot read other students' data.
- **Magic link tokens** expire after 1 hour (Supabase default). Verify this is configured.
- **VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY** are the only env vars exposed to the client (VITE_ prefix).
- No sensitive data in `.env` should be committed — `.gitignore` already excludes `.env`.

## Edge Cases

- User clicks magic link after token expires → show friendly error, offer to resend
- User opens magic link in different browser → auth may not carry over, handle gracefully
- Profile creation race condition on first login → use upsert or check-before-insert
- site_spec concurrent edits (same user in two tabs) → last-write-wins is acceptable for V1
- Supabase connection failure → useAuth and useSiteSpec must handle loading/error states

## Sequencing Notes

- Loop 1 must complete before any other loop (project scaffold is required)
- Loop 2 depends on Loop 1 (needs React Router)
- Loop 3 can run in parallel with Loop 2 (Supabase schema is independent of frontend routes)
- Loop 4 depends on Loop 3 (needs Supabase tables to exist) and Loop 1 (needs supabase-js installed)
- Loop 5 depends on Loop 2 + Loop 4 (needs routes + auth hook)
- Loop 6 depends on Loop 3 + Loop 4 (needs schema + supabase client)
- Loop 7 can run at any point after Loop 1 (UI primitives are standalone)
- Recommended order: 1 → 2+3 → 4+7 → 5+6
