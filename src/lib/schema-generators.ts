/**
 * Shared Schema.org JSON-LD builder functions for generated sites.
 * Used by both template-path page generators and referenced in LLM prompts.
 */

import type { SiteSpec, ServiceItem } from "@/types/site-spec";
import { getValidSocialLinks, type PhotoData } from "@/lib/pages/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SchemaObject = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render a schema object as a safe <script type="application/ld+json"> tag.
 * Escapes `<` to prevent script breakout (SEC).
 */
export function renderJsonLd(schema: SchemaObject): string {
  const safe = JSON.stringify(schema).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${safe}</script>`;
}

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

export function buildLocalBusinessSchema(
  spec: SiteSpec,
  photos: PhotoData[],
): SchemaObject {
  const schema: SchemaObject = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
    name: spec.business_name ?? "",
    description: spec.tagline ?? "",
  };

  if (spec.subdomain_slug) {
    schema["url"] = `https://${spec.subdomain_slug}.birthbuild.com`;
  }
  if (spec.email) {
    schema["email"] = spec.email;
  }
  if (spec.phone) {
    schema["telephone"] = spec.phone;
  }

  const headshot = photos.find((p) => p.purpose === "headshot");
  if (headshot) {
    schema["image"] = headshot.publicUrl;
  }

  if (spec.primary_location) {
    schema["address"] = {
      "@type": "PostalAddress",
      addressLocality: spec.primary_location,
    };
  }

  if (spec.service_area) {
    schema["areaServed"] = spec.service_area;
  }

  const credentials = buildCredentialList(spec);
  if (credentials.length > 0) {
    schema["hasCredential"] = credentials;
  }

  if (spec.services.length > 0) {
    schema["makesOffer"] = spec.services.map((svc) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: svc.title,
        description: svc.description,
      },
      price: svc.price,
      priceCurrency: "GBP",
    }));
  }

  const validSocial = getValidSocialLinks(spec.social_links);
  if (validSocial.length > 0) {
    schema["sameAs"] = validSocial.map((l) => l.url);
  }

  // Embed Person for the doula
  if (spec.doula_name) {
    const person: SchemaObject = {
      "@type": "Person",
      name: spec.doula_name,
    };
    if (spec.service_area) {
      person["workLocation"] = { "@type": "Place", name: spec.service_area };
    }
    schema["founder"] = person;
  }

  return schema;
}

export function buildServiceSchema(
  spec: SiteSpec,
  service: ServiceItem,
): SchemaObject {
  const schema: SchemaObject = {
    "@type": "Service",
    name: service.title,
    description: service.description,
    provider: {
      "@type": "LocalBusiness",
      name: spec.business_name ?? "",
    },
  };

  if (spec.service_area) {
    schema["areaServed"] = spec.service_area;
  }

  return schema;
}

export function buildServiceSchemaArray(spec: SiteSpec): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@graph": spec.services.map((svc) => buildServiceSchema(spec, svc)),
  };
}

export function buildReviewSchemas(spec: SiteSpec): SchemaObject[] {
  return spec.testimonials.map((t) => ({
    "@type": "Review",
    reviewBody: t.quote,
    author: { "@type": "Person", name: t.name },
    itemReviewed: {
      "@type": "LocalBusiness",
      name: spec.business_name ?? "",
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: 5,
      bestRating: 5,
    },
  }));
}

export function buildAggregateRatingSchema(
  spec: SiteSpec,
): SchemaObject | null {
  if (spec.testimonials.length < 2) return null;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: spec.business_name ?? "",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: 5,
      bestRating: 5,
      reviewCount: spec.testimonials.length,
    },
    review: buildReviewSchemas(spec),
  };
}

function buildCredentialList(spec: SiteSpec): SchemaObject[] {
  const credentials: SchemaObject[] = [];

  if (spec.training_provider) {
    const cred: SchemaObject = {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Professional Training",
      recognizedBy: { "@type": "Organization", name: spec.training_provider },
    };
    if (spec.training_year) {
      cred["dateCreated"] = spec.training_year;
    }
    credentials.push(cred);
  }

  if (spec.doula_uk) {
    credentials.push({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Professional Recognition",
      recognizedBy: { "@type": "Organization", name: "Doula UK" },
    });
  }

  for (const training of spec.additional_training) {
    credentials.push({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Additional Training",
      name: training,
    });
  }

  return credentials;
}

export function buildCredentialSchema(spec: SiteSpec): SchemaObject | null {
  const credentials = buildCredentialList(spec);
  if (credentials.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: spec.doula_name ?? spec.business_name ?? "",
    hasCredential: credentials,
  };
}
