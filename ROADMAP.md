# Project Roadmap

**Project:** BirthBuild
**Last Updated:** 2026-02-15T19:30:00Z

## Phase Summary

| Phase | Name | Status | Priority | Duration | Notes |
|-------|------|--------|----------|----------|-------|
| 1 | Foundation & Auth | ✅ Complete | P0 | ~27 min | Supabase schema, PWA shell, magic link auth, security hardened |
| 2 | Chatbot Onboarding | ✅ Complete | P0 | ~35 min | Claude proxy, chat UI, question flow, AI content gen, 5 security fixes |
| 3 | Dashboard Form Editor | ✅ Complete | P0 | ~25 min | 7-tab form, palettes, typography, photo upload, 3 security fixes |
| 4 | Build Pipeline & Deploy | ✅ Complete | P0 | ~35 min | Static site gen, Netlify deploy, wordmark SVG, 4 security fixes |
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
**Phase Status:** Phases 1–4 complete, starting Phase 5
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

**Next Priority:** Plan and execute Phase 5 (Instructor Admin)
