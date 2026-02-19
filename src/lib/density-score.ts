/**
 * Specification density scoring for site specs.
 *
 * 8 core points (functional site) + 17 depth points (personal site) = 25 max.
 */

import type { SiteSpec } from "@/types/site-spec";

export type DensityLevel = "low" | "medium" | "high" | "excellent";

export interface DensityResult {
  coreScore: number;
  depthScore: number;
  totalScore: number;
  percentage: number;
  level: DensityLevel;
  suggestions: string[];
}

const MAX_CORE = 8;
const MAX_DEPTH = 17;
const MAX_TOTAL = MAX_CORE + MAX_DEPTH;

function getLevelForScore(score: number): DensityLevel {
  if (score >= 21) return "excellent";
  if (score >= 16) return "high";
  if (score >= 9) return "medium";
  return "low";
}

export function calculateDensityScore(spec: SiteSpec): DensityResult {
  let coreScore = 0;
  let depthScore = 0;

  // --- Core fields (8 points) ---
  if (spec.business_name) coreScore++;
  if (spec.doula_name) coreScore++;
  if (spec.service_area) coreScore++;
  if (spec.services && spec.services.length > 0) coreScore++;
  if (spec.email) coreScore++;
  if (spec.style) coreScore++;
  if (spec.palette) coreScore++;
  if (spec.bio) coreScore++;

  // --- Depth fields (17 points) ---
  if (spec.primary_location) depthScore++;

  // Service areas bonus: 3+ comma-separated areas
  if (spec.service_area) {
    const areas = spec.service_area.split(",").map((a) => a.trim()).filter(Boolean);
    if (areas.length >= 3) depthScore++;
  }

  // Birth types specified on any service
  if (
    spec.services?.some(
      (s) => Array.isArray(s.birth_types) && s.birth_types.length > 0,
    )
  ) {
    depthScore++;
  }

  // Experience level on any service
  if (spec.services?.some((s) => s.experience_level)) depthScore++;

  if (spec.bio_origin_story) depthScore++;
  if (spec.philosophy) depthScore++;
  if (spec.training_provider) depthScore++;
  if (spec.training_year) depthScore++;
  if (spec.additional_training && spec.additional_training.length > 0) depthScore++;

  // Testimonials (1+)
  if (spec.testimonials && spec.testimonials.length > 0) depthScore++;

  // Testimonial with context (name + context filled on at least one)
  if (
    spec.testimonials?.some((t) => t.name && t.context)
  ) {
    depthScore++;
  }

  if (spec.brand_feeling) depthScore++;

  // Social links (1+)
  if (spec.social_links) {
    const hasAny = Object.values(spec.social_links).some(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (hasAny) depthScore++;
  }

  if (spec.phone) depthScore++;
  if (spec.booking_url) depthScore++;
  if (spec.client_perception) depthScore++;
  if (spec.signature_story) depthScore++;

  const totalScore = coreScore + depthScore;
  const percentage = Math.round((totalScore / MAX_TOTAL) * 100);
  const level = getLevelForScore(totalScore);

  // Generate top 3 suggestions
  const suggestions: string[] = [];

  if (!spec.bio_origin_story && suggestions.length < 3) {
    suggestions.push("Tell us how you became a birth worker — your origin story makes your About page personal.");
  }
  if ((!spec.testimonials || spec.testimonials.length === 0) && suggestions.length < 3) {
    suggestions.push("Add a client testimonial — even one quote builds real trust with visitors.");
  }
  if (!spec.philosophy && suggestions.length < 3) {
    suggestions.push("Describe your philosophy or approach — it helps families know if you're the right fit.");
  }
  if (!spec.primary_location && suggestions.length < 3) {
    suggestions.push("Add your primary location — it helps families in your area find you.");
  }
  if (!spec.training_provider && suggestions.length < 3) {
    suggestions.push("Mention your training provider — it adds credibility and helps with search.");
  }
  if (!spec.brand_feeling && suggestions.length < 3) {
    suggestions.push("Describe the feeling you want your site to give — it guides the design direction.");
  }
  if (!spec.client_perception && suggestions.length < 3) {
    suggestions.push("Share what clients say about you most often — it adds authenticity to your site.");
  }
  if ((!spec.additional_training || spec.additional_training.length === 0) && suggestions.length < 3) {
    suggestions.push("List any additional training or CPD — spinning babies, aromatherapy, rebozo, etc.");
  }
  if (!spec.signature_story && suggestions.length < 3) {
    suggestions.push("Share a memorable birth story (no names) — it makes your About page feel human.");
  }
  if (!spec.booking_url && suggestions.length < 3) {
    suggestions.push("Add a booking link (Calendly, Acuity) — it makes it easy for families to reach you.");
  }

  return {
    coreScore,
    depthScore,
    totalScore,
    percentage,
    level,
    suggestions: suggestions.slice(0, 3),
  };
}
