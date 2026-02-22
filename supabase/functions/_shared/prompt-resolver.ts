/**
 * Prompt template resolver.
 *
 * Resolves {{variable}} placeholders in prompt templates using values
 * derived from a site spec. Used by the A/B testing harness to inject
 * prompt variants while keeping spec resolution in the edge function.
 */

// ---------------------------------------------------------------------------
// Template interpolation
// ---------------------------------------------------------------------------

/**
 * Replace all `{{variable_name}}` placeholders in a template string.
 * Unresolved placeholders are left as-is (the LLM will see them as literal text).
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return key in variables ? variables[key]! : `{{${key}}}`;
  });
}

// ---------------------------------------------------------------------------
// Variable builders
// ---------------------------------------------------------------------------

/**
 * Resolved spec shape — matches the existing ResolvedSpec interface in
 * generate-design-system. Kept as a standalone interface so the prompt
 * resolver has no import dependency on a specific edge function.
 */
interface PaletteColours {
  background: string;
  primary: string;
  accent: string;
  text: string;
  cta: string;
  background_description?: string;
  primary_description?: string;
  accent_description?: string;
  text_description?: string;
  cta_description?: string;
}

export interface ResolvedSpecForPrompt {
  businessName: string;
  doulaName: string;
  tagline: string;
  serviceArea: string;
  style: string;
  colours: PaletteColours;
  headingFont: string;
  bodyFont: string;
  pages: string[];
  socialLinks: Array<{ platform: string; url: string }>;
  spacingDensity: string;
  borderRadius: string;
  typographyScale: string;
  brandFeeling: string;
  year: number;
}

const PAGE_FILENAMES: Record<string, string> = {
  home: "index.html",
  about: "about.html",
  services: "services.html",
  contact: "contact.html",
  testimonials: "testimonials.html",
  faq: "faq.html",
};

/**
 * Build the variable map for design-system prompt templates.
 */
export function buildDesignSystemVariables(
  resolved: ResolvedSpecForPrompt,
): Record<string, string> {
  const pageList = resolved.pages
    .map((p) => `${p} (${PAGE_FILENAMES[p] ?? p + ".html"})`)
    .join(", ");

  const socialLinksDesc =
    resolved.socialLinks.length > 0
      ? resolved.socialLinks.map((l) => `${l.platform}: ${l.url}`).join(", ")
      : "none provided";

  const colourComment = (hex: string, desc?: string) =>
    desc ? `${hex}  /* Client described as: "${desc}" */` : hex;

  return {
    business_name: resolved.businessName,
    doula_name: resolved.doulaName,
    tagline: resolved.tagline,
    service_area: resolved.serviceArea,
    style: resolved.style,
    brand_feeling: resolved.brandFeeling,
    colour_bg: colourComment(resolved.colours.background, resolved.colours.background_description),
    colour_primary: colourComment(resolved.colours.primary, resolved.colours.primary_description),
    colour_accent: colourComment(resolved.colours.accent, resolved.colours.accent_description),
    colour_text: colourComment(resolved.colours.text, resolved.colours.text_description),
    colour_cta: colourComment(resolved.colours.cta, resolved.colours.cta_description),
    colour_bg_desc: resolved.colours.background_description ?? "",
    colour_primary_desc: resolved.colours.primary_description ?? "",
    colour_accent_desc: resolved.colours.accent_description ?? "",
    colour_text_desc: resolved.colours.text_description ?? "",
    colour_cta_desc: resolved.colours.cta_description ?? "",
    heading_font: resolved.headingFont,
    body_font: resolved.bodyFont,
    typography_scale: resolved.typographyScale,
    spacing_density: resolved.spacingDensity,
    border_radius: resolved.borderRadius,
    page_list: pageList,
    social_links_desc: socialLinksDesc,
    year: String(resolved.year),
  };
}

/** Section names per page type (mirrors generate-page). */
const PAGE_SECTIONS: Record<string, string[]> = {
  home: ["hero", "services-overview", "featured-testimonial", "about-preview", "cta"],
  about: ["hero", "bio", "philosophy", "qualifications", "cta"],
  services: ["hero", "service-cards", "cta"],
  contact: ["hero", "contact-form", "contact-info"],
  testimonials: ["hero", "testimonials", "cta"],
  faq: ["hero", "faq", "cta"],
};

/**
 * Build the variable map for page generation prompt templates.
 * Includes all design-system variables plus page-specific ones.
 */
