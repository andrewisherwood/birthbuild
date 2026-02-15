import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSpec } from "@/hooks/useSiteSpec";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BusinessDetailsTab } from "@/components/dashboard/BusinessDetailsTab";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { TabKey } from "@/components/dashboard/TabNav";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { siteSpec, loading: specLoading, error, updateSiteSpec } = useSiteSpec();
  const { debouncedUpdate, isPending } = useDebouncedSave({ updateSiteSpec });

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
        return <TabPlaceholder label="Design" isPending={isPending} />;
      case "content":
        return <TabPlaceholder label="Content" isPending={isPending} />;
      case "photos":
        return <TabPlaceholder label="Photos" isPending={isPending} />;
      case "contact":
        return <TabPlaceholder label="Contact & Social" isPending={isPending} />;
      case "seo":
        return <TabPlaceholder label="SEO" isPending={isPending} />;
      case "preview":
        return <TabPlaceholder label="Preview & Publish" isPending={isPending} />;
    }
  }

  return (
    <DashboardShell
      siteSpec={spec}
      loading={false}
      error={error}
    >
      {renderTabContent}
    </DashboardShell>
  );
}

/* Temporary placeholder — removed as real tab components are added */
interface TabPlaceholderProps {
  label: string;
  isPending: boolean;
}

function TabPlaceholder({ label, isPending }: TabPlaceholderProps) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-700">{label}</h2>
      <p className="mt-2 text-sm text-gray-500">
        This section will be available shortly.
      </p>
      {isPending && (
        <p className="mt-2 text-xs text-gray-400">Saving changes...</p>
      )}
    </div>
  );
}
