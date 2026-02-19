# CLAUDE.md — BirthBuild

## Project Overview

BirthBuild is an AI-powered static website builder for birth workers (doulas, midwives, antenatal educators). Non-technical users build professional websites through a guided chatbot conversation or a form-based dashboard. An instructor creates workshop sessions, invites students via magic link, and monitors progress. The chatbot gathers preferences and content, produces a structured site specification, and triggers a build pipeline that generates and deploys a static site to a provisioned subdomain on birthbuild.com.

See `SCOPING.md` for full product specification including data model, feature breakdown, and build phases.
See `scoping-rebuild.md` for the precise rebuild specification derived from the existing codebase.
See `uk-doula-website-research.md` for design patterns, colour palettes, accessibility trees, and SEO requirements that inform generated site output.

## Tech Stack

- **Language:** TypeScript (strict mode, no `any`)
- **Frontend:** React 18+ with Vite, Tailwind CSS
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase Postgres with Row Level Security
- **Auth:** Supabase Auth (magic link, email-based)
- **Storage:** Supabase Storage (photo uploads, generated assets)
- **AI:** Claude API (Anthropic) — proxied through Edge Functions, never client-side
- **Deployment (generated sites):** Netlify Deploy API
- **Package manager:** npm

## Architecture Rules

### Folder Structure

