/**
 * Home page generator.
 * Generates the landing page with hero, services overview, featured testimonial,
 * about teaser, Schema.org JSON-LD, and CTA section.
 */

import type { SiteSpec } from "@/types/site-spec";
import {
  escapeHtml,
  generateHead,
  generateNav,
  generateFooter,
  getValidSocialLinks,
  type PhotoData,
} from "@/lib/pages/shared";

export function generateHomePage(
  spec: SiteSpec,
  photos: PhotoData[],
  wordmark: string,
): string {
  const businessName = spec.business_name ? escapeHtml(spec.business_name) : "My Doula Practice";
  const tagline = spec.tagline ? escapeHtml(spec.tagline) : "";
  const serviceArea = spec.service_area ? escapeHtml(spec.service_area) : "";

  const pageTitle = `${spec.business_name ?? "Home"} | Birth Worker`;
  const pageDescription = spec.tagline ?? `${spec.business_name ?? "Professional"} birth work services${spec.service_area ? ` in ${spec.service_area}` : ""}`;

  const head = generateHead(spec, pageTitle, pageDescription);
  const nav = generateNav(spec, wordmark, "home");
  const footer = generateFooter(spec);

  // Hero section
  const heroCta = spec.pages.includes("contact")
    ? `<a href="contact.html" class="btn">Get in Touch</a>`
    : "";
  const heroHtml = `<section class="hero">
    <div class="hero-inner">
      <h1>${businessName}</h1>
      ${tagline ? `<p class="tagline">${tagline}</p>` : ""}
      ${heroCta}
    </div>
  </section>`;

  // Services overview (max 3)
  let servicesHtml = "";
  if (spec.services.length > 0) {
    const previewServices = spec.services.slice(0, 3);
    const serviceCards = previewServices
      .map(
        (svc) =>
          `<div class="card">
          <h3>${escapeHtml(svc.title)}</h3>
          <p>${escapeHtml(svc.description)}</p>
          <span class="price">${escapeHtml(svc.price)}</span>
          ${spec.pages.includes("contact") ? `<a href="contact.html" class="btn btn--outline">Enquire</a>` : ""}
        </div>`,
      )
      .join("\n      ");

    const viewAllLink =
      spec.services.length > 3 && spec.pages.includes("services")
        ? `<div class="text-center mt-2"><a href="services.html" class="btn btn--outline">View All Services</a></div>`
        : "";

    servicesHtml = `<section class="section section--alt" id="services">
    <div class="section-inner">
      <h2 class="section-title">Services</h2>
      <div class="cards">${serviceCards}</div>
      ${viewAllLink}
    </div>
  </section>`;
  }

  // Featured testimonial (first one)
  let testimonialHtml = "";
  if (spec.testimonials.length > 0) {
    const first = spec.testimonials[0]!;
    const viewAllLink =
      spec.pages.includes("testimonials") && spec.testimonials.length > 1
        ? `<div class="mt-2"><a href="testimonials.html" class="btn btn--outline">Read More Testimonials</a></div>`
        : "";

    testimonialHtml = `<section class="section" id="testimonials">
    <div class="section-inner">
      <h2 class="section-title">What Families Say</h2>
      <div class="testimonial">
        <blockquote>&ldquo;${escapeHtml(first.quote)}&rdquo;</blockquote>
        <cite>${escapeHtml(first.name)}</cite>
        <span class="context">${escapeHtml(first.context)}</span>
      </div>
      ${viewAllLink}
    </div>
  </section>`;
  }

  // About teaser
  let aboutHtml = "";
  if (spec.bio) {
    const headshotPhoto = photos.find((p) => p.purpose === "headshot");
    const photoTag = headshotPhoto
      ? `<img src="${escapeHtml(headshotPhoto.publicUrl)}" alt="${escapeHtml(headshotPhoto.altText)}" class="about-photo" />`
      : "";
    const bioTeaser = spec.bio.length > 200 ? spec.bio.substring(0, 200) + "..." : spec.bio;
    const readMore = spec.pages.includes("about")
      ? `<a href="about.html" class="btn btn--outline">Read More About Me</a>`
      : "";

    aboutHtml = `<section class="section section--alt" id="about">
    <div class="section-inner">
      <h2 class="section-title">About</h2>
      <div class="about-grid">
        <div>
          <p>${escapeHtml(bioTeaser)}</p>
          <div class="mt-2">${readMore}</div>
        </div>
        ${photoTag ? `<div>${photoTag}</div>` : ""}
      </div>
    </div>
  </section>`;
  }

  // Schema.org JSON-LD
  const validSocial = getValidSocialLinks(spec.social_links);
  const schemaData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: spec.business_name ?? "",
    description: spec.tagline ?? "",
  };
  if (spec.service_area) {
    schemaData["areaServed"] = spec.service_area;
  }
  if (spec.email) {
    schemaData["email"] = spec.email;
  }
  if (spec.phone) {
    schemaData["telephone"] = spec.phone;
  }
  if (validSocial.length > 0) {
    schemaData["sameAs"] = validSocial.map((l) => l.url);
  }
  const schemaHtml = `<script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;

  // CTA section
  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Ready to Begin Your Journey?</h2>
      <p class="section-subtitle">${serviceArea ? `Supporting families across ${serviceArea}.` : "Supporting families through pregnancy, birth, and beyond."}</p>
      <a href="contact.html" class="btn">Book a Free Consultation</a>
    </div>
  </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en-GB">
${head}
<body>
  ${nav}
  <main id="main">
    ${heroHtml}
    ${servicesHtml}
    ${testimonialHtml}
    ${aboutHtml}
    ${ctaHtml}
  </main>
  ${footer}
  ${schemaHtml}
</body>
</html>`;
}
