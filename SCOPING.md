# SCOPING.md — BirthBuild

**Project:** BirthBuild — AI-powered static website builder for birth workers
**Client:** Dopamine Labs (portfolio project, IP retained by Andy Isherwood)
**First deployment:** Doula website workshop instructor (single client, multi-tenant architecture)
**Date:** February 2026

---

## 1. Product Summary

BirthBuild is a PWA platform that enables non-technical birth workers (doulas, midwives, antenatal educators) to create professional static websites through a guided chatbot conversation or a form-based dashboard. An instructor creates a session, invites students via magic link, and monitors their progress from an admin dashboard. The chatbot gathers preferences and content, produces a structured site specification, and triggers a MAI build pipeline that generates and deploys a static site to a provisioned subdomain.

### Core Loop

```
Instructor creates session
  → Students join via magic link
    → Chatbot guides them through site preferences & content
      → Structured site spec saved to Supabase
        → MAI builds static site from spec
          → Site deployed to [slug].birthbuild.com
            → Student reviews live preview
              → Edits via chatbot or dashboard
                → MAI rebuilds → redeploy
```

---

## 2. User Roles

### Student (birth worker building their site)

- Authenticates via magic link (email-based, no password)
- Accesses chatbot onboarding flow
- Accesses dashboard to view/edit site spec fields directly
- Previews generated site
- Requests edits via chatbot or dashboard
- Can return later via new magic link to resume/edit

### Instructor

- Authenticates via magic link (same auth system, elevated role)
- Creates and manages workshop sessions
- Invites students to sessions (generates magic links)
- Views all student sites in their session(s) — progress status, preview links
- Can view (read-only) any student's site spec for feedback purposes
- Manages their own API billing (Claude API key stored securely)

### Platform Admin (Andy / Dopamine Labs)

- Manages instructor accounts (tenant provisioning)
- Platform-level configuration
- Billing/usage monitoring
- Not in V1 UI — direct Supabase access is fine initially

---

## 3. Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend (PWA)** | React + Vite + Tailwind | Fast, offline-capable shell, familiar stack |
| **Backend/API** | Supabase Edge Functions (Deno) | Serverless, co-located with data, generous free tier |
| **Database** | Supabase Postgres | Relational, RLS for multi-tenancy, real-time subscriptions |
| **Auth** | Supabase Auth (magic link) | Built-in, email-based, no password management |
| **Storage** | Supabase Storage | Photo uploads, generated site assets |
| **AI** | Claude API (Anthropic) | Content generation, chatbot conversation |
| **Site Build** | MAI pipeline | Generates static HTML/CSS/JS from site spec |
| **Site Hosting** | Netlify | Auto-provisioned subdomains, deploy via API |
| **Domain** | birthbuild.com | Wildcard DNS → Netlify |

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    PWA Frontend                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Chatbot  │  │  Dashboard   │  │ Instructor Admin  │ │
│  │   View   │  │  (form edit) │  │   (sessions/      │ │
│  │          │  │              │  │    students)       │ │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘ │
│       │               │                   │             │
│       └───────────────┼───────────────────┘             │
│                       │                                 │
│              Same data model                            │
└───────────────────────┼─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 Supabase Backend                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │   Auth   │  │ Postgres │  │     Storage         │   │
│  │  (magic  │  │  (specs, │  │  (photos, assets)   │   │
│  │   link)  │  │  users,  │  │                     │   │
│  │          │  │  tenants)│  │                     │   │
│  └──────────┘  └──────────┘  └────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Edge Functions                          │  │
│  │  • /api/chat        → Claude API proxy            │  │
│  │  • /api/build       → Site generation + deploy    │  │
│  │  • /api/publish     → Publish/unpublish (domain)  │  │
│  │  • /api/delete-site → Cleanup site + Netlify      │  │
│  │  • /api/invite      → Magic link invites          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Build Pipeline                          │
│                                                         │
│  Site Spec (JSON) → MAI Build → Static HTML/CSS/JS      │
│                                  │                      │
│                                  ▼                      │
│                          Netlify Deploy API              │
│                          [slug].birthbuild.com           │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

### Tenants (instructors)

```sql
create table tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- "Jane's Doula Academy"
  owner_id      uuid references auth.users(id),
  claude_api_key text,                            -- encrypted, per-tenant billing
  plan          text default 'free',              -- future: free/pro/enterprise
  settings      jsonb default '{}',               -- tenant-level config
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

### Sessions (workshop instances)

```sql
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  name          text not null,                    -- "Spring 2026 Cohort"
  status        text default 'active',            -- active/archived
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

