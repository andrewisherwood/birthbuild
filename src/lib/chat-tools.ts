/**
 * Claude function-calling (tool_use) definitions for the chatbot onboarding.
 *
 * Each tool maps to a partial update on the site_spec row.
 * The `mapToolCallToSpecUpdate` function translates tool calls into
 * Partial<SiteSpec> objects that `useSiteSpec.updateSiteSpec` can consume.
 */

import type { ClaudeToolDefinition } from "@/lib/claude";
import type {
  SiteSpec,
  ServiceItem,
  SocialLinks,
  StyleOption,
  PaletteOption,
  TypographyOption,
} from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Tool definitions (Claude function calling schema)
// ---------------------------------------------------------------------------

export const CHAT_TOOLS: ClaudeToolDefinition[] = [
  {
    name: "update_business_info",
    description:
      "Save or update the birth worker's business information. Call this whenever the user provides their business name, name, location, service area, or services.",
    input_schema: {
      type: "object",
      properties: {
        business_name: {
          type: "string",
          description: "The name of the birth work business or practice",
        },
        doula_name: {
          type: "string",
          description: "The birth worker's full name",
        },
        primary_location: {
          type: "string",
          description: "Where the birth worker is based (e.g., 'Brighton')",
        },
        service_area: {
          type: "string",
          description:
            "Geographic areas covered, comma-separated (e.g., 'Brighton, Hove, Lewes, Shoreham')",
        },
        services: {
          type: "array",
          description: "List of services offered with optional depth fields",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Service category" },
              title: { type: "string", description: "Service title" },
              description: {
                type: "string",
                description: "Brief description of the service",
              },
              price: {
                type: "string",
                description: "Price or price range (e.g., 'From £500')",
              },
              birth_types: {
                type: "array",
                items: { type: "string" },
                description:
                  "Types of birth supported (e.g., 'home', 'hospital', 'vbac'). Only for birth doula services.",
              },
              format: {
                type: "string",
                description:
                  "Teaching format: 'group', 'private', or 'both'. Only for hypnobirthing/antenatal.",
              },
              programme: {
                type: "string",
                description:
                  "Which programme they teach (e.g., 'KGH', 'Calm Birth School'). Only for hypnobirthing.",
              },
              experience_level: {
                type: "string",
                description:
                  "How many families supported: 'starting_out', '10-30', '30-60', '60-100', '100+'",
              },
            },
            required: ["type", "title", "description", "price"],
          },
        },
      },
    },
  },
  {
    name: "update_style",
    description:
      "Save or update the website design preferences including style, colour palette, typography, brand feeling, and inspiration.",
    input_schema: {
      type: "object",
      properties: {
        style: {
          type: "string",
          enum: ["modern", "classic", "minimal"],
          description: "Overall website design style",
        },
        palette: {
          type: "string",
          enum: ["sage_sand", "blush_neutral", "deep_earth", "ocean_calm", "custom"],
          description: "Colour palette for the website",
        },
        typography: {
          type: "string",
          enum: ["modern", "classic", "mixed"],
          description: "Typography style",
        },
        brand_feeling: {
          type: "string",
          description:
            "The feeling/vibe the birth worker wants visitors to get from their site (e.g., 'warm and earthy', 'calm and professional')",
        },
        style_inspiration_url: {
          type: "string",
          description: "URL of a website the birth worker admires the look of",
        },
      },
    },
  },
  {
    name: "update_content",
    description:
      "Save or update content fields such as bio, tagline, philosophy, testimonials, or FAQ setting.",
    input_schema: {
      type: "object",
      properties: {
        bio: {
          type: "string",
          description: "The birth worker's personal/professional biography",
        },
        tagline: {
          type: "string",
          description: "A short tagline or strapline for the website",
        },
        philosophy: {
          type: "string",
          description: "The birth worker's philosophy or approach statement",
        },
        testimonials: {
          type: "array",
          description: "Client testimonials",
          items: {
            type: "object",
            properties: {
              quote: { type: "string" },
              name: { type: "string" },
              context: { type: "string" },
            },
            required: ["quote", "name", "context"],
          },
        },
        faq_enabled: {
          type: "boolean",
          description: "Whether to include a FAQ section on the website",
        },
      },
    },
  },
  {
    name: "update_bio_depth",
    description:
      "Save biographical depth fields collected during the guided story elicitation in Step 4. These fields feed into richer bio generation.",
    input_schema: {
      type: "object",
      properties: {
        bio_previous_career: {
          type: "string",
          description: "What the birth worker did before entering birth work",
        },
        bio_origin_story: {
          type: "string",
          description:
            "The moment or experience that led them to become a birth worker",
        },
        training_year: {
          type: "string",
          description: "Year they completed their training (e.g., '2019')",
        },
        additional_training: {
          type: "array",
          items: { type: "string" },
          description:
            "Additional training or CPD completed (e.g., 'spinning babies', 'aromatherapy', 'rebozo')",
        },
        client_perception: {
          type: "string",
          description: "What clients most often say about the birth worker",
        },
        signature_story: {
          type: "string",
          description:
            "A memorable birth or family experience (anonymised) that stayed with them",
        },
      },
    },
  },
  {
    name: "update_contact",
    description:
      "Save or update contact information, social media links, and professional accreditation.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Contact email address",
        },
        phone: {
          type: "string",
          description: "Contact phone number",
        },
        booking_url: {
          type: "string",
          description: "URL for online booking (e.g., Calendly, Acuity)",
        },
        social_links: {
          type: "object",
          description: "Social media profile URLs",
          properties: {
            instagram: { type: "string" },
            facebook: { type: "string" },
            twitter: { type: "string" },
            linkedin: { type: "string" },
            tiktok: { type: "string" },
          },
        },
        doula_uk: {
          type: "boolean",
          description: "Whether the birth worker is a Doula UK member",
        },
        training_provider: {
          type: "string",
          description: "Name of the training organisation or programme",
        },
        training_year: {
          type: "string",
          description: "Year they completed their training (e.g., '2019')",
        },
      },
    },
  },
  {
    name: "generate_content",
    description:
      "Signal that you are generating AI-written content for a specific field. Always call update_content in the same response to save the generated text immediately.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["bio", "tagline", "services_description", "faq", "philosophy"],
          description: "Which content field to generate",
        },
        context: {
          type: "string",
          description:
            "Relevant context from the conversation to base the generated content on",
        },
      },
      required: ["field", "context"],
    },
  },
  {
    name: "update_pages",
    description: "Set which pages should be generated for the website.",
    input_schema: {
      type: "object",
      properties: {
        pages: {
          type: "array",
          description:
            "List of page names to generate (e.g., ['home', 'about', 'services', 'contact'])",
          items: { type: "string" },
        },
      },
      required: ["pages"],
    },
  },
  {
    name: "trigger_photo_upload",
    description:
      "Show the inline photo upload panel so the user can upload headshot, hero, and gallery photos directly in the chat.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "mark_step_complete",
    description:
      "Mark a step in the onboarding flow as complete and advance to the next step. Call this after successfully collecting all information for a step.",
    input_schema: {
      type: "object",
      properties: {
        completed_step: {
          type: "string",
          enum: [
            "welcome",
            "basics",
            "style",
            "content",
            "photos",
            "contact",
            "review",
          ],
          description: "The step that has just been completed",
        },
        next_step: {
          type: "string",
          enum: [
            "welcome",
            "basics",
            "style",
            "content",
            "photos",
            "contact",
            "review",
            "complete",
          ],
          description: "The next step to move to",
        },
      },
      required: ["completed_step", "next_step"],
    },
  },
];

