# SCOPING.md — BirthBuild Specification Density Module

**Project:** BirthBuild — Chatbot Elicitation Engine for High-Density Site Specs
**Parent:** BirthBuild V1 (birthbuild.com)
**Owner:** Dopamine Labs
**Date:** February 2026
**Status:** Ready for Build
**Depends on:** Existing chatbot onboarding (Phase 2 of original SCOPING.md)
**Feeds into:** Site generation pipeline, Agentic SEO module (SCOPING-AGENTIC-SEO.md)

---

## 1. Problem Statement

BirthBuild's chatbot collects the data needed to build a functional website. But functional and personal are different things. The current 7-step flow gathers what — business name, services, location, style — but doesn't dig into why, how, or who. The result is site specs with low specification density: enough to generate a competent site, not enough to generate one that feels like it belongs to the person.

A birth worker who says "I offer birth doula support in Brighton" gets a perfectly good site. But one who says "I specialise in home births for second-time parents, my approach centres on informed choice and physiological birth, I trained with Developing Doulas and I've supported 60+ families across Brighton, Hove and Lewes" gets a site that looks like a £1,500 design job. Same platform. Same templates. Same model. The difference is entirely in the spec.

The current flow asks roughly 15-20 questions across 7 steps. Most are single-shot — one question, one answer, move on. The chatbot doesn't follow up. It doesn't probe. It doesn't help the birth worker articulate things they wouldn't think to mention. The specification density of the average completed spec is low, and the generated output reflects it.

This module redesigns the chatbot conversation to be an elicitation engine — a system that draws out specificity through intelligent follow-ups, conditional branching, and guided reflection. The birth worker still thinks she's having a conversation. But by the end, she's produced a specification dense enough to generate a site that feels genuinely hers.

### The compounding effect

Specification density doesn't just improve design output. It improves everything downstream:

- **Copy quality:** The bio generation has more to work with. "Sarah trained with Developing Doulas in 2019 after her own transformative home birth experience" produces dramatically better copy than "Sarah is a doula."
- **Schema.org markup:** More specific data means richer structured data. `hasCredential`, `serviceType`, `areaServed` all get more granular values.
- **FAQ generation:** FAQs generated from a dense spec are specific and useful ("How much does a home birth doula in Brighton cost?") rather than generic ("What does a doula do?").
- **llms.txt:** More detail means a more informative llms.txt file, which means more AI search surface area.
- **AI search visibility:** Every specific detail — service type, philosophy, qualification, neighbourhood — is an entity that AI models can match against a user query.

One improvement in the chatbot cascades through the entire pipeline.

---

## 2. Design Principles

### 2.1 Conversation, not interrogation

The flow should feel like chatting with someone who's genuinely interested, not filling in a form with extra steps. Follow-ups should feel natural: "Oh interesting, what drew you to home births specifically?" not "Please specify your birth type specialisations."

### 2.2 Progressive disclosure

Don't front-load complexity. Start light (name, location, services), then deepen as the conversation builds rapport and the birth worker warms up. The deeper questions come after she's already talking freely.

### 2.3 Earned follow-ups

Every follow-up must be triggered by something the birth worker just said. If she mentions home births, ask about home births. If she doesn't, don't. The chatbot should feel responsive, not scripted. This means the follow-up logic is conditional on content, not position in the flow.

### 2.4 Opt-out friendly

Every deepening question should be skippable. "You can skip this if you'd prefer" or "We can always add this later from your dashboard." No birth worker should feel trapped in a conversation that's going deeper than she wants.

### 2.5 Show the payoff

When the chatbot elicits something specific, it should demonstrate value immediately. "Great — that detail about your VBAC specialism will really help your site stand out to families searching for that specifically." This teaches the birth worker that specificity is rewarded, which encourages more of it.

---

## 3. Current Flow vs Enhanced Flow

### 3.1 Current: Step 2 — Business Basics

```
Current:
  "What's your business name?" → business_name
  "And your full name?" → doula_name  
  "Where are you based and what areas do you cover?" → service_area
  "What services do you offer?" [Birth Doula] [Postnatal Doula] [Both] [Other] → services[]
```

