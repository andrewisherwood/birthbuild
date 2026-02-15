/**
 * Contact page generator.
 * Generates a page with a Netlify form, contact details, and social links.
 */

import type { SiteSpec } from "@/types/site-spec";
import {
  escapeHtml,
  generateHead,
  generateNav,
  generateFooter,
  getValidSocialLinks,
} from "@/lib/pages/shared";

export function generateContactPage(
  spec: SiteSpec,
  wordmark: string,
): string {
  const pageTitle = `Contact | ${spec.business_name ?? "Birth Worker"}`;
  const pageDescription = `Get in touch with ${spec.doula_name ?? spec.business_name ?? "your doula"}. Enquire about birth work services${spec.service_area ? ` in ${spec.service_area}` : ""}.`;

  const head = generateHead(spec, pageTitle, pageDescription);
  const nav = generateNav(spec, wordmark, "contact");
  const footer = generateFooter(spec);

  // Netlify form
  const formHtml = `<form name="contact" method="POST" data-netlify="true" class="contact-form" aria-label="Contact form">
        <input type="hidden" name="form-name" value="contact" />
        <div class="form-group">
          <label for="contact-name">Your Name</label>
          <input type="text" id="contact-name" name="name" required autocomplete="name" />
        </div>
        <div class="form-group">
          <label for="contact-email">Your Email</label>
          <input type="email" id="contact-email" name="email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="contact-message">Your Message</label>
          <textarea id="contact-message" name="message" required></textarea>
        </div>
        <button type="submit" class="btn">Send Message</button>
      </form>`;

  // Contact info
  const contactItems: string[] = [];
  if (spec.email) {
    contactItems.push(
      `<dt>Email</dt><dd><a href="mailto:${escapeHtml(spec.email)}">${escapeHtml(spec.email)}</a></dd>`,
    );
  }
  if (spec.phone) {
    contactItems.push(
      `<dt>Phone</dt><dd><a href="tel:${escapeHtml(spec.phone)}">${escapeHtml(spec.phone)}</a></dd>`,
    );
  }
  if (spec.booking_url) {
    contactItems.push(
      `<dt>Book Online</dt><dd><a href="${escapeHtml(spec.booking_url)}" target="_blank" rel="noopener noreferrer">Schedule a consultation</a></dd>`,
    );
  }
  if (spec.service_area) {
    contactItems.push(
      `<dt>Service Area</dt><dd>${escapeHtml(spec.service_area)}</dd>`,
    );
  }

  const contactInfoHtml =
    contactItems.length > 0
      ? `<dl class="contact-info">
          ${contactItems.join("\n          ")}
        </dl>`
      : "";

  // Social links
  const validLinks = getValidSocialLinks(spec.social_links);
  const socialHtml =
    validLinks.length > 0
      ? `<div class="mt-2">
          <h3>Find Me Online</h3>
          <div class="footer-social" style="justify-content: flex-start; margin-top: 0.75rem;">
            ${validLinks
              .map(
                (link) =>
                  `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.platform)}">${escapeHtml(link.platform)}</a>`,
              )
              .join("\n            ")}
          </div>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en-GB">
${head}
<body>
  ${nav}
  <main id="main">
    <section class="section">
      <div class="section-inner">
        <h1 class="section-title">Get in Touch</h1>
        <p class="section-subtitle">I'd love to hear from you. Fill in the form below or use any of the contact details provided.</p>
        <div class="about-grid">
          <div>
            ${formHtml}
          </div>
          <div>
            ${contactInfoHtml}
            ${socialHtml}
          </div>
        </div>
      </div>
    </section>
  </main>
  ${footer}
</body>
</html>`;
}