```
birthbuild/
├── CLAUDE.md
├── SCOPING.md
├── README.md
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── index.tsx              # Landing / auth gate
│   │   ├── chat.tsx               # Chatbot onboarding (reads ?site_id for multi-site)
│   │   ├── dashboard.tsx          # Form editor (reads ?site_id and ?tab)
│   │   ├── preview.tsx            # Site preview iframe
│   │   └── admin/
│   │       ├── sessions.tsx       # Instructor session management
│   │       ├── students.tsx       # Instructor student overview
│   │       └── sites.tsx          # Instructor multi-site management
│   ├── components/
│   │   ├── ErrorBoundary.tsx      # Top-level error boundary
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx # Redirect to login if unauthenticated
│   │   │   └── RoleGate.tsx       # Restrict by user role (e.g. instructor)
│   │   ├── ui/                    # Reusable primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── StatusBadge.tsx    # Shared site status badge (draft/building/preview/live/error)
│   │   ├── chat/                  # Chat UI components
│   │   │   ├── ChatContainer.tsx  # Full-height chat layout
│   │   │   ├── ChatInput.tsx      # Message input bar
│   │   │   ├── CompletionCard.tsx # Shown when all chat steps complete
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── PhotoUploadPanel.tsx # Inline photo upload triggered by chat tool
│   │   │   ├── QuickReplyButtons.tsx
│   │   │   └── StepIndicator.tsx
│   │   ├── dashboard/             # Dashboard form sections
│   │   │   ├── DashboardShell.tsx # Tab layout + header (supports ?tab deep-linking)
│   │   │   ├── TabNav.tsx
│   │   │   ├── BusinessDetailsTab.tsx
│   │   │   ├── DesignTab.tsx
│   │   │   ├── ContentTab.tsx
│   │   │   ├── PhotosTab.tsx
│   │   │   ├── ContactTab.tsx
│   │   │   ├── SeoTab.tsx
│   │   │   ├── PreviewTab.tsx     # Build, preview URL, publish/unpublish controls
│   │   │   ├── SiteEditorTab.tsx  # Deterministic editing (sections, colours, fonts, live preview)
│   │   │   ├── SiteEditChat.tsx   # AI-powered section editing via chat
│   │   │   ├── CheckpointHistory.tsx # Version history with rollback
│   │   │   ├── GenerationProgress.tsx # LLM build progress bar
│   │   │   ├── AskAiButton.tsx
│   │   │   ├── CustomColourPicker.tsx
│   │   │   ├── PaletteSelector.tsx
│   │   │   ├── PhotoUploadCard.tsx
│   │   │   ├── ProgressIndicator.tsx
│   │   │   ├── ServiceEditor.tsx
│   │   │   ├── StyleSelector.tsx
│   │   │   ├── TestimonialEditor.tsx
│   │   │   ├── TextareaField.tsx
│   │   │   ├── ToggleSwitch.tsx
│   │   │   └── TypographySelector.tsx
│   │   └── admin/                 # Instructor admin components
│   │       ├── AdminShell.tsx     # Admin layout with nav (Sessions, Students, My Sites)
│   │       ├── SpecViewer.tsx     # Read-only spec viewer
│   │       └── UsageMetrics.tsx
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client init
│   │   ├── auth-bypass.ts         # SDK bypass for Edge Functions + Storage (avoids auth lock hangs)
│   │   ├── density-score.ts       # Spec density scoring algorithm
│   │   ├── claude.ts              # Claude API call helpers (via Edge Function)
│   │   ├── chat-prompts.ts        # System prompts and step definitions for chat
│   │   ├── chat-tools.ts          # Tool definitions and spec-update mapping
│   │   ├── site-generator.ts      # Static site HTML/CSS generation
│   │   ├── section-parser.ts      # Parse/reorder/remove HTML sections (bb-section markers)
│   │   ├── css-editor.ts          # Extract/update CSS variables in checkpoint HTML
│   │   ├── wordmark.ts            # SVG wordmark logo generation
│   │   ├── invite.ts              # Invite link helpers
│   │   └── palettes.ts            # Colour palette definitions
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth state, sign in/out, profile
│   │   ├── useSiteSpec.ts         # CRUD for site_specs (optional siteId for multi-site)
│   │   ├── useChat.ts             # Chat state, message sending, step tracking
│   │   ├── useBuild.ts            # Build orchestration (template + LLM) + Realtime status
│   │   ├── useCheckpoint.ts       # CRUD for site_checkpoints (versioned HTML snapshots)
│   │   ├── usePublish.ts          # Publish/unpublish actions
│   │   ├── usePhotoUpload.ts      # Photo upload/delete to Supabase Storage
│   │   ├── useDebouncedSave.ts    # Debounced spec field saves (500ms)
│   │   ├── useSessions.ts         # Instructor session CRUD
│   │   ├── useStudents.ts         # Student overview for instructors
│   │   └── useInstructorSites.ts  # Multi-site CRUD for instructors
│   ├── types/
│   │   ├── database.ts            # Supabase generated types
│   │   └── site-spec.ts           # SiteSpec type definition
│   └── styles/
│       └── globals.css            # Tailwind directives + custom styles
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_storage_policies.sql
│   │   ├── 003_preview_publish.sql # Adds "preview" status + preview_url column
│   │   ├── 004_design_config.sql   # Advanced design editor overrides
│   │   ├── 005_admin_role.sql      # Admin role + instructor invite EF
│   │   ├── 006_llm_generation.sql  # site_checkpoints table, retention trigger, RLS
│   │   ├── 007_public_photos_bucket.sql # Public bucket for permanent image URLs
│   │   ├── 008_rate_limit_table.sql    # DB-backed rate limiting
│   │   └── 009_spec_density_fields.sql # Spec density depth fields (bio, training, philosophy)
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── edge-helpers.ts    # CORS, auth, DB-backed rate limiting, body size validation
│   │   │   └── sanitise-html.ts   # HTML + CSS sanitisation for LLM output
│   │   ├── chat/index.ts          # Claude API proxy + tool calling
│   │   ├── build/index.ts         # Site generation + Netlify deploy (preview first)
│   │   ├── generate-design-system/index.ts  # LLM: shared CSS, nav, footer generation
│   │   ├── generate-page/index.ts           # LLM: per-page HTML generation
│   │   ├── edit-section/index.ts            # LLM: AI-powered section editing
│   │   ├── publish/index.ts       # Publish (add custom domain) / unpublish
│   │   ├── delete-site/index.ts   # Delete site (Netlify + storage + DB cleanup)
│   │   ├── invite/index.ts        # Generate magic link invites for students
│   │   ├── invite-instructor/index.ts # Generate instructor account + magic link
│   │   └── design-chat/index.ts   # Claude API proxy for design editing chat
│   └── seed.sql                   # Dev seed data
└── templates/                     # Static site template assets
    ├── base/                      # Base HTML/CSS structure
    ├── palettes/                  # Colour palette CSS variables
    └── components/                # Reusable site section templates
```