Four questions. Four fields. Move on. This captures what but nothing about depth, breadth, or differentiation.

### 3.2 Enhanced: Step 2 — Business Basics + Depth

```
Enhanced:
  "What's your business name?" → business_name
  "And your full name?" → doula_name

  "Where are you based?" → primary_location ⭐
  
  FOLLOW-UP (always):
  "And which areas do you cover from there? Think about the towns, 
   neighbourhoods or regions a client might search for."
  → service_areas[] (multi-value)
  
  NUDGE (if they give only a city):
  "Some doulas cover quite a wide area — do you travel to surrounding 
   towns too? For example, if you're in Brighton, do you also cover 
   Hove, Lewes, Shoreham?"
  → expanded service_areas[]
  
  "What services do you offer?" 
  [Birth Doula] [Postnatal Doula] [Hypnobirthing] [Antenatal Classes] 
  [Placenta Services] [Breastfeeding Support] [Other]
  → services[] (expanded options)
  
  FOLLOW-UP (per service selected):
  Birth Doula selected →
    "What types of birth do you support?"
    [Home birth] [Hospital] [Birth centre] [Water birth] [VBAC] 
    [Caesarean birth companion] [All types]
    → services[birth_doula].birth_types[] ⭐
    
  Hypnobirthing selected →
    "Do you teach group classes, private sessions, or both?"
    [Group] [Private] [Both]
    → services[hypnobirthing].format ⭐
    
    "Which hypnobirthing programme do you teach?"
    [KGH] [Hypnobirthing Australia] [Calm Birth School] [My own course] [Other]
    → services[hypnobirthing].programme ⭐
    
  Any service selected →
    "Roughly how many families have you supported with {service}?"
    [Just starting out] [10-30] [30-60] [60-100] [100+]
    → services[].experience_level ⭐
```

Same starting questions. But the follow-ups pull out specifics that directly feed into better copy, richer schema, and more AI-searchable content.

### 3.3 Current: Step 4 — Content

```
Current:
  "Tell me a bit about yourself — how did you become a doula?"
  → bio (free text, often sparse)
```

One open-ended question. Most birth workers give 1-2 sentences. The AI then generates a bio from almost nothing.

### 3.4 Enhanced: Step 4 — Content (Guided Reflection)

```
Enhanced:
  "Let's build your About section. I'll ask a few questions and then 
   write it up for you — you can tweak anything afterwards."

  "What did you do before you became a doula?"
  → bio_previous_career ⭐
  
  "What made you decide to train as a doula? Was there a moment 
   or experience that sparked it?"
  → bio_origin_story ⭐
  
  "Who did you train with, and when?"
  → training_provider, training_year ⭐
  (moves from Step 6 — more natural here in narrative context)
  
  FOLLOW-UP (if training_provider given):
  "Have you done any additional training or CPD since qualifying? 
   Things like spinning babies, aromatherapy, rebozo, trauma-informed care?"
  → additional_training[] ⭐
  
  "How would you describe your approach in a sentence or two? 
   For example, some doulas focus on evidence-based information, 
   others on intuitive support, others on hypnobirthing techniques."
  → philosophy ⭐
  
  "What do your clients say about you most often? Not a specific 
   testimonial — just the thing that keeps coming up."
  → client_perception ⭐
  
  OPTIONAL (show the payoff):
  "One more if you're up for it — is there a birth or a family that 
   really stayed with you? Not names or details, just what made it 
   special. This kind of thing makes your About page feel really human."
  → signature_story ⭐
  
  GENERATION:
  "Here's a draft bio based on everything you've told me:"
  → AI generates bio from: bio_previous_career + bio_origin_story + 
     training_provider + training_year + additional_training + 
     philosophy + client_perception + signature_story
  → Much denser input = much better output
  
  "How does that feel? I can adjust the tone, add more detail, 
   or trim it down."
```

The birth worker answered 6-7 short questions instead of one big open-ended one. Each question is easy to answer. But the combined output is a spec fragment with enough density to generate a bio that reads like it was written by a human copywriter.

