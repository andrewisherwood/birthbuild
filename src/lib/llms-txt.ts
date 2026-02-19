/**
 * llms.txt generator for generated sites.
 * Follows the llmstxt.org Markdown specification.
 * Purely deterministic — no LLM call required.
 */

import type { SiteSpec } from "@/types/site-spec";

export function generateLlmsTxt(spec: SiteSpec): string {
  const lines: string[] = [];

  // Title
  const name = spec.business_name ?? "Birth Worker";
  lines.push(`# ${name}`);

  // Tagline + service area
  const taglineParts: string[] = [];
  if (spec.tagline) taglineParts.push(spec.tagline);
  if (spec.service_area) taglineParts.push(`Serving ${spec.service_area}`);
  if (taglineParts.length > 0) {
    lines.push(`> ${taglineParts.join(". ")}.`);
  }

  lines.push("");

  // Services
  if (spec.services.length > 0) {
    lines.push("## Services");
    for (const svc of spec.services) {
      const pricePart = svc.price ? ` (${svc.price})` : "";
      lines.push(`- ${svc.title}: ${svc.description}${pricePart}`);
    }
    lines.push("");
  }

  // About
  if (spec.bio) {
    lines.push("## About");
    const truncated = spec.bio.length > 500
      ? spec.bio.substring(0, 500).replace(/\s+\S*$/, "") + "..."
      : spec.bio;
    lines.push(truncated);
    lines.push("");
  }

  // Qualifications
  const qualifications: string[] = [];
  if (spec.training_provider) {
    const yearPart = spec.training_year ? ` (${spec.training_year})` : "";
    qualifications.push(`${spec.training_provider}${yearPart}`);
  }
  if (spec.doula_uk) {
    qualifications.push("Doula UK recognised");
  }
  for (const t of spec.additional_training) {
    qualifications.push(t);
  }
  if (qualifications.length > 0) {
    lines.push("## Qualifications");
    for (const q of qualifications) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  // Contact
  const contactLines: string[] = [];
  if (spec.email) contactLines.push(`- Email: ${spec.email}`);
  if (spec.phone) contactLines.push(`- Phone: ${spec.phone}`);
  if (spec.subdomain_slug) {
    contactLines.push(`- Website: https://${spec.subdomain_slug}.birthbuild.com`);
  }
  if (spec.booking_url) contactLines.push(`- Booking: ${spec.booking_url}`);
  if (contactLines.length > 0) {
    lines.push("## Contact");
    lines.push(...contactLines);
    lines.push("");
  }

  // Service Area
  if (spec.service_area) {
    lines.push("## Service Area");
    lines.push(spec.service_area);
    lines.push("");
  }

  return lines.join("\n");
}