### Users (students)

```sql
create table profiles (
  id            uuid primary key references auth.users(id),
  email         text not null,
  display_name  text,
  role          text default 'student',           -- student/instructor/admin
  tenant_id     uuid references tenants(id),
  session_id    uuid references sessions(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

### Site Specs (the core data object)

```sql
create table site_specs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  tenant_id       uuid references tenants(id),
  session_id      uuid references sessions(id),
  status          text default 'draft',           -- draft/building/preview/live/error
  
  -- Business info
  business_name   text,
  doula_name      text,
  tagline         text,
  service_area    text,
  services        jsonb default '[]',             -- [{type, title, description, price}]
  
  -- Contact
  email           text,
  phone           text,
  booking_url     text,
  social_links    jsonb default '{}',             -- {instagram, facebook, ...}
  
  -- Content
  bio             text,
  philosophy      text,
  testimonials    jsonb default '[]',             -- [{quote, name, context}]
  faq_enabled     boolean default true,
  blog_enabled    boolean default false,
  
  -- Design
  style           text default 'modern',          -- modern/classic/minimal
  palette         text default 'sage_sand',        -- sage_sand/blush_neutral/deep_earth/ocean_calm/custom
  custom_colours  jsonb,                           -- {background, primary, accent, text, cta}
  typography      text default 'modern',           -- modern/classic/mixed
  font_heading    text,
  font_body       text,
  
  -- Accreditation
  doula_uk        boolean default false,
  training_provider text,
  
  -- SEO
  primary_keyword text,
  
  -- Pages to generate
  pages           jsonb default '["home","about","services","contact"]',
  
  -- Deployment
  subdomain_slug  text unique,                    -- "shellie-poulter"
  netlify_site_id text,
  preview_url     text,                            -- "https://birthbuild-shellie-poulter.netlify.app"
  deploy_url      text,                           -- "https://shellie-poulter.birthbuild.com" (set on publish)
  
  -- Chat history (for context continuity)
  chat_history    jsonb default '[]',
  
  -- Metadata
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### Photo uploads

```sql
create table photos (
  id            uuid primary key default gen_random_uuid(),
  site_spec_id  uuid references site_specs(id) on delete cascade,
  storage_path  text not null,                    -- Supabase Storage path
  purpose       text,                             -- 'headshot', 'hero', 'gallery'
  alt_text      text,
  sort_order    int default 0,
  created_at    timestamptz default now()
);
```

### Row Level Security

```sql
-- Students can only see/edit their own site spec
alter table site_specs enable row level security;

create policy "students_own_specs" on site_specs
  for all using (auth.uid() = user_id);

-- Instructors can read all specs in their tenant
create policy "instructors_read_tenant" on site_specs
  for select using (
    tenant_id in (
      select id from tenants where owner_id = auth.uid()
    )
  );
```

---

## 5. Feature Breakdown

### 5.1 Authentication (Magic Link)

- Email-based magic link via Supabase Auth
- No password, no OAuth complexity
- Instructor creates session → generates invite links with embedded session/tenant context
- Magic link click → auto-creates profile + associates with tenant/session
- Return visits: enter email → receive new magic link → resume where you left off
- Session token stored in PWA for offline-capable shell

### 5.2 Chatbot (Student Onboarding)

The chatbot is a Claude-powered conversation that follows the question flow from the research report, writing structured data to the site_spec as it goes.

**System prompt responsibilities:**
- Follow the question sequence (basics → style → content → practical → review)
- Write each answer to the appropriate site_spec field via function calling
- Offer AI content generation at each content step ("Would you like me to draft your bio based on what you've told me?")
- Show visual previews inline where possible (colour swatches, font pairs)
- Use British English throughout
- Never suggest medical language
- Follow the client's lead on inclusive language
- Stay on-task — politely redirect off-topic conversation

**Claude integration:**
- Proxied through Supabase Edge Function (never expose API key to client)
- Uses instructor's tenant-level API key
- Conversation history persisted in site_spec.chat_history for continuity
- System prompt includes the research report findings as context
- Function calling schema maps to site_spec fields

