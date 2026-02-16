# Project Roadmap

**Project:** BirthBuild
**Last Updated:** 2026-02-15T21:45:00Z

## Phase Summary

| Phase | Name | Status | Priority | Duration | Notes |
|-------|------|--------|----------|----------|-------|
| 1 | Foundation & Auth | ✅ Complete | P0 | ~27 min | Supabase schema, PWA shell, magic link auth, security hardened |
| 2 | Chatbot Onboarding | ✅ Complete | P0 | ~35 min | Claude proxy, chat UI, question flow, AI content gen, 5 security fixes |
| 3 | Dashboard Form Editor | ✅ Complete | P0 | ~25 min | 7-tab form, palettes, typography, photo upload, 3 security fixes |
| 4 | Build Pipeline & Deploy | ✅ Complete | P0 | ~35 min | Static site gen, Netlify deploy, wordmark SVG, 4 security fixes |
| 5 | Instructor Admin | ✅ Complete | P0 | ~30 min | Admin shell, sessions CRUD, invite edge fn, student table, spec viewer, usage metrics, 3 security fixes |
| 6 | Polish & Integration Testing | ✅ Complete | P0 | ~25 min | Error boundary, mobile responsive tabs/tables, WCAG accessibility, build validation, stale rebuild, 2 QA fixes |

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
**Phase Status:** All 6 phases complete — project delivered
**Changes:**
- Phase 1 (Foundation & Auth) implemented, reviewed, and merged (PR #1)
- Security review found 6 issues (1 Critical, 2 High, 3 Low) — all resolved in 1 review-fix round
- Database schema includes: tenants, tenant_secrets, sessions, profiles, site_specs, photos with full RLS
- Auth: magic link flow with role assignment, protected routing, 60s cooldown
- UI primitives: Button, Input, Card, LoadingSpinner
- Phase 2 (Chatbot Onboarding) implemented, reviewed, and merged (PR #2)
- Claude API proxy Edge Function with JWT validation, rate limiting, tenant API key lookup
- 7-step chat flow: welcome → basics → style → content → photos → contact → review
- React-based markdown renderer (no dangerouslySetInnerHTML), system prompt/tools hardcoded server-side
- Security review found 7 issues (5 Medium, 2 Low) — 5 mandatory fixes resolved in 1 review-fix round
- Phase 3 (Dashboard Form Editor) implemented, reviewed, and merged (PR #3)
- 7-tab dashboard: Business Details, Design, Content, Photos, Contact & Social, SEO, Preview & Publish
- 22 new components + useDebouncedSave and usePhotoUpload hooks
- Visual selectors: 4 colour palettes with hex swatches, 3 typography pairs with Google Fonts live preview
- Photo upload to Supabase Storage with MIME-type extension derivation, user-scoped paths
- "Ask AI" buttons reusing chat Edge Function for inline content generation
- Security review found 7 issues (1 High, 2 Medium, 4 Low) — 3 mandatory fixes resolved in 1 round
- SEC-013: Private storage bucket with user-scoped RLS policies
- SEC-012: MIME-type-based extension (not filename)
- SEC-014: Path verification before storage delete

- Phase 4 (Build Pipeline & Deploy) implemented, reviewed, and merged (PR #4)
- 6 page generators (home, about, services, contact, testimonials, faq) with full HTML/CSS
- Shared utilities: escapeHtml, generateHead/Nav/Footer/Css, social link validation
- Wordmark SVG generation with 3 style variants (modern, classic, minimal)
- Palette system: 4 presets (sage_sand, blush_neutral, deep_earth, ocean_calm) + custom colours
- Typography config: 3 options (modern, classic, mixed) with Google Fonts
- Site generator orchestrator: sitemap.xml, robots.txt, hex colour validation
- Build Edge Function: JWT auth, rate limiting (5/hr), spec validation, ownership check
- ZIP creation (pure TypeScript, Store method, CRC-32), Netlify Deploy API integration
- Subdomain provisioning with slugification, reserved words, uniqueness check
- useBuild hook with Supabase Realtime status tracking (draft → building → live/error)
- PreviewTab: build button, validation warnings, building animation, device toggle preview
- Preview route: full-page iframe with toolbar and device toggles
- Security review found 9 issues (4 Medium, 5 Low) — 4 mandatory fixes resolved in 1 round
- SEC-021: JSON-LD script breakout XSS prevention (.replace on <)
- SEC-022: booking_url scheme validation (http/https only)
- SEC-019: UUID format validation on site_spec_id
- SEC-020: File path sanitisation in ZIP creation (traversal prevention)

- Phase 5 (Instructor Admin) implemented, reviewed, and merged (PR #5)
- AdminShell layout component with nav, sign out, green-700 active link styling
- Session CRUD: create, archive, active/all filter, student count, live site count
- useSessions hook: tenant-scoped session management
- Invite Edge Function: bulk magic link generation with JWT auth, rate limiting (100/hr, 50/request)
  - Cross-tenant protection: verify existing profile tenant_id before session_id update
  - Check-before-increment rate limiter logic
  - Cache-Control: no-store on magic link responses
- useStudents hook: student listing with site_spec join, session filtering, completion %
- Students page: table with status badges, progress bars, session filter, invite modal with results
- SpecViewer: read-only slide-over panel showing all site_spec sections (7 sections, colour swatches, expandable text)
- UsageMetrics: 4 metric cards with efficient count queries
- Security review found 7 issues (1 High, 2 Medium, 4 Low) — 3 mandatory fixes resolved in 1 round
- SEC-028: Cross-tenant profile reassignment prevention (tenant_id check)
- SEC-029: Rate limiter check-before-increment logic
- SEC-030: Cache-Control no-store header on invite response

- Phase 6 (Polish & Integration Testing) implemented, reviewed, and merged (PR #6)
- Global ErrorBoundary component wrapping all routes (class component, generic fallback UI)
- Mobile dashboard tab navigation: horizontal scroll, fade indicators, auto-scroll active tab, 44px touch targets
- Mobile admin student table: card layout below 768px breakpoint
- Generated site accessibility: heading hierarchy fixes (h3→h2 in contact, services, about), focus-visible outlines
- WCAG contrast ratio utility: getContrastRatio() and meetsContrastAA() in palettes.ts
- Build validation: photo alt text warnings, contrast ratio warnings (non-blocking)
- Stale build detection: isStale flag in useSiteSpec, rebuild banner in PreviewTab
- Responsive polish: session button w-full on mobile, 404 page with Go Home link
- QA found 2 heading hierarchy gaps in services.ts and about.ts — fixed in 1 round
- Security: CLEAN (0 findings) — all prior findings verified with no regressions

**Project Status:** MVP delivered and first live site deployed.

---

## Post-MVP: Next Steps

### Priority 1 — Blockers & Core UX (next session)

| Task | Description | Effort |
|------|-------------|--------|
| Fix duplicate site_spec rows | Users get multiple empty draft rows on login. Ensure only one spec per user, or select the correct one. | Small |
| Configure Resend SMTP | Set up custom SMTP in Supabase Auth settings to bypass free-tier email rate limits. Requires Resend domain verification. | Small |
| Chat tool-use responsiveness | The server-side tool loop causes 5-15s waits. Show typing indicator, or stream partial text to the client. | Medium |
| Chat step navigation | Add "Next step" / "Skip" buttons so users don't have to type to advance. Parse `[CHOICES: ...]` markers into clickable quick-reply buttons. | Medium |
| Photo storage URLs | Photo thumbnails show broken images. Verify Supabase Storage bucket is public or generate signed URLs for display. | Small |
| Chat ↔ dashboard flow | Add clear CTAs to move between chat and dashboard. Consider a unified progress sidebar. | Medium |

### Priority 2 — Polish & Reliability

| Task | Description | Effort |
|------|-------------|--------|
| Text input lag | Profile re-renders or debounce interaction causing input delay. Investigate and optimise. | Small |
| Build status per-spec | The dashboard shows the wrong spec's build status when multiple exist. Fix spec selection logic. | Small |
| Delete generate-link Edge Function | Temporary auth helper — remove once SMTP is configured. It has no JWT verification. | Tiny |
| Error states in build flow | Show clearer error messages when build fails (missing fields, Netlify errors). | Small |
| Chat history restoration | When returning to chat, restore conversation state properly including step progress. | Medium |

### Priority 3 — Features & Scale

| Task | Description | Effort |
|------|-------------|--------|
| Custom domain support | Allow users to connect their own domain instead of subdomain.birthbuild.com. Netlify API supports this. | Medium |
| Template variety | Add more site templates beyond the current single layout. Different page structures, hero styles, etc. | Large |
| Photo integration in generated sites | Include uploaded photos in the generated HTML (hero image, profile photo, gallery). Currently photos upload but don't appear in builds. | Medium |
| Instructor dashboard enhancements | Real-time student progress, bulk actions, session analytics. | Medium |
| Stripe integration | Payment flow for instructors to subscribe and manage their API key billing. | Large |
| Blog/CMS module | Allow users to add blog posts that get included in their generated site. | Large |
| SEO audit automation | Run Lighthouse scores on generated sites and surface recommendations. | Medium |

### Priority 4 — Infrastructure

| Task | Description | Effort |
|------|-------------|--------|
| CI/CD pipeline | GitHub Actions for type-checking, linting, and Edge Function deployment on push. | Medium |
| Staging environment | Supabase branch or separate project for testing before production. | Medium |
| Monitoring & alerting | Edge Function error rates, build success rates, API usage tracking. | Medium |
| Database backups | Automated Supabase backup schedule beyond default. | Small |
