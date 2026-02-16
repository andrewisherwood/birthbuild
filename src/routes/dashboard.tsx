import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSpec } from "@/hooks/useSiteSpec";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BusinessDetailsTab } from "@/components/dashboard/BusinessDetailsTab";
import { DesignTab } from "@/components/dashboard/DesignTab";
import { ContentTab } from "@/components/dashboard/ContentTab";
import { PhotosTab } from "@/components/dashboard/PhotosTab";
import { ContactTab } from "@/components/dashboard/ContactTab";
import { SeoTab } from "@/components/dashboard/SeoTab";
import { PreviewTab } from "@/components/dashboard/PreviewTab";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { TabKey } from "@/components/dashboard/TabNav";

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get("site_id") ?? undefined;
  const { siteSpec, loading: specLoading, error, isStale, updateSiteSpec } = useSiteSpec(siteId);
  const { debouncedUpdate } = useDebouncedSave({ updateSiteSpec });

  const isInstructor = profile?.role === "instructor";

  if (authLoading || specLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600">Please sign in to access your dashboard.</p>
        <Link to="/" className="text-sm font-medium text-green-700 underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (!siteSpec) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold text-gray-900">
          No site specification found
        </h1>
        <p className="text-center text-gray-600">
          Start by chatting with our assistant to create your site specification.
        </p>
        <Link
          to="/chat"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          Start with chatbot
        </Link>
      </main>
    );
  }

  // siteSpec is guaranteed non-null beyond this point
  const spec = siteSpec;

  function renderTabContent(activeTab: TabKey) {
    switch (activeTab) {
      case "business":
        return <BusinessDetailsTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "design":
        return <DesignTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "content":
        return <ContentTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "photos":
        return <PhotosTab siteSpec={spec} />;
      case "contact":
        return <ContactTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "seo":
        return <SeoTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "preview":
        return <PreviewTab siteSpec={spec} onFieldChange={debouncedUpdate} isStale={isStale} />;
    }
  }

  return (
    <DashboardShell
      siteSpec={spec}
      loading={false}
      error={error}
      backLink={isInstructor ? { label: "Back to Admin", to: "/admin/sites" } : undefined}
    >
      {renderTabContent}
    </DashboardShell>
  );
}