**Content generation features:**
- Bio/about text from prompts ("Tell me in a few sentences how you became a doula")
- Service descriptions from service type selection
- Tagline suggestions from business name + service area
- FAQ auto-generation (standard doula FAQ from research)
- SEO meta descriptions
- All generated content is editable — never locked in

### 5.3 Dashboard (Form-Based Editor)

A visual editor that reads/writes the same site_spec the chatbot does.

**Layout:** Tabbed or stepped form matching the spec structure:

```
Tabs:
├── Business Details      (name, tagline, service area, services)
├── Design                (style, palette, typography — with live swatches)
├── Content               (bio, testimonials, FAQ toggle)
├── Photos                (upload headshot, hero image)
├── Contact & Social      (email, phone, booking URL, social links)
├── SEO                   (primary keyword, auto-generated suggestions)
└── Preview & Publish     (live preview iframe, deploy button)
```

**Key UX details:**
- Each field shows whether it was filled by chatbot or manually
- "Ask AI" button next to text fields for on-demand content generation
- Colour palette selector shows the 4 preset palettes as visual swatches
- Typography selector shows live font pair previews
- Real-time save (debounced writes to Supabase)
- Progress indicator showing completion percentage

### 5.4 Wordmark Logo Generation

V1 scope — no image-based logos. Generate a CSS/SVG wordmark from:
- Business name or doula name
- Selected heading font
- Selected primary colour
- Style variants: plain text, with a subtle divider, with an icon character (♡, ✦, ◌)

Generated as inline SVG in the site template. Upgradeable to a proper logo module later.

### 5.5 MAI Build Pipeline

**Trigger:** Student clicks "Build My Site" or "Rebuild" from dashboard.

**Input:** site_spec JSON from Supabase.

**Process:**
1. Edge Function validates spec completeness (minimum: business_name, doula_name, service_area, at least one service, email)
2. MAI receives spec + template context + research report design guidelines
3. MAI generates static HTML/CSS/JS:
   - Semantic HTML following the accessibility tree from research report
   - CSS using selected palette, typography, and style
   - Responsive (mobile-first)
   - WCAG 2.1 AA compliant
   - All 4–7 pages as defined in spec
   - Contact form (Netlify Forms or Formspree for static handling)
   - Wordmark logo as inline SVG
   - SEO meta tags, sitemap.xml, robots.txt
   - Open Graph tags for social sharing
4. Built assets uploaded to Supabase Storage
5. Deployed to Netlify via Deploy API

**Build status:** draft → building → preview → live / error
- Builds land in `preview` status (Netlify site, no custom domain)
- Explicit publish action adds the custom domain and transitions to `live`
- Unpublish removes the custom domain and returns to `preview`
- Rebuilds while `live` preserve the live status
- Real-time status updates via Supabase Realtime subscriptions
- Error state includes human-readable message

### 5.6 Deployment (Netlify)

**Provisioning flow:**
1. Student chooses subdomain slug (auto-suggested from doula name, editable)
2. Uniqueness checked against site_specs.subdomain_slug
3. Netlify site created via API on first build
4. DNS: wildcard CNAME `*.birthbuild.com` → Netlify
5. Subsequent builds deploy to same Netlify site
6. Custom domain mapping: future feature (Netlify supports this via API)

**Netlify free tier considerations:**
- 100GB bandwidth/month (more than sufficient for doula sites)
- 300 build minutes/month (each static deploy is seconds, not a build)
- Deploy via API using zip upload (no git integration needed)
- Forms: 100 submissions/month on free tier (adequate for most doulas)

### 5.7 Instructor Admin Dashboard

**Session management:**
- Create new session (name, optional date range)
- Generate bulk invite links (paste list of student emails)
- Archive completed sessions

**Student overview:**
- Table view: name, email, site status (draft/building/preview/live), completion %, preview link
- Click into any student → read-only view of their site spec
- Filterable by session

**Instructor sites ("My Sites"):**
- Instructors can create and manage their own sites (demos, personal doula sites)
- Multiple sites per instructor (no uniqueness guard)
- Full chat + dashboard flow, same as students
- Publish/unpublish and delete from the admin "My Sites" page

**Usage/billing:**
- Claude API token usage per session
- Total builds triggered
- Active sites count

### 5.8 Edit Flow (Post-Launch)

Once a site is live, the student can return and:
- Open chatbot: "I want to change my tagline" → chatbot updates spec field → triggers rebuild
- Open dashboard: edit field directly → save → click "Rebuild"
- Both paths result in the same outcome: updated spec → MAI rebuild → Netlify redeploy

