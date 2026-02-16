import type { SiteSpecStatus } from "@/types/site-spec";

interface StatusBadgeProps {
  status: SiteSpecStatus;
}

const STYLES: Record<SiteSpecStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  building: "bg-yellow-100 text-yellow-800 animate-pulse",
  preview: "bg-blue-100 text-blue-800",
  live: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-700",
};

const LABELS: Record<SiteSpecStatus, string> = {
  draft: "Draft",
  building: "Building",
  preview: "Preview",
  live: "Live",
  error: "Error",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
