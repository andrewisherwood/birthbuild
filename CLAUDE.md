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
│   │   ├── chat.tsx               # Chatbot onboarding
│   │   ├── dashboard.tsx          # Student form editor
│   │   ├── preview.tsx            # Site preview iframe
│   │   └── admin/
│   │       ├── sessions.tsx       # Instructor session management
│   │       └── students.tsx       # Instructor student overview
│   ├── components/
│   │   ├── ui/                    # Reusable primitives (Button, Input, Card, etc.)
│   │   ├── chat/                  # Chat UI components
│   │   ├── dashboard/             # Dashboard form sections
│   │   └── admin/                 # Instructor admin components
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client init
│   │   ├── claude.ts              # Claude API call helpers (via Edge Function)
│   │   ├── netlify.ts             # Netlify deploy helpers (via Edge Function)
│   │   └── utils.ts               # Shared utilities
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSiteSpec.ts         # CRUD for site_specs table
│   │   ├── useChat.ts             # Chat state and message handling
│   │   └── useRealtime.ts         # Supabase realtime subscriptions
│   ├── types/
│   │   ├── database.ts            # Supabase generated types
│   │   └── site-spec.ts           # SiteSpec type definition
│   └── styles/
│       └── globals.css            # Tailwind directives + custom styles
├── supabase/
│   ├── config.toml
│   ├── migrations/                # SQL migration files
│   │   └── 001_initial_schema.sql
│   ├── functions/
│   │   ├── chat/index.ts          # Claude API proxy
│   │   ├── build/index.ts         # Trigger MAI build
│   │   ├── deploy/index.ts        # Netlify deploy
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
- **RLS enforced on every table** — no exceptions. Students see only their own data. Instructors see their tenant's data. Test this.
- **Chat history is append-only** — never mutate previous messages. New messages push to the array.
- **Build pipeline is async** — trigger returns immediately, status tracked via Supabase Realtime subscription on `site_specs.status`.

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
npx supabase functions deploy deploy
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
