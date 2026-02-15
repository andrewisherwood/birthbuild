import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { UsageMetrics } from "@/components/admin/UsageMetrics";
import { useSessions } from "@/hooks/useSessions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type SessionFilter = "active" | "all";

export default function AdminSessionsPage() {
  const { profile } = useAuth();
  const { sessions, loading, error, createSession, archiveSession } =
    useSessions();
  const [filter, setFilter] = useState<SessionFilter>("active");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const filteredSessions =
    filter === "active"
      ? sessions.filter((s) => s.status === "active")
      : sessions;

  async function handleCreate() {
    if (!newSessionName.trim()) return;
    setCreating(true);
    await createSession(newSessionName.trim());
    setCreating(false);
    setNewSessionName("");
    setShowCreateForm(false);
  }

  async function handleArchive(id: string) {
    setArchivingId(id);
    await archiveSession(id);
    setArchivingId(null);
  }

  return (
    <AdminShell>
      {/* Usage metrics */}
      {profile?.tenant_id && (
        <UsageMetrics tenantId={profile.tenant_id} />
      )}

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sessions</h2>
        <Button
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setShowCreateForm(true)}
        >
          Create Session
        </Button>
      </div>

      {/* Create session form */}
      {showCreateForm && (
        <Card className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <Input
              label="Session name"
              value={newSessionName}
              onChange={setNewSessionName}
              placeholder="e.g. Spring 2026 Workshop"
              required
              disabled={creating}
            />
            <div className="mt-4 flex gap-3">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={creating}
                disabled={!newSessionName.trim()}
              >
                Create
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewSessionName("");
                }}
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Error message */}
      {error && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Filter toggle */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === "active"
              ? "bg-green-700 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-green-700 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner className="h-8 w-8" />
          <span className="sr-only">Loading sessions...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredSessions.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">
            {filter === "active"
              ? "No active sessions. Create your first workshop session."
              : "No sessions yet. Create your first workshop session."}
          </p>
        </div>
      )}

      {/* Session list */}
      {!loading && filteredSessions.length > 0 && (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <Card key={session.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {session.name}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        session.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {session.status === "active" ? "Active" : "Archived"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                    <span>
                      {session.student_count}{" "}
                      {session.student_count === 1 ? "student" : "students"}
                    </span>
                    <span>
                      {session.live_site_count}{" "}
                      {session.live_site_count === 1
                        ? "live site"
                        : "live sites"}
                    </span>
                    <span>
                      Created{" "}
                      {new Date(session.created_at).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/admin/students?session=${session.id}`}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View Students
                  </Link>
                  {session.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={archivingId === session.id}
                      onClick={() => void handleArchive(session.id)}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
