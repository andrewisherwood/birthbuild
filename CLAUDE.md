# CLAUDE.md — BirthBuild

## Project Overview

BirthBuild is an AI-powered static website builder for birth workers (doulas, midwives, antenatal educators). Non-technical users build professional websites through a guided chatbot conversation or a form-based dashboard. An instructor creates workshop sessions, invites students via magic link, and monitors progress. The chatbot gathers preferences and content, produces a structured site specification, and triggers a build pipeline that generates and deploys a static site to a provisioned subdomain on birthbuild.com.

See `SCOPING.md` for full product specification including data model, feature breakdown, and build phases.
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
│   │   ├── claude.ts              # Claude API call helpers (via Edge Function)
│   │   ├── chat-prompts.ts        # System prompts and step definitions for chat
│   │   ├── chat-tools.ts          # Tool definitions and spec-update mapping
│   │   ├── site-generator.ts      # Static site HTML/CSS generation
│   │   ├── wordmark.ts            # SVG wordmark logo generation
│   │   ├── invite.ts              # Invite link helpers
│   │   └── palettes.ts            # Colour palette definitions
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth state, sign in/out, profile
│   │   ├── useSiteSpec.ts         # CRUD for site_specs (optional siteId for multi-site)
│   │   ├── useChat.ts             # Chat state, message sending, step tracking
│   │   ├── useBuild.ts            # Build status tracking via Supabase Realtime
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
│   │   └── 003_preview_publish.sql # Adds "preview" status + preview_url column
│   ├── functions/
│   │   ├── chat/index.ts          # Claude API proxy + tool calling
│   │   ├── build/index.ts         # Site generation + Netlify deploy (preview first)
│   │   ├── publish/index.ts       # Publish (add custom domain) / unpublish
│   │   ├── delete-site/index.ts   # Delete site (Netlify + storage + DB cleanup)
│   │   └── invite/index.ts        # Generate magic link invites
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

# Deploy Edge Functions
npx supabase functions deploy chat
npx supabase functions deploy build
npx supabase functions deploy publish
npx supabase functions deploy delete-site
npx supabase functions deploy invite

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