export function buildPageVariables(
  resolved: ResolvedSpecForPrompt,
  // deno-lint-ignore no-explicit-any
  spec: any,
  page: string,
): Record<string, string> {
  const base = buildDesignSystemVariables(resolved);

  const services = spec.services ?? [];
  const testimonials = spec.testimonials ?? [];
  const photos = spec.photos ?? [];
  const additionalTraining = spec.additional_training ?? [];

  const servicesDesc = services.length > 0
    ? services.map((s: { title: string; description: string; price: string; type: string }) =>
        `- ${s.title} (${s.type}): ${s.description} — ${s.price}`
      ).join("\n")
    : "No services listed.";

  const testimonialsDesc = testimonials.length > 0
    ? testimonials.map((t: { quote: string; name: string; context: string }) =>
        `- "${t.quote}" — ${t.name} (${t.context})`
      ).join("\n")
    : "No testimonials provided.";

  const photosDesc = photos.length > 0
    ? photos.map((p: { purpose: string; publicUrl: string; altText: string }) =>
        `- ${p.purpose}: ${p.publicUrl} (alt: "${p.altText}")`
      ).join("\n")
    : "No photos provided.";

  const sections = PAGE_SECTIONS[page] ?? ["hero", "content", "cta"];
  const sectionList = sections
    .map((s) => `<!-- bb-section:${s} -->...<section>...</section>...<!-- /bb-section:${s} -->`)
    .join("\n");

  // Build page-specific requirements block
  const pageSpecific = buildPageSpecificBlock(page, spec);

  return {
    ...base,
    page,
    bio: spec.bio ?? "",
    philosophy: spec.philosophy ?? "",
    services_desc: servicesDesc,
    testimonials_desc: testimonialsDesc,
    photos_desc: photosDesc,
    primary_keyword: spec.primary_keyword ?? "",
    subdomain: spec.subdomain_slug ?? "example",
    email: spec.email ?? "",
    phone: spec.phone ?? "",
    booking_url: spec.booking_url ?? "",
    doula_uk: spec.doula_uk ? "true" : "false",
    training_provider: spec.training_provider ?? "",
    training_year: spec.training_year ?? "",
    primary_location: spec.primary_location ?? "",
    bio_previous_career: spec.bio_previous_career ?? "",
    bio_origin_story: spec.bio_origin_story ?? "",
    additional_training: additionalTraining.join(", "),
    client_perception: spec.client_perception ?? "",
    signature_story: spec.signature_story ?? "",
    page_specific: pageSpecific,
    section_list: sectionList,
  };
}

