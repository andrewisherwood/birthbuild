import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSpec } from "@/hooks/useSiteSpec";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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
// Page
// ---------------------------------------------------------------------------

export default function PreviewPage() {
  const { loading: authLoading } = useAuth();
  const { siteSpec, loading: specLoading } = useSiteSpec();
  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");

  if (authLoading || specLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <LoadingSpinner className="h-8 w-8" />
        <p className="text-sm text-gray-500">Loading preview…</p>
      </main>
    );
  }

  if (!siteSpec || !siteSpec.deploy_url) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold text-gray-900">
          No site built yet
        </h1>
        <p className="text-center text-gray-600">
          Head to your dashboard to build and preview your site.
        </p>
        <Link
          to="/dashboard"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          Go to Dashboard
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-green-700 hover:text-green-800"
          aria-label="Back to dashboard"
        >
          &larr; Dashboard
        </Link>

        <div className="flex items-center gap-1">
          {(Object.keys(DEVICE_WIDTHS) as DeviceSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setDeviceSize(size)}
              aria-pressed={deviceSize === size}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                deviceSize === size
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {DEVICE_LABELS[size]}
            </button>
          ))}
        </div>

        <a
          href={siteSpec.deploy_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm font-medium text-green-700 underline hover:text-green-800"
        >
          Open in new tab
        </a>
      </header>

      {/* Full-screen iframe */}
      <main className="flex flex-1 justify-center overflow-hidden bg-gray-100">
        <iframe
          src={siteSpec.deploy_url}
          title="Full site preview"
          sandbox="allow-scripts allow-same-origin"
          className="h-full border-0 bg-white"
          style={{ width: DEVICE_WIDTHS[deviceSize] }}
        />
      </main>
    </div>
  );
}