### Coding Standards

- **TypeScript strict mode** — no `any`, no implicit returns, no unused variables
- **Functional components only** — no class components
- **Named exports** — no default exports except route pages
- **Custom hooks** for all Supabase interactions — components never call Supabase directly
- **Error boundaries** around async operations — never let a failed API call crash the UI
- **Tailwind only** — no inline styles, no CSS modules, no styled-components
- **British English** in all user-facing copy — colour, organisation, labour, specialise
- **Accessible by default** — all interactive elements have labels, all images have alt text, all forms have associated labels, semantic HTML throughout

### Patterns

- **Site spec is the single source of truth.** Both chatbot and dashboard read/write the same `site_specs` row. Neither "owns" the data.
- **Optimistic updates** — write to local state immediately, sync to Supabase, rollback on error.
- **Debounced saves** — dashboard form fields save 500ms after last keystroke, not on every change.
- **Edge Functions as API proxy** — all external API calls (Claude, Netlify) go through Edge Functions. API keys never touch the client.
- **RLS enforced on every table** — no exceptions. Students see only their own data. Instructors see their tenant's data. Client queries also scope by `user_id` as defence in depth. Test this.
- **Chat history is append-only** — never mutate previous messages. New messages push to the array.
- **Build pipeline is async** — trigger returns immediately, status tracked via Supabase Realtime subscription on `site_specs.status`.
- **Preview before publish** — builds deploy to Netlify without a custom domain (preview). A separate publish action adds the custom domain to go live. Status flow: `draft → building → preview → live` (with `error` as a retry state). Rebuilds while live preserve the live status.
- **Instructor multi-site** — instructors can create multiple sites via `/admin/sites`. The `?site_id=` query param threads through `/chat` and `/dashboard` to scope to a specific spec. Student flow (no `site_id`) fetches their single spec.
- **Chat tool calling** — Claude uses function calling (`tool_use`) to write structured data to the site spec (e.g. `set_business_info`, `set_style`). The `trigger_photo_upload` tool shows an inline upload panel. `mark_step_complete` transitions the chat step state.
- **Two build paths** — Template build (deterministic, client-side HTML generation) and LLM build (AI-generated pages via Edge Functions). The LLM path: generate-design-system → generate-page (parallel, per page) → save checkpoint → deploy to Netlify.
- **Checkpoint system** — Versioned HTML snapshots in `site_checkpoints` table. Each checkpoint stores full HTML pages + cached design system. Retention trigger prunes to last 10 per site. Unique constraint on `(site_spec_id, version)` with retry logic for concurrent writes.
- **Section markers** — `<!-- bb-section:name -->...<!-- /bb-section:name -->` HTML comments enable deterministic editing (reorder, remove, replace) without re-running the LLM.
- **SDK auth bypass** — `auth-bypass.ts` provides raw `fetch()` wrappers that bypass the Supabase SDK's auth lock (which hangs under React 18 Strict Mode double-mounts): `invokeEdgeFunctionBypass()` for Edge Functions, `uploadStorageBypass()`/`removeStorageBypass()` for Storage uploads/deletes, and `getPublicStorageUrl()` for public bucket URLs. All client-side Supabase API calls (Edge Functions, Storage writes) must use these bypasses — never use `supabase.functions.invoke()` or `supabase.storage.upload()`/`remove()` directly.
- **10-second loading backstop** — All data-fetching hooks (`useSiteSpec`, `usePhotoUpload`, `useCheckpoint`) cap their loading state at 10 seconds to prevent permanent spinners from SDK hangs.
- **Public photos bucket** — Photos bucket is public for permanent image URLs via `getPublicStorageUrl()`. No signed URLs needed. Supabase Image Transforms (Pro plan) resize to 1200px wide, quality 80, auto WebP. Upload/delete policies remain scoped to authenticated users.
- **Edge Function JWT handling** — All Edge Functions are deployed with `verify_jwt: false` (Supabase gateway JWT validation disabled) because the gateway intermittently rejects valid tokens. Each function validates the JWT internally via `edge-helpers.ts`. This is defence-in-depth: the function-level auth is the primary gate.
- **Chat edge function limits** — `max_tokens: 4096` for Claude API output. Per-message length validation (`MAX_MESSAGE_LENGTH = 4_000`) only applies to user messages — assistant messages legitimately contain generated bios/content that exceed this. Total payload capped at 100KB.
- **DB-backed rate limiting** — `check_rate_limit` RPC atomically upserts counters with sliding window expiry. Replaces in-memory Maps that reset on cold starts. Fails open if DB call errors.
- **Content Security Policy** — All generated site pages include CSP meta tags: `default-src 'none'`, allows inline styles + Google Fonts, Supabase storage images, form submissions. Blocks scripts and iframes.
- **HTML/CSS sanitisation** — All LLM-generated HTML is sanitised via regex-based stripping of `<script>`, event handlers, `javascript:` URLs, `<base>` tags, CSS `@import`/`expression()`/`url()` injection.

