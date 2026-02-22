# Prompt A/B Testing Infrastructure — Persona Harness Brief

## What Was Built

The `generate-design-system` and `generate-page` Supabase Edge Functions now accept an optional `prompt_config` field in their request body. This enables the persona-harness to:

1. **Override the system prompt** with a template variant
2. **Override the user message** with a custom template
3. **Switch LLM provider** (Anthropic or OpenAI)
4. **Switch model** (e.g. `claude-opus-4-6`, `gpt-4.5`)
5. **Tune temperature and max_tokens**
6. **Supply a different API key** for non-default providers

When `prompt_config` is absent, both functions behave identically to before — hardcoded prompts, Anthropic Sonnet, tenant API key.

---

## `prompt_config` Interface

```typescript
interface PromptConfig {
  system_prompt?: string;       // Template with {{variable}} placeholders
  user_message?: string;        // Override user message template
  model_provider?: string;      // "anthropic" | "openai"
  model_name?: string;          // e.g. "claude-opus-4-6", "gpt-4.5"
  temperature?: number;         // 0.0–1.0
  max_tokens?: number;          // 1–32768
  provider_api_key?: string;    // API key for non-default provider (used in-flight, never stored)
}
```

### Validation Rules

- `model_provider` must be `"anthropic"` or `"openai"` if provided
- `temperature` must be 0–1 if provided
- `max_tokens` must be 1–32768 if provided
- All fields are optional — you can override just `temperature` without changing the prompt
- Invalid `prompt_config` returns HTTP 400 with a descriptive error message

---

## How to Call From the Harness

### `EdgeFunctionClient.generateDesignSystem()` — updated signature

The existing method sends `{ site_spec_id }`. To use prompt_config, add it to the request body:

```typescript
// Before (production path — still works unchanged)
const response = await fetch(this.generateDesignSystemUrl, {
  method: "POST",
  headers: this.headers(),
  body: JSON.stringify({ site_spec_id: siteSpecId }),
});

// With prompt_config (A/B testing path)
const response = await fetch(this.generateDesignSystemUrl, {
  method: "POST",
  headers: this.headers(),
  body: JSON.stringify({
    site_spec_id: siteSpecId,
    prompt_config: {
      system_prompt: templateContent,  // Read from .md file
      model_name: "claude-opus-4-6",
      temperature: 0.7,
    },
  }),
});
```

### `EdgeFunctionClient.generatePage()` — updated signature

```typescript
// With prompt_config
const response = await fetch(this.generatePageUrl, {
  method: "POST",
  headers: this.headers(),
  body: JSON.stringify({
    site_spec_id: siteSpecId,
    page: "home",
    design_system: designSystem,
    photos: photos,
    prompt_config: {
      system_prompt: pageTemplateContent,
      model_provider: "openai",
      model_name: "gpt-4.5",
      provider_api_key: "sk-...",
      temperature: 0.8,
    },
  }),
});
```

---

## Prompt Template System

### File Layout

```
supabase/functions/_shared/prompts/
├── manifest.json                           # Variant registry
├── design-system/
│   └── v1-structured.md                    # Current production prompt (extracted)
└── generate-page/
    └── v1-structured.md                    # Current production prompt (extracted)
```

### `manifest.json`

```json
{
  "design-system": {
    "production": "v1-structured",
    "variants": {
      "v1-structured": {
        "description": "Original rigid prompt with all mandatory sections, required CSS selectors, and strict colour/font rules",
        "file": "design-system/v1-structured.md"
      }
    }
  },
  "generate-page": {
    "production": "v1-structured",
    "variants": {
      "v1-structured": {
        "description": "Original rigid page prompt with mandatory design system fidelity rules and per-page requirements",
        "file": "generate-page/v1-structured.md"
      }
    }
  }
}
```

### Reading Prompts From the Harness

The harness reads prompt files directly from the BirthBuild filesystem. The path is relative to the BirthBuild project root:

