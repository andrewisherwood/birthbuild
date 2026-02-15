/**
 * Testimonials page generator.
 * Generates a page with blockquote testimonials from clients.
 * Only generated if "testimonials" is in spec.pages and testimonials.length > 0.
 */

import type { SiteSpec } from "@/types/site-spec";
import {
  escapeHtml,
  generateHead,
  generateNav,
  generateFooter,
} from "@/lib/pages/shared";

export function generateTestimonialsPage(
  spec: SiteSpec,
  wordmark: string,
): string {
  const pageTitle = `Testimonials | ${spec.business_name ?? "Birth Worker"}`;
  const pageDescription = `Read what families say about working with ${spec.doula_name ?? spec.business_name ?? "your doula"}.`;

  const head = generateHead(spec, pageTitle, pageDescription);
  const nav = generateNav(spec, wordmark, "testimonials");
  const footer = generateFooter(spec);

  const testimonialCards = spec.testimonials
    .map(
      (t) =>
        `<div class="testimonial">
        <blockquote>&ldquo;${escapeHtml(t.quote)}&rdquo;</blockquote>
        <cite>${escapeHtml(t.name)}</cite>
        <span class="context">${escapeHtml(t.context)}</span>
      </div>`,
    )
    .join("\n      ");

  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Start Your Journey</h2>
      <p class="section-subtitle">Ready to experience the support that these families loved?</p>
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
        <h1 class="section-title">What Families Say</h1>
        <p class="section-subtitle">Kind words from the families I've had the privilege of supporting.</p>
        ${testimonialCards}
      </div>
    </section>
    ${ctaHtml}
  </main>
  ${footer}
</body>
</html>`;
}
