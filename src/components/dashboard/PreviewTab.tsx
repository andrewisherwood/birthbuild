import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useBuild } from "@/hooks/useBuild";
import type { SiteSpec, SiteSpecStatus } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PreviewTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
  isStale?: boolean;
}

// ---------------------------------------------------------------------------
// Site summary helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Status labels
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<SiteSpecStatus, { label: string; colour: string }> =
  {
    draft: { label: "Draft", colour: "bg-gray-100 text-gray-700" },
    building: { label: "Building...", colour: "bg-yellow-100 text-yellow-800" },
    live: { label: "Live", colour: "bg-green-100 text-green-800" },
    error: { label: "Error", colour: "bg-red-100 text-red-800" },
  };

// ---------------------------------------------------------------------------
// Validation warnings
// ---------------------------------------------------------------------------

function getMissingFields(spec: SiteSpec): string[] {
  const missing: string[] = [];
  if (!spec.business_name) missing.push("business name");
  if (!spec.doula_name) missing.push("your name");
  if (!spec.service_area) missing.push("service area");
  if (!spec.services || spec.services.length < 1) missing.push("at least one service");
  if (!spec.email) missing.push("email address");
  return missing;
}

// ---------------------------------------------------------------------------
// Subdomain slugifier
// ---------------------------------------------------------------------------

function slugifySubdomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 63);
}

// ---------------------------------------------------------------------------
// Device preview sizes
// ---------------------------------------------------------------------------

type DeviceSize = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTHS: Record<DeviceSize, string> = {
  mobile: "375px",
  tablet: "768px",
  desktop: "100%",
};

const DEVICE_LABELS: Record<DeviceSize, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreviewTab({ siteSpec, onFieldChange, isStale = false }: PreviewTabProps) {
  const summary = buildSummary(siteSpec);
  const { building, buildError, triggerBuild, lastBuildStatus, validationWarnings } = useBuild(siteSpec);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");

  const currentStatus = lastBuildStatus?.status ?? siteSpec.status;
  const deployUrl = lastBuildStatus?.deploy_url ?? siteSpec.deploy_url;
  const statusInfo = STATUS_LABELS[currentStatus] ?? STATUS_LABELS.draft;
  const missingFields = getMissingFields(siteSpec);
  const canBuild = missingFields.length === 0 && !building;
  const isLive = currentStatus === "live";

  // Subdomain handling
  const subdomainValue =
    siteSpec.subdomain_slug ??
    (siteSpec.doula_name ? slugifySubdomain(siteSpec.doula_name) : "");

  const handleSubdomainChange = useCallback(
    (value: string) => {
      const slugified = slugifySubdomain(value);
      onFieldChange({ subdomain_slug: slugified });
    },
    [onFieldChange],
  );

  const handleBuild = useCallback(async () => {
    await triggerBuild();
  }, [triggerBuild]);

  return (
    <div className="space-y-6">
      {/* Build Status Card */}
      <Card title="Build Status">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusInfo.colour}`}
          >
            {statusInfo.label}
          </span>
          {deployUrl && isLive && (
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-green-700 underline hover:text-green-800"
            >
              View live site
            </a>
          )}
        </div>

        {/* Validation warnings */}
        {missingFields.length > 0 && !building && (
          <div
            className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3"
            role="alert"
          >
            <p className="text-sm font-medium text-yellow-800">
              Complete the following before building:
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-yellow-700">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Building animation */}
        {building && (
          <div className="mt-4" aria-live="polite">
            <p className="mb-2 text-sm font-medium text-yellow-800">
              Building your site...
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-yellow-100">
              <div className="h-full animate-pulse rounded-full bg-yellow-400" />
            </div>
          </div>
        )}

        {/* Build error */}
        {buildError && !building && (
          <div
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{buildError}</p>
          </div>
        )}

        {/* Success message */}
        {isLive && deployUrl && !building && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">
              Your site is live at{" "}
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                {deployUrl}
              </a>
            </p>
          </div>
        )}

        {/* Stale build banner */}
        {isLive && isStale && !building && (
          <div
            className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3"
            role="status"
          >
            <p className="text-sm text-yellow-800">
              You&rsquo;ve made changes since your last build. Rebuild to update your live site.
            </p>
          </div>
        )}

        {/* Build validation warnings (non-blocking) */}
        {validationWarnings.length > 0 && !building && (
          <div
            className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3"
            role="status"
          >
            <p className="text-sm font-medium text-yellow-800">Warnings:</p>
            <ul className="mt-1 list-inside list-disc text-sm text-yellow-700">
              {validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Build / Rebuild button */}
        <div className="mt-4">
          {(currentStatus === "draft" || currentStatus === "error") && (
            <Button
              onClick={handleBuild}
              loading={building}
              disabled={!canBuild}
            >
              Build My Site
            </Button>
          )}
          {isLive && (
            <Button
              onClick={handleBuild}
              loading={building}
              disabled={!canBuild}
              variant="secondary"
            >
              Rebuild Site
            </Button>
          )}
          {currentStatus === "building" && (
            <Button disabled loading>
              Building...
            </Button>
          )}
        </div>
      </Card>

      {/* Subdomain Input */}
      <Card title="Subdomain">
        <div>
          <label
            htmlFor="subdomain-slug"
            className="block text-sm font-medium text-gray-700"
          >
            Your site address
          </label>
          <div className="mt-1 flex items-center">
            <input
              id="subdomain-slug"
              type="text"
              value={subdomainValue}
              onChange={(e) => handleSubdomainChange(e.target.value)}
              readOnly={isLive}
              disabled={isLive}
              maxLength={63}
              className={`block w-48 rounded-l-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:ring-green-500 ${
                isLive ? "bg-gray-50 text-gray-500" : ""
              }`}
              aria-describedby="subdomain-preview"
            />
            <span
              id="subdomain-preview"
              className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            >
              .birthbuild.com
            </span>
          </div>
          {isLive && (
            <p className="mt-1 text-xs text-gray-500">
              Subdomain cannot be changed after deployment.
            </p>
          )}
        </div>
      </Card>

      {/* Preview Iframe (only when deploy_url exists) */}
      {deployUrl && (
        <Card title="Site Preview">
          <div className="mb-4 flex items-center gap-2">
            {(Object.keys(DEVICE_WIDTHS) as DeviceSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setDeviceSize(size)}
                aria-pressed={deviceSize === size}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  deviceSize === size
                    ? "bg-green-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {DEVICE_LABELS[size]}
              </button>
            ))}
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-sm font-medium text-green-700 underline hover:text-green-800"
            >
              Open in new tab
            </a>
          </div>
          <div
            className="flex justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
          >
            <iframe
              src={deployUrl}
              title="Site preview"
              sandbox="allow-scripts allow-same-origin"
              className="h-[600px] border-0 bg-white"
              style={{ width: DEVICE_WIDTHS[deviceSize] }}
            />
          </div>
        </Card>
      )}

      {/* Site Specification Summary */}
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
