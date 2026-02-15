# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T17:15:00Z
**Total Phases:** 6

## Phase 1: Foundation & Auth
**Dependencies:** None
**Estimated complexity:** Medium
**Description:** Set up the Supabase project with database schema, RLS policies, and auth configuration. Create the React + Vite + Tailwind PWA shell with routing. Implement magic link authentication flow with role assignment (student/instructor). Establish basic CRUD operations for site_specs.
**Acceptance criteria:**
- [ ] Supabase project initialised with all tables (tenants, sessions, profiles, site_specs, photos) and RLS policies enforced
- [ ] React PWA shell loads with Vite + Tailwind, all route stubs render (/, /chat, /dashboard, /preview, /admin/sessions, /admin/students)
- [ ] Magic link auth flow works end-to-end: user enters email, receives link, clicks link, lands authenticated with correct role
- [ ] Profile auto-created on first login with tenant_id and session_id from invite context
- [ ] site_specs table supports full CRUD via custom hook (useSiteSpec) with RLS enforcing user isolation
- [ ] TypeScript strict mode passes with no errors (`npx tsc --noEmit`)

## Phase 2: Chatbot Onboarding
**Dependencies:** Phase 1
**Estimated complexity:** High
**Description:** Build the Claude-powered chatbot that guides students through the site-building question flow. Implement the Claude API proxy Edge Function, chat UI components, system prompt with function calling schema, and AI content generation (bio, tagline, FAQ). Chat history persists to site_spec.chat_history.
**Acceptance criteria:**
- [ ] Claude API proxy Edge Function deployed and callable from the client (API key never exposed to browser)
- [ ] Chat UI renders a message thread with user and assistant messages, input field, and send button
- [ ] System prompt follows the 7-step question flow (welcome → basics → style → content → photos → contact → review)
- [ ] Each chatbot answer writes to the correct site_spec field via function calling
- [ ] AI content generation works for bio, tagline, service descriptions, and FAQ
- [ ] Chat history persisted in site_spec.chat_history and restored on return visits
- [ ] British English used throughout all chatbot responses

## Phase 3: Dashboard Form Editor
**Dependencies:** Phase 1
**Estimated complexity:** Medium
**Description:** Build the tabbed form-based dashboard that reads and writes the same site_spec as the chatbot. Includes colour palette visual selector, typography preview, photo upload to Supabase Storage, progress indicator, and "Ask AI" inline content generation buttons. All form fields use debounced saves.
**Acceptance criteria:**
- [ ] Tabbed form renders all sections: Business Details, Design, Content, Photos, Contact & Social, SEO, Preview & Publish
- [ ] All form fields read from and write to the same site_spec row as the chatbot
- [ ] Colour palette selector shows 4 preset palettes as visual hex swatches plus custom option
- [ ] Typography selector shows live font pair previews (heading + body)
- [ ] Photo upload works: file selected → uploaded to Supabase Storage → linked in photos table with alt text
- [ ] Debounced saves (500ms after last keystroke) with optimistic UI updates
- [ ] Progress indicator shows completion percentage based on filled fields
- [ ] "Ask AI" buttons generate content for text fields (bio, tagline, service descriptions)

## Phase 4: Build Pipeline & Deploy
**Dependencies:** Phase 2, Phase 3
**Estimated complexity:** High
**Description:** Implement the MAI build pipeline that generates static HTML/CSS/JS from a site_spec, the wordmark SVG generator, Netlify Deploy API integration, subdomain provisioning, and build status tracking via Supabase Realtime. Students can preview their site in an iframe before publishing.
**Acceptance criteria:**
- [ ] Build Edge Function validates spec completeness (minimum: business_name, doula_name, service_area, one service, email)
- [ ] Static site generated from spec includes all selected pages (home, about, services, contact + optional testimonials, FAQ)
- [ ] Generated sites use the selected palette, typography, and style with semantic HTML5 and WCAG 2.1 AA compliance
- [ ] Wordmark SVG generated from business name, heading font, and primary colour
- [ ] Netlify Deploy API integration: site created on first build, subsequent builds deploy to same site
- [ ] Subdomain provisioned as [slug].birthbuild.com with uniqueness validation
- [ ] Build status tracked in real-time via Supabase Realtime (draft → building → live/error)
- [ ] Preview iframe renders the generated site in the dashboard

## Phase 5: Instructor Admin
**Dependencies:** Phase 1
**Estimated complexity:** Medium
**Description:** Build the instructor admin dashboard with session CRUD, bulk student invite flow (magic link generation), student overview table with progress/status, and read-only spec viewer. Includes usage metrics display for Claude API tokens, builds triggered, and active sites.
**Acceptance criteria:**
- [ ] Instructor can create, view, and archive workshop sessions
- [ ] Bulk invite flow: instructor pastes student emails → magic links generated and displayed for distribution
- [ ] Student overview table shows: name, email, site status (draft/building/live), completion %, preview link
- [ ] Instructor can click into any student and view their site_spec in read-only mode
- [ ] Students filtered by session
- [ ] Usage metrics displayed: API token usage per session, total builds, active sites count
- [ ] RLS enforces instructor can only see students within their own tenant

## Phase 6: Polish & Integration Testing
**Dependencies:** Phase 4, Phase 5
**Estimated complexity:** Medium
**Description:** Wire up the edit/rebuild flow end-to-end (chatbot or dashboard edits → rebuild → redeploy). Conduct WCAG audit on generated sites, Lighthouse optimisation, comprehensive error handling, mobile responsive testing of the admin PWA, and edge case coverage.
**Acceptance criteria:**
- [ ] Edit via chatbot triggers spec update → rebuild → redeploy to same subdomain
- [ ] Edit via dashboard triggers spec update → rebuild → redeploy to same subdomain
- [ ] Generated sites score 95+ on Lighthouse across all four categories
- [ ] Generated sites pass WCAG 2.1 AA validation (colour contrast, semantic structure, keyboard navigation)
- [ ] Error boundaries catch and display user-friendly messages for all async operations
- [ ] Admin PWA responsive on mobile (tested at 375px, 768px, 1024px breakpoints)
- [ ] Full end-to-end flow works: instructor creates session → student joins → chatbot → dashboard edits → build → live site → edit → rebuild
