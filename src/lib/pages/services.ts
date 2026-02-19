/**
 * Services page generator.
 * Generates a page with a card per service: title, description, price, and CTA.
 */

import type { SiteSpec } from "@/types/site-spec";
import {
  escapeHtml,
  generateHead,
  generateNav,
  generateFooter,
} from "@/lib/pages/shared";
import { buildServiceSchemaArray, renderJsonLd } from "@/lib/schema-generators";

export function generateServicesPage(
  spec: SiteSpec,
  wordmark: string,
): string {
  const pageTitle = `Services | ${spec.business_name ?? "Birth Worker"}`;
  const pageDescription = `Explore the birth work services offered by ${spec.doula_name ?? spec.business_name ?? "your doula"}${spec.service_area ? ` in ${spec.service_area}` : ""}`;

  const head = generateHead(spec, pageTitle, pageDescription);
  const nav = generateNav(spec, wordmark, "services");
  const footer = generateFooter(spec);

  const hasContact = spec.pages.includes("contact");

  const serviceCards = spec.services
    .map(
      (svc) =>
        `<div class="card">
        <h2>${escapeHtml(svc.title)}</h2>
        <p>${escapeHtml(svc.description)}</p>
        <span class="price">${escapeHtml(svc.price)}</span>
        ${hasContact ? `<a href="contact.html" class="btn btn--outline">Enquire</a>` : ""}
      </div>`,
    )
    .join("\n      ");

  const ctaHtml = hasContact
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Interested in My Services?</h2>
      <p class="section-subtitle">Get in touch to discuss your needs and how I can support you.</p>
      <a href="contact.html" class="btn">Book a Consultation</a>
    </div>
  </section>`
    : "";

  const entityH1 = spec.service_area
    ? `Services | ${escapeHtml(spec.business_name ?? "Birth Worker")} in ${escapeHtml(spec.service_area)}`
    : `Services | ${escapeHtml(spec.business_name ?? "Birth Worker")}`;

  const serviceSchemaHtml = spec.services.length > 0
    ? renderJsonLd(buildServiceSchemaArray(spec))
    : "";

  return `<!DOCTYPE html>
<html lang="en-GB">
${head}
<body>
  ${nav}
  <main id="main">
    <section class="section">
      <div class="section-inner">
        <h1 class="section-title">${entityH1}</h1>
        <p class="section-subtitle">Explore the support I offer to families${spec.service_area ? ` across ${escapeHtml(spec.service_area)}` : ""}.</p>
        <div class="cards">
          ${serviceCards}
        </div>
      </div>
    </section>
    ${ctaHtml}
  </main>
  ${footer}
  ${serviceSchemaHtml}
</body>
</html>`;
}