---

## 6. Chatbot Question Flow (Detailed)

This is the guided conversation the chatbot follows. Each step maps to site_spec fields.

```
STEP 1: WELCOME
  "Hi! I'm here to help you build your website. Let's start with the basics."

STEP 2: BUSINESS BASICS
  → "What's your business name?" → business_name
  → "And your full name?" → doula_name
  → "Where are you based and what areas do you cover?" → service_area
  → "What services do you offer?"
    [Birth Doula] [Postnatal Doula] [Both] [Other]
    → services[]

STEP 3: STYLE DIRECTION
  → "Do you have a website you love the look of? 
     You can paste a URL or describe what you like."
     (Informational — feeds into style/palette selection)
  → "Which of these feels most like you?"
    [Modern & Clean] [Classic & Warm] [Minimal & Calm]
    → style
  → "Pick a colour palette:"
    [🌿 Sage & Sand] [🌸 Blush & Neutral] [🏺 Deep Earth] [🌊 Ocean Calm]
    (Show hex swatches inline)
    → palette
  → "Typography preference?"
    [Sans-serif (friendly, modern)] [Serif (warm, established)] [Mix of both]
    → typography

STEP 4: CONTENT
  → "Tell me a bit about yourself — how did you become a doula? 
     Just a few sentences is fine, I can help polish it."
    (If they provide notes → AI generates polished bio)
    (If they paste full text → store as-is)
    → bio
  → "Do you have any client testimonials? 
     You can paste them here or add them later."
    → testimonials[]
  → "What about pricing — do you want to show prices on your site?"
    [Yes, here they are] [Not yet, I'll add later]
    → services[].price
  → "Would you like a standard FAQ section? 
     I'll generate common doula questions for your area."
    [Yes please] [No thanks]
    → faq_enabled

STEP 5: PHOTOS
  → Claude calls trigger_photo_upload tool → inline upload panel appears
  → Panel supports: Headshot, Hero Image, Gallery (up to 6)
  → User uploads directly in chat flow via PhotoUploadPanel component
  → User clicks "Done with photos" → chat resumes
  → Photos stored in Supabase Storage → photos[] table

STEP 6: CONTACT & PRACTICAL
  → "What's the best email for enquiries?" → email
  → "Phone number? (optional)" → phone
  → "Do you use a booking tool like Calendly?" → booking_url
  → "Social media links?" → social_links
  → "Are you a Doula UK member?" → doula_uk
  → "Which training provider did you train with?" → training_provider

STEP 7: REVIEW & COMPLETE
  → "Here's a summary of your site:"
    (Display structured summary of all fields)
  → When all steps complete, CompletionCard is shown:
    - Green checkmark + "Your site information is ready!"
    - Summary grid: business name, services count, style/palette, contact
    - Buttons: "Upload Photos" (→ /dashboard?tab=photos) and "Go to Dashboard"
  → User proceeds to dashboard to build and preview their site
```

---

## 7. Pages Generated per Site

### Home
- Hero: heading (h1), tagline, CTA button
- "What is a doula?" section (auto-generated, editable)
- Services overview cards (from spec)
- Featured testimonial (first from list)
- About teaser with photo
- CTA section

### About
- Full bio text
- Professional photo
- Philosophy (if provided)
- Qualifications / accreditation badges
- CTA to contact

### Services
- Card or section per service
- Description, what's included
- Pricing (if provided)
- CTA per service

### Testimonials (if enabled)
- All testimonials with attribution
- Styled as blockquotes

### FAQ (if enabled)
- Auto-generated standard doula FAQ
- Localised to service area
- Expandable accordion pattern

### Contact
- Contact form (Netlify Forms)
- Email, phone (if provided)
- Booking link (if provided)
- Service area map or text
- Social links

### Blog (if enabled, future)
- Placeholder page with "Coming soon" or first post
- Static blog engine (markdown → HTML at build time)

---

## 8. Non-Functional Requirements

### Performance
- Generated sites: < 1s first contentful paint (static HTML, minimal JS)
- Lighthouse score target: 95+ across all categories
- PWA admin shell: < 2s initial load, offline-capable for cached content

### Accessibility
- All generated sites meet WCAG 2.1 AA
- Semantic HTML landmark structure as defined in research report
- Colour contrast validated at build time
- Skip navigation link
- All images require alt text (enforced in spec)
- Forms have associated labels
- Keyboard navigable throughout

