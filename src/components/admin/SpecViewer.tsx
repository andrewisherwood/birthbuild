import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SiteSpec } from "@/types/site-spec";

interface SpecViewerProps {
  specId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Palette display names
// ---------------------------------------------------------------------------

const PALETTE_NAMES: Record<string, string> = {
  sage_sand: "Sage & Sand",
  blush_neutral: "Blush & Neutral",
  deep_earth: "Deep Earth",
  ocean_calm: "Ocean Calm",
  custom: "Custom",
};

const STYLE_NAMES: Record<string, string> = {
  modern: "Modern",
  classic: "Classic",
  minimal: "Minimal",
};

const TYPOGRAPHY_NAMES: Record<string, string> = {
  modern: "Modern",
  classic: "Classic",
  mixed: "Mixed",
};

// ---------------------------------------------------------------------------
// Colour swatch
// ---------------------------------------------------------------------------

function ColourSwatch({ colour, label }: { colour: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-6 w-6 rounded border border-gray-200"
        style={{ backgroundColor: colour }}
        aria-label={`${label}: ${colour}`}
      />
      <span className="text-xs text-gray-500">
        {label}: {colour}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable text
// ---------------------------------------------------------------------------

const MAX_TEXT_LENGTH = 300;

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= MAX_TEXT_LENGTH) {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">
        {expanded ? text : `${text.slice(0, MAX_TEXT_LENGTH)}...`}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-xs font-medium text-green-700 hover:text-green-800"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SpecViewer({ specId, onClose }: SpecViewerProps) {
  const [spec, setSpec] = useState<SiteSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSpec() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("site_specs")
        .select("*")
        .eq("id", specId)
        .single();

      if (!mounted) return;

      if (fetchError) {
        setError("Failed to load site specification.");
        setLoading(false);
        return;
      }

      setSpec(data as SiteSpec);
      setLoading(false);
    }

    void fetchSpec();

    return () => {
      mounted = false;
    };
  }, [specId]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-gray-200 bg-white shadow-xl">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Site Specification
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner className="h-8 w-8" />
            <span className="sr-only">Loading specification...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Spec content */}
        {spec && !loading && (
          <div className="space-y-6">
            {/* Business Details */}
            <Card title="Business Details">
              <dl className="space-y-3">
                {spec.business_name && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Business Name
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.business_name}
                    </dd>
                  </div>
                )}
                {spec.doula_name && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Name
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.doula_name}
                    </dd>
                  </div>
                )}
                {spec.tagline && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Tagline
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.tagline}
                    </dd>
                  </div>
                )}
                {spec.service_area && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Service Area
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.service_area}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Design */}
            <Card title="Design">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">
                    Palette
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {PALETTE_NAMES[spec.palette] ?? spec.palette}
                  </dd>
                </div>
                {spec.palette === "custom" && spec.custom_colours && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    <ColourSwatch
                      colour={spec.custom_colours.background}
                      label="Background"
                    />
                    <ColourSwatch
                      colour={spec.custom_colours.primary}
                      label="Primary"
                    />
                    <ColourSwatch
                      colour={spec.custom_colours.accent}
                      label="Accent"
                    />
                    <ColourSwatch
                      colour={spec.custom_colours.text}
                      label="Text"
                    />
                    <ColourSwatch
                      colour={spec.custom_colours.cta}
                      label="CTA"
                    />
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">
                    Typography
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {TYPOGRAPHY_NAMES[spec.typography] ?? spec.typography}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">
                    Style
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {STYLE_NAMES[spec.style] ?? spec.style}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Content */}
            <Card title="Content">
              <div className="space-y-4">
                {spec.bio && (
                  <div>
                    <h4 className="text-xs font-medium uppercase text-gray-500">
                      Bio
                    </h4>
                    <div className="mt-1">
                      <ExpandableText text={spec.bio} />
                    </div>
                  </div>
                )}
                {spec.philosophy && (
                  <div>
                    <h4 className="text-xs font-medium uppercase text-gray-500">
                      Philosophy
                    </h4>
                    <div className="mt-1">
                      <ExpandableText text={spec.philosophy} />
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Services */}
            {spec.services.length > 0 && (
              <Card title="Services">
                <ul className="divide-y divide-gray-100">
                  {spec.services.map((service, idx) => (
                    <li key={`${service.title}-${idx}`} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {service.title}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600">
                            {service.description}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-gray-700">
                          {service.price}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Testimonials */}
            {spec.testimonials.length > 0 && (
              <Card title="Testimonials">
                <ul className="space-y-4">
                  {spec.testimonials.map((testimonial, idx) => (
                    <li key={`${testimonial.name}-${idx}`}>
                      <blockquote className="text-sm italic text-gray-700">
                        &ldquo;{testimonial.quote}&rdquo;
                      </blockquote>
                      <p className="mt-1 text-xs text-gray-500">
                        &mdash; {testimonial.name}
                        {testimonial.context && `, ${testimonial.context}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Contact */}
            <Card title="Contact">
              <dl className="space-y-3">
                {spec.email && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Email
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.email}
                    </dd>
                  </div>
                )}
                {spec.phone && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Phone
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.phone}
                    </dd>
                  </div>
                )}
                {spec.booking_url && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Booking URL
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      <a
                        href={spec.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-700 hover:text-green-800 underline"
                      >
                        {spec.booking_url}
                      </a>
                    </dd>
                  </div>
                )}
                {Object.entries(spec.social_links).length > 0 && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Social Links
                    </dt>
                    <dd className="mt-1 space-y-1">
                      {Object.entries(spec.social_links)
                        .filter(
                          ([, url]) => url !== undefined && url !== "",
                        )
                        .map(([platform, url]) => (
                          <div key={platform}>
                            <span className="text-xs font-medium capitalize text-gray-500">
                              {platform}:{" "}
                            </span>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-green-700 hover:text-green-800 underline"
                            >
                              {url}
                            </a>
                          </div>
                        ))}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Deployment */}
            <Card title="Deployment">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={spec.status} />
                  </dd>
                </div>
                {spec.subdomain_slug && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Subdomain
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-900">
                      {spec.subdomain_slug}.birthbuild.com
                    </dd>
                  </div>
                )}
                {spec.deploy_url && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Live URL
                    </dt>
                    <dd className="mt-0.5">
                      <a
                        href={spec.deploy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-700 hover:text-green-800 underline"
                      >
                        {spec.deploy_url}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {spec.deploy_url && (
                <div className="mt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      window.open(spec.deploy_url!, "_blank", "noopener")
                    }
                  >
                    Open Live Site
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