### 3.5 Enhanced: Step 4b — Testimonials (Guided Collection)

```
Current:
  "Do you have any client testimonials?"
  → testimonials[] (often empty or one-liners)

Enhanced:
  "Client testimonials make a huge difference to your site. 
   Do you have any you'd like to include?"
  [Yes, I'll paste some] [Not yet] [I need help collecting them]
  
  IF "I need help collecting them":
    "I can draft a message you can send to past clients asking for 
     a testimonial. Would that help?"
    [Yes please] [No, I'll sort it later]
    
    IF yes → generate testimonial request template:
    "Here's a message you could send. It asks them to mention 
     what type of birth you supported, where they're based, and 
     what specifically helped — those details make testimonials 
     much more powerful on your site and in search results."
    → testimonial_request_template ⭐ (for dashboard/email)
  
  IF "Yes, I'll paste some":
    → testimonials[]
    
    FOLLOW-UP (per testimonial):
    "Great one! Does this client mind me using their first name 
     and initial? And do you know what type of birth this was for? 
     Those details help with search visibility."
    → testimonials[].author_name ⭐
    → testimonials[].service_context ⭐ (e.g. "home birth in Lewes")
```

Testimonials with context ("Sarah supported our home birth in Lewes" vs "Amazing, 5 stars") are dramatically more valuable for both the site and for AI search.

### 3.6 Enhanced: Step 3 — Style Direction (Deepened)

```
Current:
  "Which of these feels most like you?"
  [Modern & Clean] [Classic & Warm] [Minimal & Calm] → style

Enhanced:
  "Which of these feels most like you?"
  [Modern & Clean] [Classic & Warm] [Minimal & Calm] → style
  
  FOLLOW-UP:
  "Is there a word or feeling you want someone to get when they 
   land on your site? For example: calm, professional, warm, 
   earthy, luxurious, friendly, clinical..."
  → brand_feeling ⭐
  
  "Do you have a website you love the look of? Doesn't have to 
   be a doula site — could be any website whose vibe matches yours."
  → style_inspiration_url ⭐
  (Already exists but moving to after style selection gives context)
```

`brand_feeling` is a lightweight input but a powerful generation signal. "Earthy and warm" vs "clean and professional" produces meaningfully different output from the same Sage & Sand palette.

---

## 4. New Data Fields

All new fields marked with ⭐ in the enhanced flows above. These extend the existing `site_specs` table.

### 4.1 Fields to Add

```sql
-- Business depth
primary_location        text,           -- "Brighton" (distinct from service area list)

-- Service depth (extend services JSONB)
-- services[].birth_types[]             -- ["home", "hospital", "vbac"]
-- services[].format                    -- "group" | "private" | "both"
-- services[].programme                 -- "KGH" | "Calm Birth School" | etc
-- services[].experience_level          -- "starting_out" | "10-30" | "30-60" | "60-100" | "100+"

-- Bio depth
bio_previous_career     text,
bio_origin_story        text,
training_year           text,
additional_training     text[],         -- ["spinning babies", "rebozo", "aromatherapy"]
philosophy              text,
client_perception       text,
signature_story         text,

-- Testimonial depth (extend testimonials JSONB)
-- testimonials[].author_name           -- "Emma R."
-- testimonials[].service_context       -- "home birth in Lewes"

-- Style depth
brand_feeling           text,           -- "earthy and warm"
style_inspiration_url   text,

-- Moved from Step 6 to Step 4 (narrative context)
-- training_provider already exists
-- training_year ⭐ new
```

### 4.2 Migration

```sql
alter table site_specs add column if not exists primary_location text;
alter table site_specs add column if not exists bio_previous_career text;
alter table site_specs add column if not exists bio_origin_story text;
alter table site_specs add column if not exists training_year text;
alter table site_specs add column if not exists additional_training text[];
alter table site_specs add column if not exists philosophy text;
alter table site_specs add column if not exists client_perception text;
alter table site_specs add column if not exists signature_story text;
alter table site_specs add column if not exists brand_feeling text;
alter table site_specs add column if not exists style_inspiration_url text;

-- services[] and testimonials[] are JSONB — extend schema, no migration needed
```