// ---------------------------------------------------------------------------
// Mapping: tool call → Partial<SiteSpec>
// ---------------------------------------------------------------------------

export function mapToolCallToSpecUpdate(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Partial<SiteSpec> | null {
  switch (toolName) {
    case "update_business_info": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.business_name === "string") {
        update.business_name = toolArgs.business_name;
      }
      if (typeof toolArgs.doula_name === "string") {
        update.doula_name = toolArgs.doula_name;
      }
      if (typeof toolArgs.primary_location === "string") {
        update.primary_location = toolArgs.primary_location;
      }
      if (typeof toolArgs.service_area === "string") {
        update.service_area = toolArgs.service_area;
      }
      if (Array.isArray(toolArgs.services)) {
        update.services = toolArgs.services as ServiceItem[];
      }
      return Object.keys(update).length > 0 ? update : null;
    }

    case "update_style": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.style === "string") {
        update.style = toolArgs.style as StyleOption;
      }
      if (typeof toolArgs.palette === "string") {
        update.palette = toolArgs.palette as PaletteOption;
      }
      if (typeof toolArgs.typography === "string") {
        update.typography = toolArgs.typography as TypographyOption;
      }
      if (typeof toolArgs.brand_feeling === "string") {
        update.brand_feeling = toolArgs.brand_feeling;
      }
      if (typeof toolArgs.style_inspiration_url === "string") {
        update.style_inspiration_url = toolArgs.style_inspiration_url;
      }
      return Object.keys(update).length > 0 ? update : null;
    }

    case "update_content": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.bio === "string") {
        update.bio = toolArgs.bio;
      }
      if (typeof toolArgs.tagline === "string") {
        update.tagline = toolArgs.tagline;
      }
      if (typeof toolArgs.philosophy === "string") {
        update.philosophy = toolArgs.philosophy;
      }
      if (Array.isArray(toolArgs.testimonials)) {
        update.testimonials = toolArgs.testimonials as SiteSpec["testimonials"];
      }
      if (typeof toolArgs.faq_enabled === "boolean") {
        update.faq_enabled = toolArgs.faq_enabled;
      }
      return Object.keys(update).length > 0 ? update : null;
    }

    case "update_bio_depth": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.bio_previous_career === "string") {
        update.bio_previous_career = toolArgs.bio_previous_career;
      }
      if (typeof toolArgs.bio_origin_story === "string") {
        update.bio_origin_story = toolArgs.bio_origin_story;
      }
      if (typeof toolArgs.training_year === "string") {
        update.training_year = toolArgs.training_year;
      }
      if (Array.isArray(toolArgs.additional_training)) {
        update.additional_training = toolArgs.additional_training as string[];
      }
      if (typeof toolArgs.client_perception === "string") {
        update.client_perception = toolArgs.client_perception;
      }
      if (typeof toolArgs.signature_story === "string") {
        update.signature_story = toolArgs.signature_story;
      }
      return Object.keys(update).length > 0 ? update : null;
    }

    case "update_contact": {
      const update: Partial<SiteSpec> = {};
      if (typeof toolArgs.email === "string") {
        update.email = toolArgs.email;
      }
      if (typeof toolArgs.phone === "string") {
        update.phone = toolArgs.phone;
      }
      if (typeof toolArgs.booking_url === "string") {
        update.booking_url = toolArgs.booking_url;
      }
      if (
        typeof toolArgs.social_links === "object" &&
        toolArgs.social_links !== null
      ) {
        update.social_links = toolArgs.social_links as SocialLinks;
      }
      if (typeof toolArgs.doula_uk === "boolean") {
        update.doula_uk = toolArgs.doula_uk;
      }
      if (typeof toolArgs.training_provider === "string") {
        update.training_provider = toolArgs.training_provider;
      }
      if (typeof toolArgs.training_year === "string") {
        update.training_year = toolArgs.training_year;
      }
      return Object.keys(update).length > 0 ? update : null;
    }

    case "update_pages": {
      if (Array.isArray(toolArgs.pages)) {
        return { pages: toolArgs.pages as string[] };
      }
      return null;
    }

    // generate_content and mark_step_complete don't directly update the spec
    // (generate_content is handled by Claude's text response + a subsequent
    // update_content call; mark_step_complete is handled by useChat)
    case "generate_content":
    case "mark_step_complete":
    case "trigger_photo_upload":
      return null;

    default:
      return null;
  }
}