### Security
- API keys never exposed to client (Edge Function proxy)
- Claude API key encrypted at rest in Supabase
- RLS enforced on all tables
- Magic links expire after 1 hour
- No PII stored beyond email and site content
- GDPR: privacy policy template auto-included in generated sites

### SEO (generated sites)
- Semantic HTML5
- Meta title and description per page
- Open Graph tags
- Sitemap.xml
- robots.txt
- Schema.org LocalBusiness markup
- `<html lang="en-GB">`

---

## 9. V1 Scope Boundaries

### In Scope
- Magic link auth (student + instructor roles)
- Chatbot onboarding flow (Claude-powered)
- Dashboard form editor (read/write same data as chatbot)
- AI content generation (bio, tagline, service descriptions, FAQ)
- Photo upload (headshot, hero)
- Wordmark logo generation (CSS/SVG)
- 4 colour palette presets + custom option
- MAI build pipeline → static HTML/CSS/JS
- Netlify auto-deploy with subdomain provisioning
- Instructor admin: sessions, student overview, read-only spec view
- Multi-tenant architecture (tenant = instructor)
- Edit/rebuild flow (chatbot or dashboard)
- WCAG 2.1 AA compliant output
- British English throughout

### Out of Scope (V2+)
- Image-based logo design module
- Custom domain mapping (Netlify supports it, just not wired up yet)
- Blog engine (markdown → HTML)
- Analytics dashboard (could embed Plausible or similar)
- E-commerce / payment integration
- Template marketplace
- Instructor can edit student's spec directly (V1 is read-only)
- White-label option (custom branding per tenant)
- Student billing / subscription management
- A/B testing for generated sites
- iOS native app

---

## 10. Build Phases

### Phase 1 — Foundation (Week 1)
- Supabase project setup: tables, RLS policies, auth config
- PWA shell: React + Vite + Tailwind + routing
- Magic link auth flow (sign up, sign in, role assignment)
- Basic data model CRUD for site_specs

### Phase 2 — Chatbot (Week 2)
- Claude API proxy Edge Function
- Chat UI component
- System prompt with question flow + function calling schema
- Chat → site_spec field mapping
- AI content generation (bio, tagline, FAQ)
- Chat history persistence

### Phase 3 — Dashboard (Week 2–3)
- Tabbed form editor reading/writing site_specs
- Colour palette visual selector
- Typography preview
- Photo upload to Supabase Storage
- Progress indicator
- "Ask AI" inline content generation buttons

### Phase 4 — Build & Deploy (Week 3)
- MAI integration: spec → static site generation
- Template system informed by research report
- Wordmark SVG generation
- Netlify Deploy API integration
- Subdomain provisioning
- Build status tracking (Supabase Realtime)
- Preview iframe in dashboard

### Phase 5 — Instructor Admin (Week 3–4)
- Session CRUD
- Student invite flow (bulk magic link generation)
- Student overview table
- Read-only spec viewer
- Usage metrics (API tokens, builds, active sites)

### Phase 6 — Polish & Test (Week 4)
- Edit/rebuild flow end-to-end
- WCAG audit on generated sites
- Lighthouse optimisation
- Error handling and edge cases
- Mobile responsive testing of admin PWA
- Real-user testing with instructor's students

---

## 11. Success Metrics

- A non-technical doula can go from zero to live website in under 30 minutes
- Generated sites score 95+ on Lighthouse (performance, accessibility, SEO, best practices)
- Instructor can onboard a cohort of 10+ students in a single session
- Edit → rebuild → redeploy cycle completes in under 3 minutes
- Zero technical support required from instructor or Andy for standard flows

---

## 12. Licensing Model

BirthBuild is owned by Dopamine Labs. The first instructor pays only for Claude API usage. The platform and all generated code remain Dopamine Labs IP.

**Future licensing tiers (V2+):**

| Tier | Includes | Price |
|------|----------|-------|
| **Free** | 1 session, 5 students, BirthBuild subdomain | £0 (they pay API costs) |
| **Pro** | Unlimited sessions/students, custom domain support, priority builds | £49/mo |
| **Enterprise** | White-label, custom templates, dedicated support | Custom |

---

*SCOPING.md — BirthBuild V1*
*Dopamine Labs — February 2026*