---

## 5. System Prompt Changes

The chatbot's system prompt needs to shift from "follow the question sequence" to "follow the question sequence with conditional depth probes." The key changes:

### 5.1 Elicitation Personality

Add to system prompt:

```
You are a friendly, curious website builder assistant. Your job is 
to help the birth worker build a website that genuinely represents 
them — not a generic template site.

You do this by asking thoughtful follow-up questions that draw out 
specific details. You never interrogate. You never make the 
conversation feel like a form. Every follow-up should feel like 
natural curiosity.

When the birth worker gives a specific detail, acknowledge it 
warmly and explain briefly why it matters: "That's great — 
mentioning your VBAC specialism will really help families 
searching for exactly that find you."

When the birth worker gives a vague answer, gently probe: 
"Could you tell me a bit more about that?" or offer examples: 
"For instance, some doulas focus on active birth, others on 
hypnobirthing — what's your approach?"

Always offer an opt-out: "Feel free to skip this one if you'd 
prefer — you can always add it later from your dashboard."

Never use medical terminology the birth worker hasn't used first.
Use British English throughout.
```

### 5.2 Follow-Up Decision Logic

The system prompt should include conditional follow-up rules:

```
FOLLOW-UP RULES:

After each answer, assess whether a follow-up would increase 
specification density. Apply follow-ups when:

1. The answer names a service → ask about subtypes, formats, 
   experience level
2. The answer names a location → ask about surrounding areas covered
3. The answer is a single sentence → gently ask for more detail
4. The answer mentions a specific approach/philosophy → ask what 
   that means to them in practice
5. The answer mentions training → ask about additional CPD, 
   specialisms developed since

Do NOT follow up when:
1. The answer is already specific and detailed
2. The birth worker has signalled she wants to move on
3. The question is about practical details (email, phone, booking URL)
4. You've already asked 2 follow-ups on the same topic

Maximum 2 follow-ups per topic area before moving on.
```

### 5.3 Payoff Signals

```
PAYOFF SIGNALS:

After eliciting a specific detail, briefly explain its value:

- Location specifics: "Listing those specific areas means families 
  searching for a doula in Lewes or Shoreham will find you — 
  not just those searching for Brighton."
- Birth type specifics: "Families looking for VBAC support 
  specifically will see your site come up in their search."
- Philosophy: "This gives your About page real personality — 
  visitors can tell straight away whether your approach is 
  right for them."
- Experience level: "Knowing you've supported 60+ families 
  gives potential clients real confidence."

Keep these brief. One sentence. Don't lecture.
```

---

## 6. Spec Density Score

To measure whether the elicitation is working, introduce a specification density score. This is an internal metric (visible to the instructor dashboard, not to the birth worker) that rates how complete and specific the collected data is.

### 6.1 Scoring Model

```
CORE FIELDS (must-haves — functional site):
  business_name           → 1 point
  doula_name              → 1 point
  service_areas[]         → 1 point (any value)
  services[]              → 1 point (any value)
  email                   → 1 point
  style                   → 1 point
  palette                 → 1 point
  bio (any content)       → 1 point
                          ─────────
  Core total:             8 points

DEPTH FIELDS (differentiation — personal site):
  primary_location        → 1 point
  service_areas (3+)      → 1 point (bonus for specificity)
  birth_types specified   → 1 point
  experience_level        → 1 point
  bio_origin_story        → 1 point
  philosophy              → 1 point
  training_provider       → 1 point
  training_year           → 1 point
  additional_training     → 1 point
  testimonials (1+)       → 1 point
  testimonial with context→ 1 point (author + service type)
  brand_feeling           → 1 point
  social_links (1+)       → 1 point
  phone                   → 1 point
  booking_url             → 1 point
  client_perception       → 1 point
  signature_story         → 1 point
                          ─────────
  Depth total:            17 points

OVERALL:
  0-8:   Low density    (functional but generic)
  9-15:  Medium density (good, some personality)
  16-20: High density   (rich, personal, highly searchable)
  21-25: Excellent      (the spec does the work)
```

