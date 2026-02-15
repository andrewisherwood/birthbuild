import type { SiteSpec } from "@/types/site-spec";

interface ProgressIndicatorProps {
  siteSpec: SiteSpec;
  className?: string;
}

function countFilledFields(siteSpec: SiteSpec): number {
  let filled = 0;

  // Required fields (4)
  if (siteSpec.business_name) filled++;
  if (siteSpec.doula_name) filled++;
  if (siteSpec.service_area) filled++;
  if (siteSpec.email) filled++;

  // Optional scored fields (7)
  if (siteSpec.tagline) filled++;
  if (siteSpec.bio) filled++;
  if (siteSpec.services && siteSpec.services.length > 0) filled++;
  if (siteSpec.phone) filled++;
  if (siteSpec.palette && siteSpec.palette !== "sage_sand") filled++;
  if (siteSpec.style && siteSpec.style !== "modern") filled++;
  if (siteSpec.typography && siteSpec.typography !== "modern") filled++;

  return filled;
}

const TOTAL_FIELDS = 11;

export function ProgressIndicator({
  siteSpec,
  className = "",
}: ProgressIndicatorProps) {
  const filled = countFilledFields(siteSpec);
  const percentage = Math.round((filled / TOTAL_FIELDS) * 100);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Site completion: ${percentage}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: "#165e40" }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600">
        {percentage}%
      </span>
    </div>
  );
}
