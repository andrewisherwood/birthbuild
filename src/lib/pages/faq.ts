/**
 * FAQ page generator.
 * Generates a page with 6 hardcoded doula FAQ questions using details/summary accordion.
 * Only generated if faq_enabled is true.
 */

import type { SiteSpec } from "@/types/site-spec";
import {
  escapeHtml,
  generateHead,
  generateNav,
  generateFooter,
} from "@/lib/pages/shared";

interface FaqItem {
  question: string;
  answer: (serviceArea: string) => string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What does a doula do?",
    answer: (serviceArea) =>
      `A doula provides continuous emotional, physical, and informational support before, during, and after birth. I work with families${serviceArea ? ` across ${serviceArea}` : ""} to help them feel confident and prepared for their birthing experience. Unlike midwives, doulas do not provide medical care but instead complement the medical team by offering personalised, non-clinical support.`,
  },
  {
    question: "When should I hire a doula?",
    answer: () =>
      `Many families choose to engage a doula during the second trimester, around 20-24 weeks, but it's never too early or too late to reach out. Early engagement allows more time for us to build a relationship and prepare together, but I'm happy to support families at any stage of their pregnancy.`,
  },
  {
    question: "Do you work alongside midwives and doctors?",
    answer: () =>
      `Absolutely. A doula works alongside your medical team, not in place of them. I support you emotionally and practically while your midwife or doctor handles all clinical care. Research shows that having a doula alongside medical professionals can lead to more positive birth experiences and outcomes.`,
  },
  {
    question: "What happens if my birth doesn't go to plan?",
    answer: () =>
      `Birth is unpredictable, and I'm trained to support you through any scenario — whether that's a straightforward vaginal birth, an induction, or a caesarean section. My role is to ensure you feel informed, supported, and empowered regardless of how your birth unfolds. I help you understand your options and advocate for your preferences throughout.`,
  },
  {
    question: "Can my partner still be involved if I have a doula?",
    answer: () =>
      `Yes! Having a doula doesn't replace your partner's role — it enhances it. I support both you and your partner, giving them practical tools and confidence to be actively involved. Many partners say that having a doula helped them feel less anxious and more present during the birth. I'm there to support your whole family.`,
  },
  {
    question: "How do I know if a doula is right for me?",
    answer: () =>
      `I offer a free initial consultation where we can chat about your needs, expectations, and preferences. There's no obligation — it's simply a chance for us to see if we're a good fit. Most families find that having dedicated, continuous support during pregnancy and birth makes a meaningful difference to their overall experience.`,
  },
];

export function generateFaqPage(
  spec: SiteSpec,
  wordmark: string,
): string {
  const pageTitle = `FAQ | ${spec.business_name ?? "Birth Worker"}`;
  const pageDescription = `Frequently asked questions about doula support${spec.service_area ? ` in ${spec.service_area}` : ""}.`;

  const head = generateHead(spec, pageTitle, pageDescription);
  const nav = generateNav(spec, wordmark, "faq");
  const footer = generateFooter(spec);

  const serviceArea = spec.service_area ?? "";

  const faqItems = FAQ_ITEMS.map(
    (item) =>
      `<details class="faq-item">
        <summary>${escapeHtml(item.question)}</summary>
        <div class="faq-answer">
          <p>${escapeHtml(item.answer(serviceArea))}</p>
        </div>
      </details>`,
  ).join("\n      ");

  // Schema.org FAQ JSON-LD
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer(serviceArea),
      },
    })),
  };

  const ctaHtml = spec.pages.includes("contact")
    ? `<section class="section text-center">
    <div class="section-inner">
      <h2 class="section-title">Still Have Questions?</h2>
      <p class="section-subtitle">I'm always happy to chat. Get in touch and I'll respond as soon as I can.</p>
      <a href="contact.html" class="btn">Contact Me</a>
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
        <h1 class="section-title">Frequently Asked Questions</h1>
        <p class="section-subtitle">Common questions about doula support and working together.</p>
        ${faqItems}
      </div>
    </section>
    ${ctaHtml}
  </main>
  ${footer}
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
</body>
</html>`;
}
