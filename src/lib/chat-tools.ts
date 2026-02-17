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
      "Save or update the birth worker's business information. Call this whenever the user provides their business name, name, service area, or services.",
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
        service_area: {
          type: "string",
          description:
            "Geographic area where the birth worker provides services (e.g., 'Bristol and surrounding areas')",
        },
        services: {
          type: "array",
          description: "List of services offered",
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
      "Save or update the website design preferences including style, colour palette, and typography.",
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
