import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { TabNav } from "@/components/dashboard/TabNav";
import { ProgressIndicator } from "@/components/dashboard/ProgressIndicator";
import type { TabKey } from "@/components/dashboard/TabNav";
import type { SiteSpec } from "@/types/site-spec";

const VALID_TABS: TabKey[] = ["business", "design", "content", "photos", "contact", "seo", "preview"];

interface DashboardShellProps {
  siteSpec: SiteSpec;
  loading: boolean;
  error: string | null;
  children: (activeTab: TabKey) => React.ReactNode;
  backLink?: { label: string; to: string };
}

export function DashboardShell({
  siteSpec,
  loading,
  error,
  children,
  backLink,
}: DashboardShellProps) {
  const { signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const initialTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "business";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
        <span className="sr-only">Loading your dashboard...</span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-gray-600">
          Something went wrong loading your site specification. Please try again.
        </p>
        <Link
          to="/chat"
          className="text-sm font-medium text-green-700 hover:text-green-800 underline"
        >
          Return to chat
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-gray-900">
              {siteSpec.business_name ?? "Untitled Site"}
            </h1>
            <ProgressIndicator siteSpec={siteSpec} className="mt-2 max-w-xs" />
          </div>
          <div className="flex shrink-0 gap-2">
            {backLink && (
              <Link
                to={backLink.to}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
              >
                {backLink.label}
              </Link>
            )}
            <Link
              to={siteSpec.id && backLink ? `/chat?site_id=${siteSpec.id}` : "/chat"}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
            >
              Back to chat
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <TabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        siteSpec={siteSpec}
        className="bg-white"
      />

      {/* Tab content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          {children(activeTab)}
        </div>
      </main>
    </div>
  );
}