### 6.2 Display

- **Instructor dashboard:** Show density score per student as a progress bar or badge. Instructors can see which students need encouragement to add more detail.
- **Student dashboard:** Show as a "site completeness" percentage. Frame it positively: "Your site is 72% complete — adding your story and a testimonial would bring it to life."
- **Build pipeline:** Use density score to adjust generation strategy. Low-density specs get more generic but safe output. High-density specs get personalised output that leans into the specifics.

---

## 7. Conversation Flow (Revised Full Sequence)

### Step 1: Welcome
No change. Brief, warm, set expectations.

### Step 2: Business Basics + Depth
Enhanced per section 3.2 above. Core questions + conditional follow-ups on location and service types. Estimated 3-8 questions depending on follow-ups triggered.

### Step 3: Style Direction + Feeling
Enhanced per section 3.6. Style, palette, typography, brand feeling, inspiration URL. Estimated 4-6 questions.

### Step 4: Your Story (Bio Elicitation)
New structure per section 3.4. Guided reflection: previous career, origin story, training, additional training, philosophy, client perception, optional signature story. AI generates bio draft at the end. Estimated 5-8 questions.

### Step 4b: Testimonials
Enhanced per section 3.5. Paste, skip, or get help collecting. Contextual follow-ups on pasted testimonials. Estimated 1-4 questions.

### Step 5: Photos
No change. Upload headshot, optional gallery. Estimated 1-2 questions.

### Step 6: Contact & Practical
Slightly trimmed — training provider and training year moved to Step 4. Email, phone, booking URL, social links, Doula UK membership. Estimated 4-5 questions.

### Step 7: Review & Build
Enhanced to show density score as "site readiness." If density is low, suggest specific areas to add detail: "Your site is ready to build! You could make it even stronger by adding a testimonial and telling me a bit about your training. Want to do that now, or build and add them later?"

### Total question count

Current flow: ~15-20 questions, single-shot
Enhanced flow: ~20-35 questions, depending on conditional branches

The absolute count increases, but the conversation should feel shorter because each question is easier to answer and the flow feels responsive rather than procedural.

---

## 8. Impact on Downstream Systems

### 8.1 Bio Generation

**Before:** Single free-text input ("Tell me about yourself") → Claude generates bio from 1-2 sentences.

**After:** 6-7 structured inputs (previous career, origin story, training, philosophy, client perception, signature story) → Claude generates bio from dense, structured context.

The generation prompt shifts from:

```
Write a bio for {name}, a {service_type} in {location}. 
They said: "{free_text_bio}"
```

To:

```
Write a bio for {name}, a {service_type} in {location}.

Background: {bio_previous_career}
Origin story: {bio_origin_story}
Trained with: {training_provider} in {training_year}
Additional training: {additional_training}
Philosophy: {philosophy}
What clients say: {client_perception}
A story that matters to them: {signature_story}

Write in first person. Warm, professional, British English. 
2-3 paragraphs. Lead with the origin story, weave in the 
philosophy, close with what clients can expect.
```

### 8.2 Schema.org Structured Data

More fields = richer schema:

- `birth_types[]` → more specific `Service.serviceType` values
- `additional_training[]` → additional `hasCredential` entries
- `experience_level` → `numberOfEmployees` or custom `experienceLevel` property
- `philosophy` → feeds into `description` with entity-rich language
- `primary_location` + expanded `service_areas[]` → granular `areaServed` array

### 8.3 FAQ Generation

Dense specs produce better FAQs:

**Low density:** "What does a doula do?" / "How much does a doula cost?"

**High density:** "What's the difference between a birth doula and a postnatal doula in Brighton?" / "Can I have a doula at a home birth in East Sussex?" / "Do you offer VBAC support?" / "What hypnobirthing programme do you teach?"

### 8.4 AI Search Surface Area

Every specific detail is an entity that AI models can match:

