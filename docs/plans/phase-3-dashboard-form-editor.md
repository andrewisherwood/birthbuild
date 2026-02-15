# Phase Plan

**Project:** BirthBuild
**Generated:** 2026-02-15T18:20:00Z
**Total Phases:** 6

Phase 1: Foundation & Auth — COMPLETE (PR #1)
Phase 2: Chatbot Onboarding — COMPLETE (PR #2)
**Phase 3: Dashboard Form Editor — THIS PLAN**
Phase 4: Build Pipeline & Deploy — Pending
Phase 5: Instructor Admin — Pending
Phase 6: Polish & Integration Testing — Pending

---

# Detailed Plan: Phase 3 — Dashboard Form Editor

**Date:** 2026-02-15
**Status:** Planning
**Branch:** `phase-3-dashboard-form-editor`

## Overview

Replace the dashboard stub with a full tabbed form editor that reads and writes the same `site_spec` row as the chatbot. The dashboard provides direct field-level editing with visual selectors for design options (colour palettes, typography), photo upload to Supabase Storage, debounced saves, a progress indicator, and "Ask AI" buttons for content generation. All form fields use the existing `useSiteSpec` hook with optimistic updates.

## Pre-existing Code

- **Dashboard stub:** `src/routes/dashboard.tsx` — 10-line placeholder, needs full replacement
- **SiteSpec type:** `src/types/site-spec.ts` — complete type definition with all fields, subtypes (`ServiceItem`, `SocialLinks`, `Testimonial`, `CustomColours`, style/palette/typography option types)
- **useSiteSpec hook:** `src/hooks/useSiteSpec.ts` — `{ siteSpec, loading, error, updateSiteSpec, createSiteSpec }` with optimistic updates and rollback
- **useAuth hook:** `src/hooks/useAuth.ts` — `{ user, session, profile, role, loading }`
- **Claude client:** `src/lib/claude.ts` — `sendChatMessage({ messages })` calls Edge Function, returns `ClaudeResponse` with content blocks
- **UI primitives:** `src/components/ui/Button.tsx` (primary/secondary/outline, sm/md/lg, loading state), `Input.tsx` (labelled, error state, helper text), `Card.tsx`, `LoadingSpinner.tsx`
- **Chat Edge Function:** `supabase/functions/chat/index.ts` — hardcoded system prompt and tools, accepts `{ messages }` only
- **Supabase client:** `src/lib/supabase.ts` — typed Supabase client (`import { supabase }`)
- **Photos table:** `photos(id, site_spec_id, storage_path, purpose, alt_text, sort_order)` with RLS on `site_spec_id`
- **Routing:** `src/App.tsx` — `/dashboard` route wrapped in `ProtectedRoute`

## Architecture Rules (MUST follow)

1. **TypeScript strict mode** — no `any`, `noUnusedLocals`, `noUnusedParameters`
2. **Functional components only** — no class components
3. **Named exports** — no default exports except route pages
4. **Custom hooks** for Supabase interactions — components never call Supabase directly
5. **Tailwind only** — no inline styles, no CSS modules
6. **British English** in all user-facing copy — colour, organisation, labour, specialise
7. **Optimistic updates** — write to local state immediately, sync to Supabase, rollback on error
8. **Debounced saves** — 500ms after last keystroke, not on every change
9. **Accessible by default** — labels, ARIA attributes, keyboard navigable
10. **No dangerouslySetInnerHTML** — React-based rendering only (SEC-007 lesson)
11. **Generic error messages** to users, detailed logs to console (SEC-008 lesson)
12. **RLS enforced** — students see only their own data

## Loops

### Loop 1: Dashboard Shell, Tab Navigation & Debounce Hook

**Goal:** Replace the dashboard stub with a tabbed layout shell, progress indicator, and a reusable debounced save hook.

**Files to create:**
- `src/hooks/useDebouncedSave.ts` — Generic debounce wrapper around `updateSiteSpec`
- `src/components/dashboard/DashboardShell.tsx` — Outer layout: sidebar nav (or top tabs), content area, progress bar
- `src/components/dashboard/TabNav.tsx` — Tab navigation with 7 tabs
- `src/components/dashboard/ProgressIndicator.tsx` — Completion percentage based on filled fields

**Files to modify:**
- `src/routes/dashboard.tsx` — Replace stub with DashboardShell + tab routing

**Implementation details:**

1. **useDebouncedSave hook:**
   - Accepts `updateSiteSpec` from `useSiteSpec`
   - Returns `debouncedUpdate(partial: Partial<SiteSpec>)` that batches field changes
   - Uses `useRef` for timer, `useCallback` for stable reference
   - 500ms delay; resets timer on each call
   - Flushes pending changes on unmount via `useEffect` cleanup
   - Returns `{ debouncedUpdate, flushNow, isPending }` — `isPending` shows unsaved indicator

2. **DashboardShell:**
   - Full-height layout: top header bar + horizontal tab nav + content area
   - Header shows: business name (or "Untitled Site"), progress indicator, link to `/chat`
   - Content area renders the active tab's form section
   - Loading state while `useSiteSpec` fetches
   - Error state if fetch fails

3. **TabNav:**
   - 7 tabs: Business Details, Design, Content, Photos, Contact & Social, SEO, Preview & Publish
   - Active tab state managed via `useState` (local, no URL routing needed)
   - Each tab shows a completion dot (green if section has required fields filled)
   - Responsive: horizontal scroll on mobile, full bar on desktop
   - Accessible: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`

4. **ProgressIndicator:**
   - Calculates percentage from filled fields:
     - Required: business_name, doula_name, service_area, email (4 fields)
     - Optional but scored: tagline, bio, services.length > 0, phone, palette !== default, style !== default, typography !== default (7 fields)
     - Total: filled / 11 * 100
   - Renders a horizontal bar with percentage text
   - Green fill (#165e40)

5. **Dashboard page:**
   - Uses `useAuth` for user info
   - Uses `useSiteSpec` for data
   - Creates `useDebouncedSave` instance
   - Passes `siteSpec` and `debouncedUpdate` to each tab component via props
   - If no siteSpec exists and loading is done, show "Start with chatbot" prompt + link to `/chat`

**Acceptance criteria:**
- [ ] Dashboard renders with 7 tabs, first tab active by default
- [ ] Tab switching works via click and keyboard
- [ ] Progress bar shows 0% for empty spec, increases as fields are filled
- [ ] Loading spinner shown while siteSpec loads
- [ ] Debounce hook fires after 500ms of inactivity
- [ ] `npx tsc --noEmit` passes

---

### Loop 2: Business Details Tab

**Goal:** Implement the Business Details form section with text inputs and a dynamic services list.

**Files to create:**
- `src/components/dashboard/BusinessDetailsTab.tsx` — Business info form
- `src/components/dashboard/ServiceEditor.tsx` — Add/edit/remove services list

**Implementation details:**

1. **BusinessDetailsTab:**
   - Fields using the existing `Input` component:
     - Business Name (text, required)
     - Your Name (text, required) — maps to `doula_name`
     - Tagline (text, optional)
     - Service Area (text, required) — helper text: "e.g., Bristol and surrounding areas"
   - Each input's `onChange` calls `debouncedUpdate({ field: value })`
   - Values read from `siteSpec.business_name`, etc.
   - Shows `ServiceEditor` below the text fields

2. **ServiceEditor:**
   - Renders a list of existing services from `siteSpec.services`
   - Each service card shows: type, title, description, price
   - "Edit" button opens inline editing (all 4 fields)
   - "Remove" button deletes from array
   - "Add Service" button appends a new empty service
   - On any change, calls `debouncedUpdate({ services: updatedArray })`
   - Service types offered as suggestions: "Birth Doula", "Postnatal Doula", "Antenatal Education", "Hypnobirthing", "Other"

**Acceptance criteria:**
- [ ] All 4 text fields render with current values from siteSpec
- [ ] Editing a field triggers debounced save after 500ms
- [ ] Services can be added, edited, and removed
- [ ] Empty services array shows "No services added yet" prompt
- [ ] `npx tsc --noEmit` passes

---

### Loop 3: Design Tab — Style, Palette & Typography Selectors

**Goal:** Build visual selectors for style, colour palette, and typography with live previews.

**Files to create:**
- `src/components/dashboard/DesignTab.tsx` — Design section container
- `src/components/dashboard/StyleSelector.tsx` — 3 style cards (modern/classic/minimal)
- `src/components/dashboard/PaletteSelector.tsx` — 4 preset palettes + custom option with hex swatches
- `src/components/dashboard/TypographySelector.tsx` — 3 typography options with font pair previews
- `src/components/dashboard/CustomColourPicker.tsx` — 5 colour inputs for custom palette

**Implementation details:**

1. **StyleSelector:**
   - 3 clickable cards arranged horizontally
   - Each card: icon/illustration area, label ("Modern & Clean", "Classic & Warm", "Minimal & Calm"), brief description
   - Selected card has green border + checkmark
   - Calls `debouncedUpdate({ style: selected })` on click

2. **PaletteSelector:**
   - 4 preset palette cards + 1 "Custom" card
   - Each card shows 5 colour swatches (background, primary, accent, text, cta) as small circles/squares
   - Palette colour definitions (hardcoded constants):
     - `sage_sand`: { background: "#f5f0e8", primary: "#5f7161", accent: "#a8b5a0", text: "#2d2d2d", cta: "#5f7161" }
     - `blush_neutral`: { background: "#fdf6f0", primary: "#c9928e", accent: "#e8cfc4", text: "#3d3d3d", cta: "#c9928e" }
     - `deep_earth`: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a67c52", text: "#2b2b2b", cta: "#6b4c3b" }
     - `ocean_calm`: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#7ca5b8", text: "#2c3e50", cta: "#3d6b7e" }
   - Selected palette has green border + checkmark
   - When "Custom" is selected, show `CustomColourPicker` below
   - Calls `debouncedUpdate({ palette: selected })` on click

3. **CustomColourPicker:**
   - 5 colour inputs (native `<input type="color">`) with labels: Background, Primary, Accent, Text, CTA
   - Reads from `siteSpec.custom_colours` or defaults
   - On change: `debouncedUpdate({ custom_colours: { ...current, [field]: value } })`
   - Small preview area showing the 5 colours applied to a mock mini-layout

4. **TypographySelector:**
   - 3 cards showing font pair previews:
     - Modern: "Inter" (heading) + "Inter" (body) — clean sans-serif
     - Classic: "Playfair Display" (heading) + "Source Sans 3" (body) — serif + sans
     - Mixed: "DM Serif Display" (heading) + "Inter" (body) — mix
   - Each card shows a sample heading + body text in the actual fonts
   - Font CSS loaded via `<link>` to Google Fonts (or bundled)
   - Selected card has green border
   - On select: `debouncedUpdate({ typography: selected, font_heading: headingFont, font_body: bodyFont })`

**Acceptance criteria:**
- [ ] Style selector shows 3 options, current selection highlighted
- [ ] Palette selector shows 4 preset palettes as visual swatches
- [ ] Selecting "Custom" reveals colour picker inputs
- [ ] Typography selector shows 3 options with actual font rendering
- [ ] All selections persist via debounced save
- [ ] `npx tsc --noEmit` passes

---

### Loop 4: Content Tab with "Ask AI" Buttons

**Goal:** Build the content editing section with textareas, testimonials list, and inline AI content generation.

**Files to create:**
- `src/components/dashboard/ContentTab.tsx` — Content section container
- `src/components/dashboard/AskAiButton.tsx` — Reusable "Ask AI" button that generates content for a field
- `src/components/dashboard/TestimonialEditor.tsx` — Add/edit/remove testimonials
- `src/components/dashboard/TextareaField.tsx` — Labelled textarea with optional "Ask AI" button

**Implementation details:**

1. **TextareaField:**
   - Renders a `<textarea>` with label, optional error/helper text
   - Same styling as the existing `Input` component but multi-line
   - Props: `label, value, onChange, rows?, placeholder?, required?, helperText?, error?, showAskAi?, onAskAi?, askAiLoading?`
   - If `showAskAi` is true, renders `AskAiButton` inline next to the label

2. **AskAiButton:**
   - Small outline button with sparkle/wand icon (Unicode character, no icon library)
   - Props: `field: string, onGenerated: (content: string) => void, disabled?: boolean`
   - On click:
     - Calls `sendChatMessage` with a focused prompt: "Generate a [field] for a birth worker with the following details: [business_name], [service_area], [services]. Write in British English, warm and professional tone. Return only the content, no preamble."
     - The message array includes context from the current siteSpec (business name, services, service area)
     - Shows loading spinner while generating
     - Calls `onGenerated(text)` with the response text
     - Error handling: show toast/inline error on failure
   - Does NOT use the chat Edge Function's hardcoded system prompt (that's for the chat flow). Instead, sends a simple prompt without tool definitions.
   - **Note:** The current Edge Function hardcodes system prompt and tools. For "Ask AI" to work differently, we have two options:
     - Option A: Reuse the chat Edge Function as-is — the system prompt is fine for generating content, and Claude will return text content
     - Option B: Create a separate simple Edge Function
     - **Choose Option A** — the chat Edge Function works fine. Send messages with role "user" containing the generation prompt. Claude will respond with text content (it won't use tools unless the conversation context triggers it). The hardcoded system prompt is helpful context.

3. **ContentTab:**
   - TextareaField for Bio (4 rows, Ask AI enabled)
   - TextareaField for Philosophy (3 rows, Ask AI enabled)
   - Input for Tagline (single line, Ask AI enabled — use TextareaField with rows=1 or separate)
   - Toggle for FAQ (checkbox/switch): "Include a FAQ section on your website"
   - Toggle for Blog: "Include a blog section (coming soon)"
   - TestimonialEditor below

4. **TestimonialEditor:**
   - Similar pattern to ServiceEditor
   - Each testimonial shows: quote, client name, context
   - Add/edit/remove buttons
   - On change: `debouncedUpdate({ testimonials: updatedArray })`

**Acceptance criteria:**
- [ ] Bio, philosophy, and tagline fields render with current values
- [ ] "Ask AI" button generates content and populates the field
- [ ] Generated content can be edited after insertion
- [ ] FAQ and blog toggles work
- [ ] Testimonials can be added, edited, and removed
- [ ] All changes persist via debounced save
- [ ] `npx tsc --noEmit` passes

---

### Loop 5: Photos Tab — Upload to Supabase Storage

**Goal:** Implement photo upload with preview, alt text editing, and storage integration.

**Files to create:**
- `src/hooks/usePhotoUpload.ts` — Handle Supabase Storage uploads and photos table CRUD
- `src/components/dashboard/PhotosTab.tsx` — Photo upload section
- `src/components/dashboard/PhotoUploadCard.tsx` — Single photo upload area (drop zone + preview)

**Implementation details:**

1. **usePhotoUpload hook:**
   - Accepts `siteSpecId: string`
   - Fetches photos from `photos` table where `site_spec_id = siteSpecId`
   - `uploadPhoto(file: File, purpose: string, altText: string)`:
     - Validate file type (image/jpeg, image/png, image/webp) and size (max 5MB)
     - Generate storage path: `photos/{user_id}/{purpose}-{timestamp}.{ext}`
     - Upload to Supabase Storage bucket `photos` via `supabase.storage.from('photos').upload(path, file)`
     - Insert row in `photos` table: `{ site_spec_id, storage_path, purpose, alt_text, sort_order }`
     - Return the photo record
   - `deletePhoto(photoId: string)`:
     - Delete from `photos` table
     - Remove file from storage
   - `updatePhotoAltText(photoId: string, altText: string)`:
     - Update `alt_text` in `photos` table
   - `getPublicUrl(storagePath: string)`:
     - Returns public URL via `supabase.storage.from('photos').getPublicUrl(path)`
   - Returns `{ photos, loading, uploading, error, uploadPhoto, deletePhoto, updatePhotoAltText, getPublicUrl }`

2. **PhotosTab:**
   - Two upload sections: "Profile Photo" (purpose: `headshot`) and "Hero Image" (purpose: `hero`)
   - Below: "Additional Photos" section for gallery images
   - Each section renders a `PhotoUploadCard`
   - Shows existing photos with preview thumbnails

3. **PhotoUploadCard:**
   - If no photo: dashed border upload area with "Click or drag to upload" text
   - File input (`accept="image/jpeg,image/png,image/webp"`)
   - Upload progress indicator
   - If photo exists: thumbnail preview, alt text input, delete button
   - Alt text input: `Input` component with helper text "Describe this image for accessibility"
   - On alt text change: `updatePhotoAltText(id, text)` (debounced)

**Note:** The Supabase Storage bucket `photos` must exist. The migration doesn't create it. The dev agent should add a note that the bucket needs to be created via Supabase dashboard or a seed script. For now, the code should handle the bucket not existing gracefully (error message).

**Acceptance criteria:**
- [ ] Profile photo and hero image upload areas render
- [ ] File selection triggers upload to Supabase Storage
- [ ] Upload progress shown during transfer
- [ ] Uploaded photo shows as thumbnail preview
- [ ] Alt text can be edited
- [ ] Photos can be deleted
- [ ] File type and size validation (JPEG/PNG/WebP, max 5MB)
- [ ] `npx tsc --noEmit` passes

---

### Loop 6: Contact & Social Tab + SEO Tab

**Goal:** Build the remaining two form tabs for contact info, social links, accreditation, SEO, and page selection.

**Files to create:**
- `src/components/dashboard/ContactTab.tsx` — Contact info, social links, accreditation
- `src/components/dashboard/SeoTab.tsx` — SEO keyword and page selection
- `src/components/dashboard/ToggleSwitch.tsx` — Reusable accessible toggle component

**Implementation details:**

1. **ContactTab:**
   - Section: "Contact Information"
     - Email (Input, type="email", required)
     - Phone (Input, type="tel", optional)
     - Booking URL (Input, type="url", optional) — helper text: "e.g., your Calendly or Acuity link"
   - Section: "Social Media"
     - Instagram URL (Input, type="url")
     - Facebook URL (Input, type="url")
     - Twitter/X URL (Input, type="url")
     - LinkedIn URL (Input, type="url")
     - TikTok URL (Input, type="url")
     - Each reads from `siteSpec.social_links.{platform}`
     - On change: `debouncedUpdate({ social_links: { ...siteSpec.social_links, [platform]: value } })`
   - Section: "Accreditation"
     - ToggleSwitch: "Doula UK Member" — maps to `doula_uk`
     - Input: "Training Provider" — maps to `training_provider`

2. **SeoTab:**
   - Input: "Primary Keyword" — helper text: "The main search term you want to rank for (e.g., 'doula in Bristol')"
   - Section: "Pages to Generate"
     - Checkbox list for pages: Home (always on, disabled), About, Services, Contact, Testimonials, FAQ, Blog
     - Home is required and cannot be deselected
     - Each checkbox toggles the page name in `siteSpec.pages` array
     - On change: `debouncedUpdate({ pages: updatedArray })`

3. **ToggleSwitch:**
   - Accessible switch component: `role="switch"`, `aria-checked`
   - Props: `label: string, checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean`
   - Green when on (#165e40), gray when off
   - Keyboard accessible: Space/Enter to toggle

**Acceptance criteria:**
- [ ] All contact fields render and save
- [ ] Social links update the correct field in `social_links` object
- [ ] Doula UK toggle works
- [ ] SEO keyword saves
- [ ] Page checkboxes add/remove pages from array
- [ ] Home page cannot be deselected
- [ ] `npx tsc --noEmit` passes

---

### Loop 7: Preview & Publish Tab + Build Verification

**Goal:** Add the final tab with a spec summary and build/preview placeholder, then verify the entire dashboard compiles and renders.

**Files to create:**
- `src/components/dashboard/PreviewTab.tsx` — Spec summary + build button placeholder

**Implementation details:**

1. **PreviewTab:**
   - Section: "Site Summary" — read-only overview of all filled fields
     - Business: name, doula name, tagline, service area
     - Services count
     - Design: style, palette, typography
     - Content: bio (truncated), testimonials count, FAQ enabled/disabled
     - Photos: count uploaded
     - Contact: email, phone
     - Pages selected
   - Section: "Build Status"
     - Shows `siteSpec.status` (draft/building/live/error)
     - If draft: "Your site hasn't been built yet"
     - If live + deploy_url: link to live site
   - "Build My Site" button (disabled, placeholder for Phase 4)
     - Shows: "Build pipeline coming in the next update"
   - "Return to Chat" link → `/chat`

2. **Build verification:**
   - Run `npm run build` — must compile with 0 errors
   - Run `npx tsc --noEmit` — must pass strict TypeScript
   - Verify all 7 tabs render without runtime errors (manual check)
   - Verify debounced saves fire correctly (manual check)

**Acceptance criteria:**
- [ ] Preview tab shows summary of all filled fields
- [ ] Build button is present but disabled (Phase 4 placeholder)
- [ ] Status display works for all 4 states
- [ ] `npm run build` succeeds with 0 errors
- [ ] `npx tsc --noEmit` passes
- [ ] All 7 tabs navigate correctly
- [ ] Tab completion dots reflect filled fields

---

## Security Considerations

1. **Photo uploads:** Validate file type on the client AND rely on Supabase Storage policies. Never trust client-side validation alone. Storage bucket should have a file size limit.
2. **XSS in user content:** All form values are rendered via React JSX (automatic escaping). No `dangerouslySetInnerHTML` anywhere. Testimonial quotes and bio text are plain strings.
3. **RLS enforcement:** All Supabase queries go through the authenticated client. The `useSiteSpec` hook queries with `user_id = auth.uid()`. Photo queries use `site_spec_id` which is RLS-protected.
4. **Ask AI feature:** Reuses the existing chat Edge Function which has rate limiting, JWT validation, and generic error messages. No new attack surface.
5. **File upload path:** Use `user_id` in the storage path to namespace files per user. Never allow path traversal.
6. **Input validation:** Form inputs use appropriate `type` attributes (email, tel, url). Client-side validation is UX, not security — RLS and DB constraints are the true guards.

## Edge Cases

1. **No siteSpec exists:** User navigates to dashboard without going through chat first. Show a friendly prompt to start with the chatbot, or offer to create a blank spec.
2. **Concurrent edits:** User has chat open in one tab and dashboard in another. Both write to the same spec. `useSiteSpec` fetches once on mount — stale data is possible. Accept this for V1; the last write wins.
3. **Large photo uploads:** 5MB limit enforced client-side. Show clear error for oversized files.
4. **Missing Google Fonts:** If fonts fail to load, the typography preview should degrade gracefully to system fonts.
5. **Empty services/testimonials arrays:** Show helpful empty states with "Add your first..." prompts.
6. **Custom colours with bad contrast:** V1 does not validate contrast ratios in the custom picker. This is a Phase 6 concern.
7. **Supabase Storage bucket not created:** If the `photos` bucket doesn't exist, uploads will fail. The hook should catch this error and show "Photo upload is not available yet. Please contact your instructor."

## Sequencing Notes

- **Loop 1 must complete first** — all other loops depend on the shell, tabs, and debounce hook.
- **Loops 2–6 are independent** and could theoretically run in parallel, but should be done sequentially to avoid merge conflicts in DashboardShell (each loop adds a tab component import).
- **Loop 7 must be last** — it's the integration test and build verification.
- The "Ask AI" feature in Loop 4 depends on the existing `claude.ts` client — no new backend work needed.
- Photo upload in Loop 5 depends on Supabase Storage being available. If the bucket doesn't exist, the code should handle it gracefully.
