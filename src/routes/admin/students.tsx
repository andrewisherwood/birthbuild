import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { useStudents } from "@/hooks/useStudents";
import { useSessions } from "@/hooks/useSessions";
import { inviteStudents } from "@/lib/invite";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { InviteResult } from "@/lib/invite";
import type { StudentOverview } from "@/types/database";
import type { SiteSpecStatus } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: SiteSpecStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<SiteSpecStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    building: "bg-yellow-100 text-yellow-800 animate-pulse",
    live: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-700",
  };

  const labels: Record<SiteSpecStatus, string> = {
    draft: "Draft",
    building: "Building",
    live: "Live",
    error: "Error",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progress bar helper
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  percent: number;
}

function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-green-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{percent}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionFilter = searchParams.get("session") ?? "";

  const { sessions } = useSessions();
  const { students, loading, error, refetch } = useStudents(
    sessionFilter || undefined,
  );

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteSessionId, setInviteSessionId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResults, setInviteResults] = useState<InviteResult[] | null>(
    null,
  );
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Spec viewer state (will be wired up in Loop 5)
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);

  // Active sessions for the invite dropdown
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions],
  );

  function handleFilterChange(newSessionId: string) {
    if (newSessionId) {
      setSearchParams({ session: newSessionId });
    } else {
      setSearchParams({});
    }
  }

  async function handleInvite() {
    const emails = parseEmails(inviteEmails);

    if (emails.length === 0) {
      setInviteError("Please enter at least one email address.");
      return;
    }

    const invalidEmails = emails.filter((e) => !EMAIL_REGEX.test(e));
    if (invalidEmails.length > 0) {
      setInviteError(
        `Invalid email format: ${invalidEmails.slice(0, 3).join(", ")}${invalidEmails.length > 3 ? "..." : ""}`,
      );
      return;
    }

    if (!inviteSessionId) {
      setInviteError("Please select a session.");
      return;
    }

    setInviting(true);
    setInviteError(null);
    setInviteResults(null);

    try {
      const results = await inviteStudents(emails, inviteSessionId);
      setInviteResults(results);
      void refetch();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send invites.";
      setInviteError(message);
    } finally {
      setInviting(false);
    }
  }

  function handleCopyLink(link: string) {
    void navigator.clipboard.writeText(link);
  }

  function closeInviteModal() {
    setShowInviteModal(false);
    setInviteEmails("");
    setInviteSessionId("");
    setInviteResults(null);
    setInviteError(null);
  }

  // Session name lookup for table display
  const sessionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      map.set(s.id, s.name);
    }
    return map;
  }, [sessions]);

  return (
    <AdminShell>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Students</h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowInviteModal(true)}
        >
          Invite Students
        </Button>
      </div>

      {/* Session filter */}
      <div className="mb-4">
        <label
          htmlFor="session-filter"
          className="block text-sm font-medium text-gray-700"
        >
          Filter by session
        </label>
        <select
          id="session-filter"
          value={sessionFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
        >
          <option value="">All sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
          <span className="sr-only">Loading students...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && students.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-600">
            No students yet. Invite students to get started.
          </p>
        </div>
      )}

      {/* Student table */}
      {!loading && students.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Name / Email
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Session
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
                    Progress
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
                {students.map((student: StudentOverview) => (
                  <tr key={student.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {student.display_name ?? student.email}
                      </div>
                      {student.display_name && (
                        <div className="text-sm text-gray-500">
                          {student.email}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {student.session_id
                        ? sessionNameMap.get(student.session_id) ?? "—"
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {student.site_spec ? (
                        <StatusBadge status={student.site_spec.status} />
                      ) : (
                        <span className="text-sm text-gray-400">
                          Not started
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {student.site_spec ? (
                        <ProgressBar
                          percent={student.site_spec.completion_percent}
                        />
                      ) : (
                        <span className="text-sm text-gray-400">
                          Not started
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {student.site_spec && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSpecId(student.site_spec!.id)
                            }
                            className="text-sm font-medium text-green-700 hover:text-green-800"
                          >
                            View Spec
                          </button>
                        )}
                        {student.site_spec?.deploy_url && (
                          <a
                            href={student.site_spec.deploy_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-green-700 hover:text-green-800"
                          >
                            View Site
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Spec viewer placeholder — will be replaced in Loop 5 */}
      {selectedSpecId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-gray-200 bg-white shadow-xl">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Site Specification
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSpecId(null)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Spec ID: {selectedSpecId}
            </p>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Invite students"
        >
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Invite Students
              </h3>
              <button
                type="button"
                onClick={closeInviteModal}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {!inviteResults ? (
              <>
                <div className="mb-4">
                  <label
                    htmlFor="invite-session"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Session
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <select
                    id="invite-session"
                    value={inviteSessionId}
                    onChange={(e) => setInviteSessionId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                    disabled={inviting}
                  >
                    <option value="">Select a session</option>
                    {activeSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="invite-emails"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email addresses
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <textarea
                    id="invite-emails"
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    placeholder="Enter email addresses, one per line or separated by commas"
                    rows={5}
                    disabled={inviting}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    One per line or comma-separated. Maximum 50 at a time.
                  </p>
                </div>

                {inviteError && (
                  <div
                    className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    role="alert"
                  >
                    {inviteError}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeInviteModal}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={inviting}
                    onClick={() => void handleInvite()}
                  >
                    Send Invites
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  {inviteResults.filter((r) => r.success).length} of{" "}
                  {inviteResults.length} invites sent successfully.
                </p>

                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {inviteResults.map((result, idx) => (
                    <div
                      key={`${result.email}-${idx}`}
                      className={`rounded-md border p-3 text-sm ${
                        result.success
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            result.success
                              ? "font-medium text-green-800"
                              : "font-medium text-red-700"
                          }
                        >
                          {result.email}
                        </span>
                        {result.success ? (
                          <span className="text-xs text-green-600">
                            Sent
                          </span>
                        ) : (
                          <span className="text-xs text-red-500">
                            Failed
                          </span>
                        )}
                      </div>
                      {result.success && result.magic_link && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyLink(result.magic_link!)
                            }
                            className="text-xs font-medium text-green-700 hover:text-green-800"
                          >
                            Copy magic link
                          </button>
                        </div>
                      )}
                      {!result.success && result.error && (
                        <p className="mt-1 text-xs text-red-500">
                          {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={closeInviteModal}
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
