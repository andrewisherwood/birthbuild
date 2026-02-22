import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useBuild } from "@/hooks/useBuild";
import { usePublish } from "@/hooks/usePublish";
import { GenerationProgressIndicator } from "@/components/dashboard/GenerationProgress";
import { ToggleSwitch } from "@/components/dashboard/ToggleSwitch";
import type { SiteSpec } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PreviewTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
  isStale?: boolean;
  refreshSpec?: () => Promise<void>;
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

export function PreviewTab({ siteSpec, onFieldChange, isStale = false, refreshSpec }: PreviewTabProps) {
  const summary = buildSummary(siteSpec);
  const {
    building,
    buildError,
    triggerBuild,
    triggerLlmBuild,
    generationProgress,
    lastBuildStatus,
    validationWarnings,
  } = useBuild(siteSpec);
  const { publishing, publishError, publish, unpublish } = usePublish(siteSpec, {
    onComplete: () => {
      if (refreshSpec) void refreshSpec();
    },
  });
  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");

  const currentStatus = lastBuildStatus?.status ?? siteSpec.status;
  const deployUrl = lastBuildStatus?.deploy_url ?? siteSpec.deploy_url;
  const previewUrl = lastBuildStatus?.preview_url ?? siteSpec.preview_url;
  const missingFields = getMissingFields(siteSpec);
  const canBuild = missingFields.length === 0 && !building && !publishing;
  const isLive = currentStatus === "live";
  const isPreview = currentStatus === "preview";

  const useLlm = siteSpec.use_llm_generation;

  // Subdomain: editable for draft/preview, locked when live
  const subdomainLocked = isLive;
  const subdomainValue =
    siteSpec.subdomain_slug ??
    (siteSpec.doula_name ? slugifySubdomain(siteSpec.doula_name) : "");

  // Auto-persist computed subdomain so the DB stays in sync with the UI
  const autoPersistedRef = useRef(false);
  useEffect(() => {
    if (!siteSpec.subdomain_slug && subdomainValue && !autoPersistedRef.current) {
      autoPersistedRef.current = true;
      onFieldChange({ subdomain_slug: subdomainValue });
    }
  }, [siteSpec.subdomain_slug, subdomainValue, onFieldChange]);

  const handleSubdomainChange = useCallback(
    (value: string) => {
      const slugified = slugifySubdomain(value);
      onFieldChange({ subdomain_slug: slugified });
    },
    [onFieldChange],
  );

  const handleBuild = useCallback(() => {
    const promise = useLlm ? triggerLlmBuild() : triggerBuild();
    promise.catch((err: unknown) => {
      console.error("[PreviewTab] Unhandled build error:", err);
    });
  }, [useLlm, triggerLlmBuild, triggerBuild]);

  const handleLlmToggle = useCallback(
    (enabled: boolean) => {
      onFieldChange({ use_llm_generation: enabled });
    },
    [onFieldChange],
  );

  // Use preview_url for iframe (always available after first build)
  const iframeUrl = previewUrl ?? deployUrl;

  return (
    <div className="space-y-6">
      {/* AI Generation Toggle */}
      <Card title="Build Mode">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Use AI-generated pages
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              AI generates unique, creative designs for your site. Template mode uses a standard layout.
            </p>
          </div>
          <ToggleSwitch
            checked={useLlm}
            onChange={handleLlmToggle}
            label="Use AI-generated pages"
          />
        </div>
        {useLlm && (
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
            AI generation takes 1-2 minutes and uses your instructor&rsquo;s API credits.
            Each build creates a unique design.
          </p>
        )}
      </Card>

      {/* Build Status Card */}
      <Card title="Build Status">
        <div className="flex items-center gap-3">
          <StatusBadge status={currentStatus} />
          {isLive && deployUrl && (
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-green-700 underline hover:text-green-800"
            >
              View live site
            </a>
          )}
          {isPreview && previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-700 underline hover:text-blue-800"
            >
              View preview
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

        {/* LLM generation progress (replaces simple building animation) */}
        {useLlm && generationProgress && (
          <GenerationProgressIndicator progress={generationProgress} />
        )}

        {/* Template building animation */}
        {building && !useLlm && (
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

        {/* Publish error */}
        {publishError && !publishing && (
          <div
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{publishError}</p>
          </div>
        )}

        {/* Preview success message */}
        {isPreview && previewUrl && !building && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm text-blue-700">
              Your site preview is ready at{" "}
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                {previewUrl}
              </a>
              . Click <strong>Publish</strong> to make it live on your custom domain.
            </p>
          </div>
        )}

        {/* Live success message */}
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
        {(isLive || isPreview) && isStale && !building && (
          <div
            className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3"
            role="status"
          >
            <p className="text-sm text-yellow-800">
              You&rsquo;ve made changes since your last build. Rebuild to update your site.
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

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-3">
          {(currentStatus === "draft" || currentStatus === "error") && (
            <Button
              onClick={handleBuild}
              loading={building}
              disabled={!canBuild}
            >
              {useLlm ? "Generate My Site" : "Build My Site"}
            </Button>
          )}
          {(isPreview || isLive) && (
            <Button
              onClick={handleBuild}
              loading={building}
              disabled={!canBuild}
              variant="secondary"
            >
              {useLlm ? "Regenerate Site" : "Rebuild Site"}
            </Button>
          )}
          {isPreview && (
            <Button
              onClick={() => void publish()}
              loading={publishing}
              disabled={building || publishing}
            >
              Publish
            </Button>
          )}
          {isLive && (
            <Button
              onClick={() => void unpublish()}
              loading={publishing}
              disabled={building || publishing}
              variant="outline"
            >
              Unpublish
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
              readOnly={subdomainLocked}
              disabled={subdomainLocked}
              maxLength={63}
              className={`block w-48 rounded-l-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:ring-green-500 ${
                subdomainLocked ? "bg-gray-50 text-gray-500" : ""
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
          {subdomainLocked && (
            <p className="mt-1 text-xs text-gray-500">
              Subdomain cannot be changed while the site is live. Unpublish first to edit.
            </p>
          )}
        </div>
      </Card>

      {/* Preview Iframe (uses preview_url, always available after first build) */}
      {iframeUrl && (
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
              href={iframeUrl}
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
              src={iframeUrl}
              title="Site preview"
              sandbox="allow-scripts"
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