### Component Conventions

- UI primitives in `components/ui/` — keep them generic, no business logic
- Feature components co-located with their route where possible
- Props interfaces defined inline above the component, not in separate files
- Loading and error states handled in every component that fetches data

## Build & Test Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Type checking
npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview

# Supabase local dev
npx supabase start
npx supabase db reset          # Apply migrations + seed

# Generate Supabase types
npx supabase gen types typescript --local > src/types/database.ts

# Deploy Edge Functions (--no-verify-jwt required: gateway JWT validation is
# disabled; each function validates auth internally via edge-helpers.ts)
npx supabase functions deploy chat --no-verify-jwt
npx supabase functions deploy build --no-verify-jwt
npx supabase functions deploy generate-design-system --no-verify-jwt
npx supabase functions deploy generate-page --no-verify-jwt
npx supabase functions deploy edit-section --no-verify-jwt
npx supabase functions deploy publish --no-verify-jwt
npx supabase functions deploy delete-site --no-verify-jwt
npx supabase functions deploy invite --no-verify-jwt
npx supabase functions deploy invite-instructor --no-verify-jwt
npx supabase functions deploy design-chat --no-verify-jwt

# Lint
npx eslint src/

# Format
npx prettier --write src/
```

## Constraints

### Performance
- PWA admin shell: < 2s initial load, offline-capable for cached content
- Generated static sites: < 1s first contentful paint
- Generated sites target Lighthouse 95+ across all four categories

### Accessibility
- All generated sites must meet WCAG 2.1 AA
- Admin PWA should meet WCAG 2.1 AA where practical
- Colour contrast ratios validated at build time for generated sites
- See accessibility tree in `uk-doula-website-research.md` section 6 for semantic structure

### Browser Support
- Admin PWA: latest 2 versions of Chrome, Safari, Firefox, Edge
- Generated static sites: same + graceful degradation for older browsers (no JS required for content)

### Security
- API keys (Claude, Netlify, Supabase service role) never exposed to client
- All external API calls proxied through Supabase Edge Functions
- RLS policies on every table — no public access without auth
- Magic link tokens expire after 1 hour
- Instructor Claude API keys encrypted at rest in Supabase
- LLM output sanitised: HTML stripped of scripts/event handlers/dangerous URLs, CSS stripped of breakouts/imports/expressions
- CSP meta tags on all generated pages block inline scripts and foreign resources
- Edge Function body size validation (1MB max) prevents memory exhaustion
- DB-backed rate limiting survives cold starts (in-memory Maps do not)
- Editor iframe sandboxed with empty `sandbox=""` (no `allow-same-origin`)
- See `SECURITY.md` for full audit trail and `SECURITY_REVIEW.md` for detailed findings

### SEO (generated sites)
- Semantic HTML5 with proper landmark roles
- Unique meta title and description per page
- Open Graph and Twitter Card tags
- Schema.org LocalBusiness JSON-LD
- Auto-generated sitemap.xml and robots.txt
- `<html lang="en-GB">`

### Multi-Tenancy
- Every database query must be scoped by tenant_id
- RLS policies enforce tenant isolation
- Students cannot see other students' data, even within the same session
- Instructors can read (not write) student specs within their tenant only
