# Implementation Brief

**Task:** Dashboard Form Editor
**Phase:** 3
**Branch:** `phase-3-dashboard-form-editor`
**PR Title:** `Phase 3: Dashboard Form Editor`
**Priority:** P0
**Created:** 2026-02-15T18:22:00Z
**Created by:** Coordinator

---

## Summary

Replace the dashboard stub (`src/routes/dashboard.tsx`) with a full tabbed form editor that reads and writes the same `site_spec` row as the chatbot. The dashboard provides direct field-level editing with visual selectors for design options (colour palettes, typography), photo upload to Supabase Storage, debounced saves (500ms), a progress indicator, and "Ask AI" buttons for AI content generation. 7 tabs: Business Details, Design, Content, Photos, Contact & Social, SEO, Preview & Publish.

## Architecture Rules (MUST follow)

1. **TypeScript strict mode** — no `any`, `noUnusedLocals`, `noUnusedParameters`
2. **Functional components only** — no class components
3. **Named exports** — no default exports except route pages (dashboard.tsx)
4. **Custom hooks** for Supabase interactions — components never call Supabase directly
5. **Tailwind only** — no inline styles, no CSS modules, no styled-components
6. **British English** in all user-facing copy — colour, organisation, labour, specialise
7. **Optimistic updates** — write to local state immediately, sync to Supabase, rollback on error
8. **Debounced saves** — 500ms after last keystroke via useDebouncedSave hook
9. **Accessible by default** — labels, ARIA attributes, keyboard navigable, role="tablist"
10. **No dangerouslySetInnerHTML** — React-based rendering only
11. **Generic error messages** to users, detailed logs to console.error()
12. **RLS enforced** — students see only their own data; never bypass RLS

---

## Implementation Steps

### Loop 1: Dashboard Shell, Tab Navigation & Debounce Hook

**Create:**
- `src/hooks/useDebouncedSave.ts` — Generic debounce wrapper around `updateSiteSpec`
  - Returns `{ debouncedUpdate, flushNow, isPending }`
  - 500ms delay, resets timer on each call
  - Flushes pending changes on unmount via `useEffect` cleanup
  - Uses `useRef` for timer, `useCallback` for stable reference

- `src/components/dashboard/DashboardShell.tsx` — Outer layout with header, tab nav, content area
  - Header: business name (or "Untitled Site"), progress indicator, link to `/chat`
  - Loading state while useSiteSpec fetches
  - Error state if fetch fails

