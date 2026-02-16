# SCOPING.md — Natural Language Site Editor

**Product:** BirthBuild
**Platform:** PWA
**Date:** 17 February 2026
**Status:** Draft

---

## Problem

BirthBuild users can currently edit copy and content via the dashboard form editor, but have no way to customise visual presentation — colours, layout order, spacing, typography — without technical knowledge. The target audience (birth workers) won't engage with traditional design tools. They need to describe what they want in plain language and see it happen.

---

## Proposed Solution

A conversational editing interface within the existing dashboard that allows users to describe visual changes in natural language. Claude interprets requests against a constrained design system and applies changes to the site configuration. Users preview changes before rebuilding and deploying.

---

## Design Principles

1. **Constrained output, not free-form CSS.** Claude maps natural language to predefined design tokens (colour palette, spacing scale, typography options, layout order). This keeps sites consistently professional and prevents users from breaking their own designs.
2. **Preview before commit.** Every change renders a preview. Nothing deploys until the user approves.
3. **Conversational, not transactional.** Users can make multiple changes in a single chat session, refine iteratively ("actually a bit softer", "more space than that"), and see cumulative changes before rebuilding.
4. **Reversible.** Users can undo changes per-session or revert to their last deployed version at any time.

---

## Design System Constraints

The onboarding chatbot (Step 3) already captures initial style direction, colour palette, and typography preference. The natural language editor refines these choices post-onboarding. Claude maps user requests to values within these bounded parameters — it should never generate arbitrary CSS.

### Colour

- **Initial palette set during onboarding:** Sage & Sand, Blush & Neutral, Deep Earth, Ocean Calm
- **Chat refinement:** User can shift within the chosen palette ("a bit warmer", "softer pink") or switch palette entirely ("actually I want something more earthy")
- **Primary colour:** Adjustable within palette range or described in natural language — mapped to nearest hex from curated set
- **Secondary colour:** Auto-generated complementary/analogous from primary
- **Background:** White, off-white, light tint of primary, or user-described ("creamy", "warm grey")
- **Text:** Dark grey or near-black (enforced for accessibility contrast)
- **Accent:** Derived from primary, used for CTAs and links

### Typography

- **Initial preference set during onboarding:** Sans-serif / Serif / Mix
- **Chat refinement:** User can request specific feels ("something more elegant", "friendlier") — Claude selects from curated font list within their serif/sans preference
- **Heading font:** Selection from curated list (e.g., Playfair Display, Lora, Montserrat, Raleway, DM Serif Display)
- **Body font:** Selection from curated list (e.g., Inter, Open Sans, Lato, Source Sans Pro)
- **Scale:** Small / Default / Large — controls base font size and heading ratios proportionally

### Style

- **Initial direction set during onboarding:** Modern & Clean / Classic & Warm / Minimal & Calm
- **Chat refinement:** User can shift direction ("actually something bolder", "tone it down") — Claude adjusts spacing, border radius, and colour intensity to match

### Spacing

- **Density:** Compact / Default / Relaxed / Spacious — controls section padding, element gaps, and margins proportionally via a spacing scale multiplier
- No pixel-level control exposed to users

### Layout

- **Section order:** Hero, About, Services, Testimonials, FAQ, Contact — reorderable
- **Hero style:** Full-width image / Split (image + text) / Text-only with background colour
- **Services layout:** Cards (grid) / List / Accordion
- **Navigation:** Top bar / Hamburger (mobile always hamburger)

### Images

- **Hero image display:** Cover / Contain / Circular crop
- **Border radius:** Sharp / Slightly rounded / Rounded / Circular — applied consistently across cards and images

---

## User Experience

### Entry Point

A "Chat with AI" or "Edit Design" button in the dashboard, positioned alongside the existing form editor tabs. The chat opens as a panel (desktop) or full-screen overlay (mobile).

### Chat Flow

1. User opens the editor chat
2. System message: "I can help you change how your site looks — colours, fonts, layout, spacing. Just describe what you'd like, or ask me to show you options."
3. User describes a change in natural language
4. Claude interprets the request, maps it to design tokens, and responds with:
   - What it understood ("I'll make the background a warm cream and increase the spacing between sections")
   - A rendered preview (inline iframe or screenshot)
5. User approves, refines, or rejects
6. Repeat for additional changes — changes accumulate within the session
7. User hits "Publish changes" to trigger a site rebuild and deploy

### Example Interactions

| User says | Claude maps to |
|---|---|
| "Make it feel warmer" | Shift primary palette toward warm tones, background to warm off-white |
| "More breathing room" | Spacing density: Default → Relaxed |
| "I want a more modern feel" | Typography: switch to sans-serif heading font (e.g., Montserrat), reduce border radius |
| "Put my about section first" | Section order: move About above Services |
| "The services should be in a list not cards" | Services layout: Cards → List |
| "Make the header text bigger" | Typography scale: Default → Large |
| "I don't like the green anymore, something more like sage" | Primary colour: map "sage" to curated sage hex value |
| "Undo that" | Revert last change in session |
| "Go back to how it was" | Revert to last deployed configuration |

