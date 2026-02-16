import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SiteSpec } from "@/types/site-spec";

interface CompletionCardProps {
  siteSpec: SiteSpec;
  siteId?: string;
  onNavigate: (path: string) => void;
}

export function CompletionCard({ siteSpec, siteId, onNavigate }: CompletionCardProps) {
  const servicesCount = siteSpec.services?.length ?? 0;
  const hasContact = Boolean(siteSpec.email || siteSpec.phone);
  const siteIdParam = siteId ? `&site_id=${siteId}` : "";
  const dashboardBase = siteId ? `/dashboard?site_id=${siteId}` : "/dashboard";

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <div className="flex flex-col items-center text-center">
          {/* Green checkmark */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Your site information is ready!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Here&rsquo;s a summary of what we&rsquo;ve gathered. You can review
            and edit everything in the dashboard.
          </p>
        </div>

        {/* Summary grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 text-left">
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">
              Business
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {siteSpec.business_name ?? "Not set"}
            </p>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">
              Services
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {servicesCount > 0
                ? `${servicesCount} ${servicesCount === 1 ? "service" : "services"}`
                : "None yet"}
            </p>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">
              Style & Palette
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {siteSpec.style ?? "Not set"} /{" "}
              {siteSpec.palette?.replace(/_/g, " ") ?? "Not set"}
            </p>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">
              Contact
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {hasContact ? "Provided" : "Not set"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="secondary"
            onClick={() => onNavigate(`/dashboard?tab=photos${siteIdParam}`)}
          >
            Upload Photos
          </Button>
          <Button onClick={() => onNavigate(dashboardBase)}>
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
