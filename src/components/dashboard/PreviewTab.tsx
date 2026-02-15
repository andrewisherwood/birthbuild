import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SiteSpec, SiteSpecStatus } from "@/types/site-spec";

interface PreviewTabProps {
  siteSpec: SiteSpec;
}

interface SectionSummary {
  label: string;
  fields: { label: string; value: string | null | undefined }[];
}

function buildSummary(siteSpec: SiteSpec): SectionSummary[] {
  return [
    {
      label: "Business Details",
      fields: [
        { label: "Business Name", value: siteSpec.business_name },
        { label: "Your Name", value: siteSpec.doula_name },
        { label: "Tagline", value: siteSpec.tagline },
        { label: "Service Area", value: siteSpec.service_area },
        {
          label: "Services",
          value:
            siteSpec.services && siteSpec.services.length > 0
              ? `${siteSpec.services.length} service(s)`
              : null,
        },
      ],
    },
    {
      label: "Design",
      fields: [
        { label: "Style", value: siteSpec.style },
        { label: "Palette", value: siteSpec.palette },
        { label: "Typography", value: siteSpec.typography },
      ],
    },
    {
      label: "Content",
      fields: [
        { label: "Bio", value: siteSpec.bio ? "Written" : null },
        {
          label: "Philosophy",
          value: siteSpec.philosophy ? "Written" : null,
        },
        {
          label: "Testimonials",
          value:
            siteSpec.testimonials && siteSpec.testimonials.length > 0
              ? `${siteSpec.testimonials.length} testimonial(s)`
              : null,
        },
        {
          label: "FAQ Section",
          value: siteSpec.faq_enabled ? "Enabled" : "Disabled",
        },
      ],
    },
    {
      label: "Contact & Social",
      fields: [
        { label: "Email", value: siteSpec.email },
        { label: "Phone", value: siteSpec.phone },
        { label: "Booking URL", value: siteSpec.booking_url },
        {
          label: "Doula UK Member",
          value: siteSpec.doula_uk ? "Yes" : "No",
        },
      ],
    },
    {
      label: "SEO",
      fields: [
        { label: "Primary Keyword", value: siteSpec.primary_keyword },
        {
          label: "Pages",
          value:
            siteSpec.pages && siteSpec.pages.length > 0
              ? siteSpec.pages.join(", ")
              : null,
        },
      ],
    },
  ];
}

const STATUS_LABELS: Record<SiteSpecStatus, { label: string; colour: string }> =
  {
    draft: { label: "Draft", colour: "bg-gray-100 text-gray-700" },
    building: { label: "Building...", colour: "bg-yellow-100 text-yellow-800" },
    live: { label: "Live", colour: "bg-green-100 text-green-800" },
    error: { label: "Error", colour: "bg-red-100 text-red-800" },
  };

export function PreviewTab({ siteSpec }: PreviewTabProps) {
  const summary = buildSummary(siteSpec);
  const statusInfo = STATUS_LABELS[siteSpec.status] ?? STATUS_LABELS.draft;

  return (
    <div className="space-y-6">
      <Card title="Build Status">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusInfo.colour}`}
          >
            {statusInfo.label}
          </span>
          {siteSpec.deploy_url && (
            <a
              href={siteSpec.deploy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-green-700 underline hover:text-green-800"
            >
              View live site
            </a>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <Button disabled>
            Build My Site
          </Button>
          <p className="flex items-center text-xs text-gray-500">
            Site building will be available in a future update.
          </p>
        </div>
      </Card>

      <Card title="Site Specification Summary">
        <div className="space-y-6">
          {summary.map((section) => (
            <div key={section.label}>
              <h3 className="text-sm font-semibold text-gray-900">
                {section.label}
              </h3>
              <dl className="mt-2 space-y-1">
                {section.fields.map((field) => (
                  <div key={field.label} className="flex gap-2 text-sm">
                    <dt className="w-36 shrink-0 text-gray-500">
                      {field.label}:
                    </dt>
                    <dd className="text-gray-900">
                      {field.value ?? (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-center">
        <Link
          to="/chat"
          className="text-sm font-medium text-green-700 underline hover:text-green-800"
        >
          Return to chat
        </Link>
      </div>
    </div>
  );
}
