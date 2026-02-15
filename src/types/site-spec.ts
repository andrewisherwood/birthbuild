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

export type SiteSpecStatus = "draft" | "building" | "live" | "error";
export type StyleOption = "modern" | "classic" | "minimal";
export type PaletteOption =
  | "sage_sand"
  | "blush_neutral"
  | "deep_earth"
  | "ocean_calm"
  | "custom";
export type TypographyOption = "modern" | "classic" | "mixed";

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

  // Chat history
  chat_history: ChatMessage[];

  // Metadata
  created_at: string;
  updated_at: string;
}
