import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSpec } from "@/hooks/useSiteSpec";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BusinessDetailsTab } from "@/components/dashboard/BusinessDetailsTab";
import { DesignTab } from "@/components/dashboard/DesignTab";
import { ContentTab } from "@/components/dashboard/ContentTab";
import { PhotosTab } from "@/components/dashboard/PhotosTab";
import { ContactTab } from "@/components/dashboard/ContactTab";
import { SeoTab } from "@/components/dashboard/SeoTab";
import { PreviewTab } from "@/components/dashboard/PreviewTab";
import { SiteEditorTab } from "@/components/dashboard/SiteEditorTab";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { TabKey } from "@/components/dashboard/TabNav";

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get("site_id") ?? undefined;
  const { siteSpec, loading: specLoading, error, isStale, patchLocal, updateSiteSpec, refreshSpec } = useSiteSpec(siteId);
  const { photos } = usePhotoUpload(siteSpec?.id ?? null);
  const { debouncedUpdate } = useDebouncedSave({ updateSiteSpec, patchLocal });

  const isInstructor = profile?.role === "instructor" || profile?.role === "admin";

  if (authLoading || specLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <LoadingSpinner className="h-8 w-8" />
        <p className="text-sm text-gray-500">Loading your dashboard…</p>
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
        return <DesignTab siteSpec={spec} onFieldChange={debouncedUpdate} updateSiteSpec={updateSiteSpec} />;
      case "content":
        return <ContentTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "photos":
        return <PhotosTab siteSpec={spec} />;
      case "contact":
        return <ContactTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "seo":
        return <SeoTab siteSpec={spec} onFieldChange={debouncedUpdate} />;
      case "preview":
        return <PreviewTab siteSpec={spec} onFieldChange={debouncedUpdate} isStale={isStale} refreshSpec={refreshSpec} />;
      case "editor":
        return <SiteEditorTab siteSpec={spec} />;
    }
  }

  return (
    <DashboardShell
      siteSpec={spec}
      loading={false}
      error={error}
      backLink={isInstructor ? { label: "Back to Admin", to: "/admin/sites" } : undefined}
      photoCount={photos.length}
    >
      {renderTabContent}
    </DashboardShell>
  );
}