- `src/components/dashboard/TabNav.tsx` — Tab navigation with 7 tabs
  - Tabs: Business Details, Design, Content, Photos, Contact & Social, SEO, Preview & Publish
  - Active tab state via `useState`
  - Completion dot per tab (green if section has required fields filled)
  - Responsive: horizontal scroll on mobile
  - Accessible: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`

- `src/components/dashboard/ProgressIndicator.tsx` — Completion percentage bar
  - Required fields (4): business_name, doula_name, service_area, email
  - Optional scored fields (7): tagline, bio, services.length > 0, phone, palette !== default, style !== default, typography !== default
  - Total: filled / 11 * 100, green fill (#165e40)

**Modify:**
- `src/routes/dashboard.tsx` — Replace stub with DashboardShell + tab routing
  - Uses useAuth, useSiteSpec, useDebouncedSave
  - If no siteSpec exists: show "Start with chatbot" prompt + link to `/chat`

### Loop 2: Business Details Tab

**Create:**
- `src/components/dashboard/BusinessDetailsTab.tsx` — Business info form
  - Fields: Business Name (required), Your Name/doula_name (required), Tagline, Service Area (required)
  - Each input onChange calls debouncedUpdate({ field: value })
  - Shows ServiceEditor below

- `src/components/dashboard/ServiceEditor.tsx` — Dynamic services list
  - List existing services from siteSpec.services
  - Each service: type, title, description, price (all editable inline)
  - Add/remove buttons
  - Service type suggestions: "Birth Doula", "Postnatal Doula", "Antenatal Education", "Hypnobirthing", "Other"
  - On change: debouncedUpdate({ services: updatedArray })

### Loop 3: Design Tab — Style, Palette & Typography Selectors

**Create:**
- `src/components/dashboard/DesignTab.tsx` — Design section container
- `src/components/dashboard/StyleSelector.tsx` — 3 style cards (modern/classic/minimal)
  - Clickable cards: label, description, green border when selected
  - debouncedUpdate({ style: selected })

- `src/components/dashboard/PaletteSelector.tsx` — 4 preset palettes + custom
  - Each card: 5 colour swatches (circles)
  - Palette colours (hardcoded):
    - sage_sand: { background: "#f5f0e8", primary: "#5f7161", accent: "#a8b5a0", text: "#2d2d2d", cta: "#5f7161" }
    - blush_neutral: { background: "#fdf6f0", primary: "#c9928e", accent: "#e8cfc4", text: "#3d3d3d", cta: "#c9928e" }
    - deep_earth: { background: "#f0ebe3", primary: "#6b4c3b", accent: "#a67c52", text: "#2b2b2b", cta: "#6b4c3b" }
    - ocean_calm: { background: "#f0f4f5", primary: "#3d6b7e", accent: "#7ca5b8", text: "#2c3e50", cta: "#3d6b7e" }
  - "Custom" option shows CustomColourPicker when selected
  - debouncedUpdate({ palette: selected })

- `src/components/dashboard/CustomColourPicker.tsx` — 5 colour inputs
  - Native `<input type="color">` for: Background, Primary, Accent, Text, CTA
  - Reads from siteSpec.custom_colours
  - debouncedUpdate({ custom_colours: { ...current, [field]: value } })

- `src/components/dashboard/TypographySelector.tsx` — 3 font pair options
  - Modern: Inter + Inter
  - Classic: Playfair Display + Source Sans 3
  - Mixed: DM Serif Display + Inter
  - Show sample heading + body text in actual fonts
  - Import Google Fonts via `<link>` elements in `<head>` (use useEffect to inject)
  - debouncedUpdate({ typography: selected, font_heading: heading, font_body: body })

### Loop 4: Content Tab with "Ask AI" Buttons

**Create:**
- `src/components/dashboard/ContentTab.tsx` — Content section container
  - TextareaField for Bio (4 rows, Ask AI)
  - TextareaField for Philosophy (3 rows, Ask AI)
  - TextareaField for Tagline (2 rows, Ask AI)
  - Toggle: "Include FAQ section"
  - Toggle: "Include blog section (coming soon)"
  - TestimonialEditor below

- `src/components/dashboard/TextareaField.tsx` — Labelled textarea
  - Same styling as Input component but multi-line
  - Props: label, value, onChange, rows?, placeholder?, required?, helperText?, error?, showAskAi?, onAskAi?, askAiLoading?
  - If showAskAi: renders AskAiButton inline next to label

- `src/components/dashboard/AskAiButton.tsx` — AI content generation button
  - Small outline button with sparkle character
  - On click: calls sendChatMessage({ messages: [{ role: "user", content: prompt }] })
  - Prompt includes context from siteSpec (business_name, service_area, services)
  - Shows loading spinner while generating
  - Calls onGenerated(text) with response text
  - Error: show inline error message

- `src/components/dashboard/TestimonialEditor.tsx` — Testimonials CRUD
  - List testimonials from siteSpec.testimonials
  - Each: quote (textarea), name (input), context (input)
  - Add/remove buttons
  - debouncedUpdate({ testimonials: updatedArray })

### Loop 5: Photos Tab — Upload to Supabase Storage

**Create:**
- `src/hooks/usePhotoUpload.ts` — Supabase Storage + photos table CRUD
  - Fetches photos for siteSpecId
  - uploadPhoto(file, purpose, altText): validate type (JPEG/PNG/WebP) + size (max 5MB), upload to Storage, insert photos row
  - deletePhoto(photoId): delete row + storage file
  - updatePhotoAltText(photoId, altText): update alt_text
  - getPublicUrl(storagePath): return public URL
  - Storage path: `photos/{user_id}/{purpose}-{timestamp}.{ext}`
  - Returns { photos, loading, uploading, error, uploadPhoto, deletePhoto, updatePhotoAltText, getPublicUrl }

- `src/components/dashboard/PhotosTab.tsx` — Photo upload section
  - Two sections: "Profile Photo" (headshot), "Hero Image" (hero)
  - Below: "Additional Photos" for gallery
  - Each section renders PhotoUploadCard

- `src/components/dashboard/PhotoUploadCard.tsx` — Single upload area
  - Empty: dashed border, "Click or drag to upload"
  - File input: accept="image/jpeg,image/png,image/webp"
  - Uploading: progress indicator
  - Uploaded: thumbnail, alt text input, delete button
  - Handle missing Storage bucket gracefully

### Loop 6: Contact & Social Tab + SEO Tab

**Create:**
- `src/components/dashboard/ContactTab.tsx` — Contact info form
  - Contact: email (required), phone, booking URL
  - Social: instagram, facebook, twitter, linkedin, tiktok URLs
  - Social reads from siteSpec.social_links.{platform}
  - On change: debouncedUpdate({ social_links: { ...siteSpec.social_links, [platform]: value } })
  - Accreditation: Doula UK toggle, training provider input

- `src/components/dashboard/SeoTab.tsx` — SEO and page selection
  - Primary keyword input
  - Page checkboxes: Home (always on, disabled), About, Services, Contact, Testimonials, FAQ, Blog
  - debouncedUpdate({ pages: updatedArray })

- `src/components/dashboard/ToggleSwitch.tsx` — Accessible toggle
  - role="switch", aria-checked, Space/Enter to toggle
  - Green when on (#165e40), gray when off
  - Props: label, checked, onChange, disabled?

### Loop 7: Preview & Publish Tab + Build Verification

**Create:**
- `src/components/dashboard/PreviewTab.tsx` — Spec summary + build placeholder
  - Read-only summary: all filled fields grouped by section
  - Build status display (draft/building/live/error)
  - "Build My Site" button (disabled — Phase 4 placeholder)
  - "Return to Chat" link → /chat

**Verify:**
- `npm run build` — 0 errors
- `npx tsc --noEmit` — passes
- All 7 tabs render and navigate
- Debounced saves fire correctly

---

## Files Summary

### Files to Modify
- `src/routes/dashboard.tsx` — Replace stub with full dashboard page

### Files to Create
- `src/hooks/useDebouncedSave.ts`
- `src/hooks/usePhotoUpload.ts`
- `src/components/dashboard/DashboardShell.tsx`
- `src/components/dashboard/TabNav.tsx`
- `src/components/dashboard/ProgressIndicator.tsx`
- `src/components/dashboard/BusinessDetailsTab.tsx`
- `src/components/dashboard/ServiceEditor.tsx`
- `src/components/dashboard/DesignTab.tsx`
- `src/components/dashboard/StyleSelector.tsx`
- `src/components/dashboard/PaletteSelector.tsx`
- `src/components/dashboard/CustomColourPicker.tsx`
- `src/components/dashboard/TypographySelector.tsx`
- `src/components/dashboard/ContentTab.tsx`
- `src/components/dashboard/TextareaField.tsx`
- `src/components/dashboard/AskAiButton.tsx`
- `src/components/dashboard/TestimonialEditor.tsx`
- `src/components/dashboard/PhotosTab.tsx`
- `src/components/dashboard/PhotoUploadCard.tsx`
- `src/components/dashboard/ContactTab.tsx`
- `src/components/dashboard/SeoTab.tsx`
- `src/components/dashboard/ToggleSwitch.tsx`
- `src/components/dashboard/PreviewTab.tsx`

---

## Acceptance Criteria

- [ ] Dashboard renders with 7 functional tabs
- [ ] All form fields read from and write to the same site_spec row as the chatbot
- [ ] Colour palette selector shows 4 preset palettes as visual hex swatches plus custom option
- [ ] Typography selector shows live font pair previews (heading + body)
- [ ] Photo upload works: file selected, uploaded to Supabase Storage, linked in photos table
- [ ] Debounced saves fire 500ms after last keystroke with optimistic UI
- [ ] Progress indicator shows completion percentage
- [ ] "Ask AI" buttons generate content for text fields
- [ ] All toggles (FAQ, blog, Doula UK) work
- [ ] Services and testimonials can be added, edited, removed
- [ ] TypeScript strict mode passes: `npx tsc --noEmit`
- [ ] Production build succeeds: `npm run build`

---

## Security Notes

1. **Photo uploads:** Validate file type (JPEG/PNG/WebP) and size (max 5MB) client-side. Storage bucket policies are the real guard. Use user_id in storage path to namespace files.
2. **No dangerouslySetInnerHTML** — all user content rendered via React JSX (automatic escaping)
3. **RLS enforcement** — all queries go through authenticated Supabase client. useSiteSpec queries with user_id = auth.uid(). Photos use site_spec_id which is RLS-protected.
4. **Ask AI** — reuses existing chat Edge Function with rate limiting, JWT validation, generic errors. No new attack surface.
5. **Generic errors** — never show raw Supabase/API errors to users. Log with console.error().
6. **No path traversal** — storage paths use user_id prefix, never accept user-controlled paths.

---

## Context

### Existing patterns to follow
- `src/hooks/useSiteSpec.ts` — optimistic update pattern with rollback
- `src/components/ui/Input.tsx` — labelled input with error state and accessibility
- `src/components/ui/Button.tsx` — variant/size/loading pattern
- `src/components/chat/StepIndicator.tsx` — step dots with completion state (reference for tab completion dots)
- `src/components/dashboard/ServiceEditor.tsx` should follow the same add/remove pattern as testimonials for consistency

### Key function locations
- `useSiteSpec().updateSiteSpec(partial)` — src/hooks/useSiteSpec.ts:60 — optimistic update with rollback
- `useSiteSpec().createSiteSpec()` — src/hooks/useSiteSpec.ts:95 — create new spec
- `useAuth()` — src/hooks/useAuth.ts — user, profile, role
- `sendChatMessage({ messages })` — src/lib/claude.ts:54 — Claude API proxy call
- `supabase` client — src/lib/supabase.ts — typed Supabase client

### Build command
```bash
npm run build && npx tsc --noEmit
```