- "home birth doula Brighton" → matches `birth_types: home`, `service_areas: Brighton`
- "VBAC support East Sussex" → matches `birth_types: vbac`, `service_areas: East Sussex`
- "KGH hypnobirthing classes Hove" → matches `programme: KGH`, `service_areas: Hove`
- "doula who trained with Developing Doulas" → matches `training_provider`

Low-density specs can only match broad queries ("doula Brighton"). High-density specs match long-tail queries where conversion intent is highest.

---

## 9. Implementation Plan

### Phase 1: Data Model Extension
**Effort:** 1 hour
- Run migration to add new columns to `site_specs`
- Extend JSONB schemas for `services[]` and `testimonials[]`
- Update TypeScript types in `types/site-spec.ts`
- Update dashboard form to expose new fields

### Phase 2: System Prompt Redesign
**Effort:** 2-3 hours
- Rewrite chatbot system prompt with elicitation personality
- Add conditional follow-up rules
- Add payoff signal templates
- Add opt-out language
- Test conversation flow end-to-end with sample personas:
  - "Sparse Sarah" — gives one-word answers
  - "Detailed Dina" — already knows what she wants
  - "Nervous Nora" — unsure, needs encouragement

### Phase 3: Bio Generation Enhancement
**Effort:** 1-2 hours
- Update bio generation prompt to consume all new fields
- Add structured generation template
- Test output quality across density levels
- Add "regenerate" option in dashboard

### Phase 4: Density Score
**Effort:** 2-3 hours
- Implement scoring function (runs on site_spec change)
- Add to instructor dashboard as per-student metric
- Add to student dashboard as "site readiness" indicator
- Add to Step 7 review screen with suggestions for improvement

### Phase 5: Dashboard Sync
**Effort:** 1-2 hours
- Ensure all new fields are editable in the dashboard
- Group new fields logically within existing tabs
- Add "Ask AI" buttons for fields that support generation
- Maintain chatbot ↔ dashboard bidirectional sync

**Total estimated effort: 7-11 hours**

---

## 10. Success Metrics

- Average specification density score increases from baseline (measure before/after)
- Bio generation quality improves (qualitative — compare output from low vs high density specs)
- Generated sites contain more entity-rich first paragraphs
- Chatbot completion rate stays above 80% (elicitation shouldn't cause abandonment)
- Average chatbot session length increases by 3-5 minutes (more questions, but each is quick)
- Instructor feedback: students' sites "feel more personal"
- Long-tail AI search queries match BirthBuild sites (manual spot check)

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Longer conversations cause drop-off | Medium | Every follow-up is skippable. Monitor completion rates. A/B test if needed |
| Birth workers feel interrogated | Low | Conversational tone, payoff signals, opt-outs. Test with real users |
| Increased API costs from more conversation turns | Low | ~5-10 extra turns per session ≈ pennies. Worth it for output quality |
| System prompt becomes too long/complex | Medium | Keep follow-up rules declarative, not procedural. Test for prompt degradation |
| Dashboard gets cluttered with new fields | Low | Group logically. Progressive disclosure in dashboard too — show advanced fields only when populated |

---

## 12. Relationship to Other Modules

```
Specification Density Module (this doc)
  ↓ produces denser site_specs
  ↓
  ├── Site Generation Pipeline
  │   └── Better design output, more personal copy
  │
  ├── Agentic SEO Module (SCOPING-AGENTIC-SEO.md)
  │   ├── Richer Schema.org structured data
  │   ├── Better FAQ generation
  │   ├── More informative llms.txt
  │   └── More entity-rich first paragraphs
  │
  └── Future: Content Marketing Module
      └── Blog post generation from dense spec context
```

This module is the foundation. Everything else inherits from spec quality. Build this first, and the Agentic SEO module produces better output automatically.

---

## 13. Build Order Recommendation

1. **This module first** — spec density improvement
2. **Agentic SEO module second** — inherits from denser specs
3. **Together they compound:** richer data → richer schema → richer AI search presence → more clients finding the birth worker → more referrals → more sites built on BirthBuild

---

*SCOPING-SPEC-DENSITY.md — BirthBuild Specification Density Module*
*Dopamine Labs — February 2026*
