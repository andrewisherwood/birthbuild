# Project Roadmap

**Project:** BirthBuild
**Last Updated:** 2026-02-15T17:15:00Z

## Phase Summary

| Phase | Name | Status | Priority | Duration | Notes |
|-------|------|--------|----------|----------|-------|
| 1 | Foundation & Auth | ⏳ Pending | P0 | — | Supabase schema, PWA shell, magic link auth |
| 2 | Chatbot Onboarding | ⏳ Pending | P0 | — | Claude proxy, chat UI, question flow, AI content gen |
| 3 | Dashboard Form Editor | ⏳ Pending | P0 | — | Tabbed form, palettes, typography, photo upload |
| 4 | Build Pipeline & Deploy | ⏳ Pending | P0 | — | Static site gen, Netlify deploy, subdomain provisioning |
| 5 | Instructor Admin | ⏳ Pending | P0 | — | Sessions, invites, student overview, usage metrics |
| 6 | Polish & Integration Testing | ⏳ Pending | P0 | — | Edit/rebuild flow, WCAG audit, Lighthouse, error handling |

## Detailed Phases

### Phase 1: Foundation & Auth
**Dependencies:** None | **Complexity:** Medium
Set up the Supabase project with database schema (tenants, sessions, profiles, site_specs, photos), RLS policies, and auth configuration. Create the React + Vite + Tailwind PWA shell with routing. Implement magic link authentication with role assignment. Basic site_spec CRUD.

### Phase 2: Chatbot Onboarding
**Dependencies:** Phase 1 | **Complexity:** High
Build the Claude-powered chatbot guiding students through the 7-step question flow. Claude API proxy Edge Function, chat UI, system prompt with function calling, AI content generation (bio, tagline, FAQ). Chat history persistence.

### Phase 3: Dashboard Form Editor
**Dependencies:** Phase 1 | **Complexity:** Medium
Tabbed form editor reading/writing the same site_spec as the chatbot. Colour palette visual selector, typography preview, photo upload to Supabase Storage, progress indicator, "Ask AI" buttons. Debounced saves with optimistic updates.

### Phase 4: Build Pipeline & Deploy
**Dependencies:** Phase 2, Phase 3 | **Complexity:** High
MAI build pipeline generating static HTML/CSS/JS from site_spec. Wordmark SVG generation. Netlify Deploy API integration with subdomain provisioning. Build status tracking via Supabase Realtime. Preview iframe.

### Phase 5: Instructor Admin
**Dependencies:** Phase 1 | **Complexity:** Medium
Instructor admin dashboard with session CRUD, bulk student invite flow, student overview table, read-only spec viewer, and usage metrics.

### Phase 6: Polish & Integration Testing
**Dependencies:** Phase 4, Phase 5 | **Complexity:** Medium
Edit/rebuild flow end-to-end. WCAG audit on generated sites. Lighthouse optimisation. Error handling, mobile responsive testing, edge case coverage.

---

## Agent Update — 2026-02-15

**Updated by:** Conductor
**Phase Status:** Phase plan created, entering execution loop
**Changes:**
- Decomposed SCOPING.md into 6 vertical-slice phases
- Initialised infrastructure (worktrees, memory, status files)

**Next Priority:** Plan and execute Phase 1 (Foundation & Auth)