```typescript
import { readFileSync } from "fs";
import { join } from "path";

const BIRTHBUILD_ROOT = "/Users/andrew/Documents/DopamineLaboratory/Apps/BirthBuild";
const PROMPTS_DIR = join(BIRTHBUILD_ROOT, "supabase/functions/_shared/prompts");

// 1. Read manifest to discover variants
const manifest = JSON.parse(
  readFileSync(join(PROMPTS_DIR, "manifest.json"), "utf-8")
);

// 2. Get the production variant name
const productionVariant = manifest["design-system"].production; // "v1-structured"

// 3. Read the template file
const templateFile = manifest["design-system"].variants[productionVariant].file;
const template = readFileSync(join(PROMPTS_DIR, templateFile), "utf-8");

// 4. Pass the template to the edge function via prompt_config
await client.generateDesignSystem(siteSpecId, {
  prompt_config: { system_prompt: template }
});
```

### Adding New Variants

To test a new prompt strategy:

1. Create a new `.md` file, e.g. `design-system/v2-minimal.md`
2. Add an entry to `manifest.json`:
   ```json
   "v2-minimal": {
     "description": "Minimal prompt with fewer constraints, focusing on visual quality over compliance",
     "file": "design-system/v2-minimal.md"
   }
   ```
3. The harness reads the file and passes it as `prompt_config.system_prompt`
4. To promote: change `"production"` to `"v2-minimal"` in the manifest

---

## Template Variables

Templates use `{{variable_name}}` syntax. The edge function resolves them at runtime from the site spec — the harness does **not** need to resolve variables. Just pass the raw template.

### Design System Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{{business_name}}` | `spec.business_name` | "Sage Birth Services" |
| `{{doula_name}}` | `spec.doula_name` | "Emma Thompson" |
| `{{tagline}}` | `spec.tagline` | "Supporting your birth journey" |
| `{{service_area}}` | `spec.service_area` | "Bristol and Bath" |
| `{{style}}` | `spec.style` | "modern" |
| `{{brand_feeling}}` | `spec.brand_feeling` | "warm and nurturing" |
| `{{colour_bg}}` | Resolved palette | "#f5f0e8" |
| `{{colour_primary}}` | Resolved palette | "#5f7161" |
| `{{colour_accent}}` | Resolved palette | "#c9b99a" |
| `{{colour_text}}` | Resolved palette | "#3d3d3d" |
| `{{colour_cta}}` | Resolved palette | "#5f7161" |
| `{{colour_bg_desc}}` | Custom palette description | "warm cream" |
| `{{colour_primary_desc}}` | Custom palette description | "sage green" |
| `{{colour_accent_desc}}` | Custom palette description | "sandy gold" |
| `{{colour_text_desc}}` | Custom palette description | "dark charcoal" |
| `{{colour_cta_desc}}` | Custom palette description | "sage green" |
| `{{heading_font}}` | Resolved typography | "DM Serif Display" |
| `{{body_font}}` | Resolved typography | "Inter" |
| `{{typography_scale}}` | Design config | "default" |
| `{{spacing_density}}` | Design config | "default" |
| `{{border_radius}}` | Design config | "rounded" |
| `{{page_list}}` | Spec pages array | "home (index.html), about (about.html), ..." |
| `{{social_links_desc}}` | Spec social links | "instagram: https://..., facebook: https://..." |
| `{{year}}` | Current year | "2026" |

### Page Generation Variables (all of above plus)

| Variable | Source | Example |
|----------|--------|---------|
| `{{page}}` | Current page being generated | "home" |
| `{{bio}}` | `spec.bio` | "Emma is a doula based in Bristol..." |
| `{{philosophy}}` | `spec.philosophy` | "I believe every birth is unique..." |
| `{{services_desc}}` | Formatted services list | "- Birth Doula (core): Full support... — £1200" |
| `{{testimonials_desc}}` | Formatted testimonials | "\"Emma was amazing\" — Sarah (home birth)" |
| `{{photos_desc}}` | Formatted photos list | "- hero: https://... (alt: \"Emma smiling\")" |
| `{{primary_keyword}}` | `spec.primary_keyword` | "doula" |
| `{{subdomain}}` | `spec.subdomain_slug` | "sage-birth" |
| `{{email}}` | `spec.email` | "emma@sagebirth.com" |
| `{{phone}}` | `spec.phone` | "07700 900000" |
| `{{booking_url}}` | `spec.booking_url` | "https://calendly.com/emma" |
| `{{doula_uk}}` | `spec.doula_uk` | "true" |
| `{{training_provider}}` | `spec.training_provider` | "Doula UK" |
| `{{training_year}}` | `spec.training_year` | "2022" |
| `{{primary_location}}` | `spec.primary_location` | "Bristol" |
| `{{bio_previous_career}}` | `spec.bio_previous_career` | "NHS midwife for 10 years" |
| `{{bio_origin_story}}` | `spec.bio_origin_story` | "After my own birth experience..." |
| `{{additional_training}}` | `spec.additional_training` (joined) | "hypnobirthing, rebozo" |
| `{{client_perception}}` | `spec.client_perception` | "calm and reassuring" |
| `{{signature_story}}` | `spec.signature_story` | "One client asked me to..." |
| `{{page_specific}}` | Per-page requirements block | Full requirements for home/about/services/etc. |
| `{{section_list}}` | Section marker examples | `<!-- bb-section:hero -->...<!-- /bb-section:hero -->` |