### Edge Cases

- **Ambiguous requests** ("make it better") — Claude asks a clarifying question: "What feels off right now? The colours, the spacing, the layout?"
- **Out-of-scope requests** ("add a booking system") — Claude explains this isn't a design change and suggests contacting support or checking the roadmap
- **Accessibility violations** — if a colour change would break WCAG contrast, Claude warns and suggests an accessible alternative
- **Multiple changes in one message** ("make it warmer, more spacious, and put contact at the top") — Claude processes all three, shows combined preview

---

## Technical Approach

### Site Configuration Schema

Extend the existing site config (stored in Supabase) with a `design` object:

```json
{
  "design": {
    "colours": {
      "primary": "#B5838D",
      "secondary": "#E5989B",
      "background": "#FFF8F0",
      "text": "#2D2D2D",
      "accent": "#B5838D"
    },
    "typography": {
      "headingFont": "Playfair Display",
      "bodyFont": "Inter",
      "scale": "default"
    },
    "spacing": {
      "density": "default"
    },
    "layout": {
      "sectionOrder": ["hero", "about", "services", "testimonials", "faq", "contact"],
      "heroStyle": "split",
      "servicesLayout": "cards",
      "borderRadius": "slightly-rounded"
    }
  }
}
```

### Claude Integration

- Reuse existing Claude API proxy Edge Function
- System prompt instructs Claude to:
  - Interpret natural language design requests
  - Respond with a JSON patch to the `design` object
  - Include a human-readable summary of changes
  - Flag accessibility concerns
  - Never generate raw CSS
- Response format:

```json
{
  "summary": "I've warmed up the colour palette and added more space between sections.",
  "changes": {
    "colours.primary": "#B5838D",
    "colours.background": "#FFF8F0",
    "spacing.density": "relaxed"
  },
  "warnings": []
}
```

### Preview Rendering

- Design changes trigger a deploy preview build (same pipeline as production, deployed to a temporary preview URL)
- Preview URL displayed in the chat panel as a clickable link and/or inline iframe
- Preview deploys are ephemeral — cleaned up on session close or after approval
- On approval, promote preview to production deploy

### State Management

- **Session state:** Accumulated changes since chat opened (held in client memory)
- **Undo stack:** Array of previous states within the session, enabling per-change undo
- **Revert:** Pull last deployed config from Supabase and reset

### Page Generators

- Existing six page generators need to read from the `design` object
- CSS custom properties (variables) mapped from design tokens at build time:

```css
:root {
  --color-primary: #B5838D;
  --color-secondary: #E5989B;
  --color-background: #FFF8F0;
  --color-text: #2D2D2D;
  --font-heading: 'Playfair Display', serif;
  --font-body: 'Inter', sans-serif;
  --spacing-section: 4rem; /* derived from density */
}
```

---

## Dependencies

- Existing Claude API proxy Edge Function (reuse/extend)
- Existing page generators (extend to read design tokens)
- Existing site config schema in Supabase (extend with `design` object)
- Google Fonts CDN (for typography options)
- No new infrastructure required

---

## Out of Scope (This Phase)

- Drag-and-drop visual editing
- Custom CSS input
- Image editing or AI image generation
- Adding new page types or sections
- A/B testing or analytics on design changes
- Template marketplace

---

## Success Criteria

- User can change colours, typography, spacing, layout order, and component styles entirely through natural language
- No design change breaks WCAG AA contrast compliance
- Changes preview before deploy
- Full session undo and revert-to-deployed functionality
- Average chat-to-deploy flow under 5 minutes

---

## Known Risks

- **Preview build time** — deploy previews add a rebuild cycle per change. Mitigation: batch changes within a session, only trigger preview on explicit request or after a pause in conversation.
- **Preview deploy costs** — frequent preview deploys may consume Netlify build minutes. Mitigation: monitor usage, consider rate-limiting previews per session.
- **Claude interpretation accuracy** — ambiguous language ("make it pop") may frustrate users. Mitigation: Claude asks clarifying questions rather than guessing.
- **Design token coverage** — users may request changes outside the constrained system. Mitigation: clear system prompt boundaries, graceful "I can't do that yet" responses.
- **Colour mapping** — natural language colour descriptions ("sage", "dusty rose") are subjective. Mitigation: curated named colour palette with close matches, always show preview before committing.

---

## Estimated Effort

Given MAI and the existing infrastructure, this is a single-session build (~3-4 hours):

- Design config schema extension: Phase 1
- Claude system prompt and response parsing: Phase 2
- Chat UI panel in dashboard: Phase 3
- Preview rendering with iframe: Phase 4
- Undo/revert state management: Phase 5
- Page generator updates for design tokens: Phase 6

---

## Open Questions

1. Should design changes during a chat session batch into a single preview deploy, or should each change trigger its own preview? Batching is more efficient but adds a manual "preview now" step.
2. Should the deploy preview URL be persistent per session (overwritten on each change) or unique per change (allowing comparison between iterations)?
3. Cleanup policy for orphaned preview deploys — time-based expiry, or clean up on next session start?
