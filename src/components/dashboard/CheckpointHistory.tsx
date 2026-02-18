/**
 * CheckpointHistory — version history and rollback for LLM-generated sites.
 *
 * Lists all checkpoint versions with labels and timestamps.
 * "Rollback" redeploys a previous checkpoint via the build Edge Function.
 */

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCheckpoint } from "@/hooks/useCheckpoint";
import type { SiteCheckpoint } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CheckpointHistoryProps {
  siteSpecId: string;
  checkpoints: SiteCheckpoint[];
  onRollback?: () => void;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckpointHistory({
  siteSpecId,
  checkpoints,
  onRollback,
}: CheckpointHistoryProps) {
  const { deployCheckpoint, error } = useCheckpoint();
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const handleDeploy = useCallback(
    async (checkpoint: SiteCheckpoint) => {
      setDeployingId(checkpoint.id);
      const success = await deployCheckpoint(checkpoint.id, siteSpecId);
      setDeployingId(null);
      if (success && onRollback) {
        onRollback();
      }
    },
    [siteSpecId, deployCheckpoint, onRollback],
  );

  if (checkpoints.length === 0) {
    return (
      <Card title="Version History">
        <p className="text-sm text-gray-500">No checkpoints yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Version History">
      <ul className="divide-y divide-gray-100">
        {checkpoints.map((checkpoint, index) => (
          <li
            key={checkpoint.id}
            className="flex items-center justify-between py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  v{checkpoint.version}
                </span>
                {index === 0 && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Latest
                  </span>
                )}
                {checkpoint.label && (
                  <span className="text-sm text-gray-500">
                    — {checkpoint.label}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatTimestamp(checkpoint.created_at)}
                {" · "}
                {checkpoint.html_pages.pages.length} page(s)
              </p>
            </div>
            {index > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDeploy(checkpoint)}
                loading={deployingId === checkpoint.id}
                disabled={deployingId !== null}
              >
                Rollback
              </Button>
            )}
            {index === 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleDeploy(checkpoint)}
                loading={deployingId === checkpoint.id}
                disabled={deployingId !== null}
              >
                Redeploy
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </Card>
  );
}