Unresolved variables (not in the spec) are left as literal `{{variable_name}}` in the output — they won't cause errors.

---

## Multi-Model Support

The `model-client.ts` abstraction handles provider differences:

| Feature | Anthropic | OpenAI |
|---------|-----------|--------|
| Auth header | `x-api-key: <key>` | `Authorization: Bearer <key>` |
| System prompt | Top-level `system` field | System message in `messages` array |
| Tool format | `{ name, description, input_schema }` | `{ type: "function", function: { name, description, parameters } }` |
| Forced tool | `tool_choice: { type: "tool", name: "..." }` | `tool_choice: { type: "function", function: { name: "..." } }` |
| Response parsing | `content[].type=tool_use` → `.input` | `choices[0].message.tool_calls[].function.arguments` → `JSON.parse` |
| Stop reasons | Normalised to Anthropic format (`end_turn`, `max_tokens`, `tool_use`) | OpenAI `stop`→`end_turn`, `length`→`max_tokens`, `tool_calls`→`tool_use` |

### Example: Testing with OpenAI

```typescript
const response = await fetch(generateDesignSystemUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    site_spec_id: specId,
    prompt_config: {
      system_prompt: template,       // Same template works for both providers
      model_provider: "openai",
      model_name: "gpt-4.5",
      provider_api_key: "sk-...",    // OpenAI key (used in-flight, never stored)
      temperature: 0.7,
      max_tokens: 12000,
    },
  }),
});
```

---

## A/B Test Workflow

### 1. Baseline run (production prompt)

Call `generateDesignSystem` and `generatePage` **without** `prompt_config`. This uses the hardcoded production prompt. Save the output.

### 2. Variant run (template override)

Read the v1-structured template from the filesystem, then call with `prompt_config.system_prompt` set to the template. The output should be identical to the baseline (the template is extracted from the same hardcoded prompt). This validates the template extraction.

### 3. New variant run

Create a new `.md` template (e.g. fewer constraints, different structure), read it, pass via `prompt_config.system_prompt`. Compare output quality against baseline.

### 4. Model comparison

Run the same template with different `model_provider` / `model_name` combinations. Compare quality across models.

### 5. Promote winner

Update `manifest.json` to set `"production"` to the winning variant name. Replace the hardcoded `buildSystemPrompt()` function body with the template content (or switch production code to read from the template file).

---

## Security Notes

- `prompt_config` is only usable by authenticated users (JWT required, same as all edge function requests)
- `provider_api_key` is passed to the LLM API in-flight via HTTP headers only — never stored in the database, never written to logs
- All LLM output still passes through the existing validation + HTML/CSS sanitisation pipeline regardless of which prompt or model produced it
- Production BirthBuild dashboard never sends `prompt_config` — the field is exclusively for the harness

---

## Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `_shared/model-client.ts` | **New** | Multi-provider LLM abstraction (Anthropic + OpenAI) |
| `_shared/prompt-resolver.ts` | **New** | `{{variable}}` template resolution + variable builders |
| `_shared/prompts/manifest.json` | **New** | Variant registry |
| `_shared/prompts/design-system/v1-structured.md` | **New** | Current design system prompt extracted as template |
| `_shared/prompts/generate-page/v1-structured.md` | **New** | Current page generation prompt extracted as template |
| `generate-design-system/index.ts` | **Modified** | Accepts `prompt_config`, routes through model client |
| `generate-page/index.ts` | **Modified** | Accepts `prompt_config`, routes through model client |
| `CLAUDE.md` | **Modified** | Updated folder structure + patterns documentation |
