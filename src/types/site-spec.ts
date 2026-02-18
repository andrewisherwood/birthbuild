/**
 * SiteSpec type definition matching the site_specs database table.
 */

export interface ServiceItem {
  type: string;
  title: string;
  description: string;
  price: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  [key: string]: string | undefined;
}

export interface Testimonial {
  quote: string;
  name: string;
  context: string;
}

export interface CustomColours {
  background: string;
  primary: string;
  accent: string;
  text: string;
  cta: string;
}

export type SiteSpecStatus = "draft" | "building" | "preview" | "live" | "error";
export type StyleOption = "modern" | "classic" | "minimal";
export type PaletteOption =
  | "sage_sand"
  | "blush_neutral"
  | "deep_earth"
  | "ocean_calm"
  | "custom";
export type TypographyOption = "modern" | "classic" | "mixed";

// ---------------------------------------------------------------------------
// Design config (advanced design editor overrides)
// ---------------------------------------------------------------------------

export interface DesignColours {
  primary: string;
  background: string;
  accent: string;
  text: string;
  cta: string;
}

export type SpacingDensity = "compact" | "default" | "relaxed" | "spacious";
export type BorderRadiusOption = "sharp" | "slightly-rounded" | "rounded" | "circular";
export type TypographyScale = "small" | "default" | "large";

export interface DesignTypography {
  headingFont: string;
  bodyFont: string;
  scale: TypographyScale;
}

export interface DesignConfig {
  colours: DesignColours;
  typography: DesignTypography;
  spacing: { density: SpacingDensity };
  borderRadius: BorderRadiusOption;
}

export type ChatStep =
  | "welcome"
  | "basics"
  | "style"
  | "content"
  | "photos"
  | "contact"
  | "review"
  | "complete";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SiteSpec {
  id: string;
  user_id: string;
  tenant_id: string | null;
  session_id: string | null;
  status: SiteSpecStatus;

  // Business info
  business_name: string | null;
  doula_name: string | null;
  tagline: string | null;
  service_area: string | null;
  services: ServiceItem[];

  // Contact
  email: string | null;
  phone: string | null;
  booking_url: string | null;
  social_links: SocialLinks;

  // Content
  bio: string | null;
  philosophy: string | null;
  testimonials: Testimonial[];
  faq_enabled: boolean;
  blog_enabled: boolean;

  // Design
  style: StyleOption;
  palette: PaletteOption;
  custom_colours: CustomColours | null;
  typography: TypographyOption;
  font_heading: string | null;
  font_body: string | null;

  // Advanced design overrides (null = use base fields)
  design: DesignConfig | null;

  // Accreditation
  doula_uk: boolean;
  training_provider: string | null;

  // SEO
  primary_keyword: string | null;

  // Pages to generate
  pages: string[];

  // Deployment
  subdomain_slug: string | null;
  netlify_site_id: string | null;
  deploy_url: string | null;
  preview_url: string | null;

  // LLM generation
  use_llm_generation: boolean;
  latest_checkpoint_id: string | null;

  // Chat history
  chat_history: ChatMessage[];

  // Metadata
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Checkpoint types
// ---------------------------------------------------------------------------

export interface CheckpointPage {
  filename: string;
  html: string;
}

export interface CheckpointDesignSystem {
  css: string;
  nav_html: string;
  footer_html: string;
  wordmark_svg?: string;
}

export interface SiteCheckpoint {
  id: string;
  site_spec_id: string;
  version: number;
  html_pages: { pages: CheckpointPage[] };
  design_system: CheckpointDesignSystem | null;
  label: string | null;
  created_at: string;
}
