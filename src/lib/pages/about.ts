/**
 * About page generator.
 * Generates the about/bio page with headshot, philosophy, qualifications, and CTA.
 */

import type { SiteSpec } from "@/types/site-spec";
import {
  escapeHtml,
  generateHead,
  generateNav,
  generateFooter,
  type PhotoData,
} from "@/lib/pages/shared";

export function generateAboutPage(
  spec: SiteSpec,
  photos: PhotoData[],
  wordmark: string,
): string {
  const doulaName = spec.doula_name ? escapeHtml(spec.doula_name) : "About Me";
  const pageTitle = `About ${spec.doula_name ?? "Me"} | ${spec.business_name ?? "Birth Worker"}`;
  const pageDescription = spec.bio
    ? spec.bio.substring(0, 160)
    : `Learn more about ${spec.doula_name ?? "your birth worker"}`;

  const head = generateHead(spec, pageTitle, pageDescription);
  const nav = generateNav(spec, wordmark, "about");
  const footer = generateFooter(spec);

  // Bio
  const bioHtml = spec.bio
    ? spec.bio
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((para) => `<p>${escapeHtml(para)}</p>`)
        .join("\n          ")
    : `<p>More information coming soon.</p>`;

  // Headshot photo
  const headshotPhoto = photos.find((p) => p.purpose === "headshot");
  const photoHtml = headshotPhoto
    ? `<div>
          <img src="${escapeHtml(headshotPhoto.publicUrl)}" alt="${escapeHtml(headshotPhoto.altText)}" class="about-photo" loading="lazy" />
        </div>`
    : "";

  // Philosophy
  const philosophyHtml = spec.philosophy
    ? `<section class="section section--alt">
    <div class="section-inner">
      <h2 class="section-title">My Philosophy</h2>
      <p>${escapeHtml(spec.philosophy)}</p>
    </div>
  </section>`
    : "";

  // Qualifications
  const qualifications: string[] = [];
  if (spec.doula_uk) {
    qualifications.push("Doula UK Recognised Doula");
  }
  if (spec.training_provider) {
    qualifications.push(`Trained with ${escapeHtml(spec.training_provider)}`);
  }

  const qualificationsHtml =
    qualifications.length > 0
      ? `<div class="qualifications">
          <h2>Qualifications &amp; Accreditation</h2>
          <ul>
            ${qualifications.map((q) => `<li>${q}</li>`).join("\n            ")}
          </ul>
        </div>`
      : "";

  // CTA
  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Let's Work Together</h2>
      <p class="section-subtitle">I'd love to hear about your birth wishes and how I can support you.</p>
      <a href="contact.html" class="btn">Get in Touch</a>
    </div>
  </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en-GB">
${head}
<body>
  ${nav}
  <main id="main">
    <section class="section">
      <div class="section-inner">
        <h1 class="section-title">About ${doulaName}</h1>
        <div class="about-grid">
          <div>
            ${bioHtml}
            ${qualificationsHtml}
          </div>
          ${photoHtml}
        </div>
      </div>
    </section>
    ${philosophyHtml}
    ${ctaHtml}
  </main>
  ${footer}
</body>
</html>`;
}