// ---------------------------------------------------------------------------
// Page-specific requirements block builder
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
function buildPageSpecificBlock(page: string, spec: any): string {
  const businessName = spec.business_name ?? "My Site";
  const doulaName = spec.doula_name ?? "";
  const tagline = spec.tagline ?? "";
  const serviceArea = spec.service_area ?? "";
  const email = spec.email ?? "";
  const phone = spec.phone ?? "";
  const bookingUrl = spec.booking_url ?? "";
  const doulaUk = spec.doula_uk ?? false;
  const trainingProvider = spec.training_provider ?? "";
  const trainingYear = spec.training_year ?? "";
  const primaryKeyword = spec.primary_keyword ?? "";
  const subdomain = spec.subdomain_slug ?? "example";
  const primaryLocation = spec.primary_location ?? "";
  const bioPreviousCareer = spec.bio_previous_career ?? "";
  const bioOriginStory = spec.bio_origin_story ?? "";
  const additionalTraining = spec.additional_training ?? [];
  const clientPerception = spec.client_perception ?? "";
  const signatureStory = spec.signature_story ?? "";
  const testimonials = spec.testimonials ?? [];

  switch (page) {
    case "home":
      return `## Home Page Requirements
- Hero section: MUST use full-width background image with text overlay. Use the hero photo as an <img> with object-fit:cover positioned absolutely. Add gradient overlay div for readability. h1 + tagline + CTA in white on top. Use .hero, .hero__bg, .hero__overlay, .hero__content, .hero__tagline, .btn--hero classes. If no hero photo is available, use a text-only hero with .hero--text-only class and brand colours.
- **Entity-rich h1**: Use "${businessName}${serviceArea ? ` — ${primaryKeyword || "Doula"} in ${serviceArea}` : ""}" as the h1 text.
- **Answer paragraph**: After the tagline, add a <p class="hero__answer"> with: "${doulaName || businessName} provides [service names] in ${serviceArea}."
- Services overview showing the first 3 services as cards. Each card MUST include a relevant image at the top if photos are available. Use .card--service wrapper with .card__image div (img inside) and .card__body div for text. Use .card__link for enquiry links. Fall back to plain .card if no images.
- Featured testimonial (first one, if available)
- About preview with a brief teaser linking to about.html
- Final CTA section encouraging visitors to get in touch
- **Full LocalBusiness + Person JSON-LD** in a <script type="application/ld+json"> block:
  \`\`\`json
  {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
    "name": "${businessName}",
    "description": "${tagline}",
    "url": "https://${subdomain}.birthbuild.com",
    ${email ? `"email": "${email}",` : ""}
    ${phone ? `"telephone": "${phone}",` : ""}
    ${serviceArea ? `"areaServed": "${serviceArea}",` : ""}
    ${primaryLocation ? `"address": {"@type": "PostalAddress", "addressLocality": "${primaryLocation}"},` : ""}
    "makesOffer": [for each service: {"@type":"Offer","itemOffered":{"@type":"Service","name":"...","description":"..."},"price":"...","priceCurrency":"GBP"}],
    ${trainingProvider ? `"hasCredential": [{"@type":"EducationalOccupationalCredential","credentialCategory":"Professional Training","recognizedBy":{"@type":"Organization","name":"${trainingProvider}"}}],` : ""}
    ${doulaName ? `"founder": {"@type": "Person", "name": "${doulaName}"},` : ""}
    "sameAs": [social link URLs if any]
  }
  \`\`\``;

    case "about": {
      const aboutExtras: string[] = [];
      if (bioPreviousCareer) aboutExtras.push(`- Reference their previous career: ${bioPreviousCareer}`);
      if (bioOriginStory) aboutExtras.push(`- Weave in their origin story: ${bioOriginStory}`);
      if (additionalTraining.length > 0) aboutExtras.push(`- Mention additional qualifications: ${additionalTraining.join(", ")}`);
      if (clientPerception) aboutExtras.push(`- Include what clients say about them: ${clientPerception}`);
      if (signatureStory) aboutExtras.push(`- If space allows, reference this personal story: ${signatureStory}`);
      if (trainingYear) aboutExtras.push(`- Training year: ${trainingYear}`);
      const aboutExtrasStr = aboutExtras.length > 0 ? "\n" + aboutExtras.join("\n") : "";
      return `## About Page Requirements
- **Entity-rich h1**: "About ${doulaName || businessName}${primaryLocation ? ` | ${primaryLocation}` : serviceArea ? ` | ${serviceArea}` : ""}"
- Bio section with the birth worker's biography. Start with an answer-first opening sentence.
- Philosophy section with their approach statement
- Qualifications section${doulaUk ? " (mention Doula UK membership)" : ""}${trainingProvider ? ` (trained with: ${trainingProvider})` : ""}${aboutExtrasStr}
- CTA section encouraging visitors to get in touch
- If a headshot photo is available, display it prominently
- **Person + Credential JSON-LD** in a <script type="application/ld+json"> block with @type Person, name, and hasCredential array listing training provider, Doula UK (if applicable), and additional training.`;
    }

    case "services":
      return `## Services Page Requirements
- **Entity-rich h1**: "Services | ${businessName}${serviceArea ? ` in ${serviceArea}` : ""}"
- The first content section must use: <section class="section"><div class="section-inner">...</div></section>
- Service cards section must include:
  - a grid wrapper using .cards (preferred), .grid, or .services-grid
  - one card per service using .card (or .card card--service when an image is used)
  - title, description, and <span class="price"> for each service
  - at least one CTA using .btn or .btn--outline
- CTA section encouraging visitors to book/enquire and using design-system button classes
- Do NOT invent alternative component class names. Use existing design-system classes only.
- **Service schema JSON-LD** in a <script type="application/ld+json"> block with @graph containing an array of Service objects, each with name, description, provider (LocalBusiness with name "${businessName}"), and areaServed.`;

    case "contact":
      return `## Contact Page Requirements
- **Entity-rich h1**: "Contact ${businessName}${serviceArea ? ` | ${serviceArea}` : ""}"
- Contact form using Netlify Forms (add data-netlify="true" and name="contact" attributes to the <form>)
  - Fields: Name (required), Email (required), Phone (optional), Message (required, textarea)
  - Submit button
- Contact info section with:
  ${email ? `- Email: ${email}` : ""}
  ${phone ? `- Phone: ${phone}` : ""}
  ${bookingUrl ? `- Booking link: ${bookingUrl}` : ""}
  - Service area: ${serviceArea}`;

    case "testimonials":
      return `## Testimonials Page Requirements
- **Entity-rich h1**: "Client Reviews | ${businessName}"
- All testimonials displayed as styled blockquotes with attribution
- CTA section encouraging visitors to get in touch
- **Review + AggregateRating JSON-LD** in a <script type="application/ld+json"> block with @type LocalBusiness, aggregateRating (ratingValue 5, reviewCount ${testimonials.length}), and a review array with each testimonial as a Review object (reviewBody, author Person, ratingValue 5).`;

    case "faq":
      return `## FAQ Page Requirements
- **Entity-rich h1**: "FAQ | ${businessName}"
- FAQ items using <details>/<summary> elements for accessible expand/collapse
- Generate 4-6 relevant FAQs about doula/birth worker services if none are specified in the content
- CTA section encouraging visitors to get in touch
- **FAQPage JSON-LD** in a <script type="application/ld+json"> block with @type FAQPage and mainEntity array of Question objects, each with name and acceptedAnswer (Answer with text).`;

    default:
      return "";
  }
}
