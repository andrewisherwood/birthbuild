import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { useInstructorSites } from "@/hooks/useInstructorSites";
import { usePublish } from "@/hooks/usePublish";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { SiteSpec } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Site row actions
// ---------------------------------------------------------------------------

interface SiteActionsProps {
  site: SiteSpec;
  onDelete: (siteId: string) => void;
  onPublishComplete: () => void;
}

function SiteActions({ site, onDelete, onPublishComplete }: SiteActionsProps) {
  const navigate = useNavigate();
  const { publishing, publishError, publish, unpublish } = usePublish(site, {
    onComplete: onPublishComplete,
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => navigate(`/dashboard?site_id=${site.id}`)}
        className="text-sm font-medium text-green-700 hover:text-green-800"
      >
        Open
      </button>
      {site.status === "preview" && (
        <button
          type="button"
          onClick={() => void publish()}
          disabled={publishing}
          className="text-sm font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50"
        >
          Publish
        </button>
      )}
      {site.status === "live" && (
        <button
          type="button"
          onClick={() => void unpublish()}
          disabled={publishing}
          className="text-sm font-medium text-yellow-700 hover:text-yellow-800 disabled:opacity-50"
        >
          Unpublish
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              `Delete "${site.business_name ?? "Untitled Site"}"? This cannot be undone.`,
            )
          ) {
            onDelete(site.id);
          }
        }}
        className="text-sm font-medium text-red-600 hover:text-red-700"
      >
        Delete
      </button>
      {publishError && (
        <span className="text-xs text-red-600">{publishError}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminSitesPage() {
  const navigate = useNavigate();
  const { sites, loading, error, createSite, deleteSite, refetch } =
    useInstructorSites();

  async function handleCreate() {
    const site = await createSite();
    if (site) {
      navigate(`/chat?site_id=${site.id}`);
    }
  }

  return (
    <AdminShell>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">My Sites</h2>
        <Button variant="primary" size="sm" onClick={() => void handleCreate()}>
          Create New Site
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner className="h-8 w-8" />
          <span className="sr-only">Loading sites...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && sites.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">
            No sites yet. Create a new site to get started.
          </p>
        </div>
      )}

      {/* Sites table — desktop (>=768px) */}
      {!loading && sites.length > 0 && (
        <Card className="hidden overflow-hidden p-0 md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    URLs
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {site.business_name ?? "Untitled Site"}
                      </div>
                      {site.doula_name && (
                        <div className="text-sm text-gray-500">
                          {site.doula_name}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={site.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {site.deploy_url && (
                          <a
                            href={site.deploy_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-700 underline hover:text-green-800"
                          >
                            Live
                          </a>
                        )}
                        {site.preview_url && (
                          <a
                            href={site.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-700 underline hover:text-blue-800"
                          >
                            Preview
                          </a>
                        )}
                        {!site.deploy_url && !site.preview_url && (
                          <span className="text-sm text-gray-400">
                            Not built
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <SiteActions site={site} onDelete={deleteSite} onPublishComplete={() => void refetch()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sites cards — mobile (<768px) */}
      {!loading && sites.length > 0 && (
        <div className="space-y-3 md:hidden">
          {sites.map((site) => (
            <Card key={site.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {site.business_name ?? "Untitled Site"}
                  </p>
                  {site.doula_name && (
                    <p className="truncate text-sm text-gray-500">
                      {site.doula_name}
                    </p>
                  )}
                </div>
                <StatusBadge status={site.status} />
              </div>

              <div className="mt-2 flex gap-3">
                {site.deploy_url && (
                  <a
                    href={site.deploy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 underline hover:text-green-800"
                  >
                    Live
                  </a>
                )}
                {site.preview_url && (
                  <a
                    href={site.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-700 underline hover:text-blue-800"
                  >
                    Preview
                  </a>
                )}
              </div>

              <div className="mt-3">
                <SiteActions site={site} onDelete={deleteSite} onPublishComplete={() => void refetch()} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
