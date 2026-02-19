import { calculateDensityScore } from "@/lib/density-score";
import type { DensityLevel } from "@/lib/density-score";
import type { SiteSpec } from "@/types/site-spec";

interface ProgressIndicatorProps {
  siteSpec: SiteSpec;
  className?: string;
  showSuggestions?: boolean;
}

const LEVEL_COLOURS: Record<DensityLevel, string> = {
  low: "#dc2626",
  medium: "#d97706",
  high: "#16a34a",
  excellent: "#165e40",
};

const LEVEL_LABELS: Record<DensityLevel, string> = {
  low: "Getting started",
  medium: "Good progress",
  high: "Looking great",
  excellent: "Excellent detail",
};

export function ProgressIndicator({
  siteSpec,
  className = "",
  showSuggestions = false,
}: ProgressIndicatorProps) {
  const result = calculateDensityScore(siteSpec);
  const colour = LEVEL_COLOURS[result.level];

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={result.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Site density: ${result.percentage}% — ${LEVEL_LABELS[result.level]}`}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${result.percentage}%`, backgroundColor: colour }}
          />
        </div>
        <span className="text-sm font-medium text-gray-600">
          {result.percentage}%
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {LEVEL_LABELS[result.level]} ({result.totalScore}/25)
      </p>
      {showSuggestions && result.suggestions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.suggestions.map((suggestion) => (
            <li key={suggestion} className="text-xs text-gray-500">
              &bull; {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
