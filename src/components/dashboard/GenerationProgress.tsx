/**
 * GenerationProgress — shows LLM build progress stages.
 *
 * Stages: design-system → pages (with per-page tracking) → saving → deploying
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationStage =
  | "design-system"
  | "design-system-retry"
  | "pages"
  | "saving"
  | "deploying"
  | "complete"
  | "error";

export interface GenerationProgress {
  stage: GenerationStage;
  current: number;
  total: number;
  error?: string;
}

interface GenerationProgressProps {
  progress: GenerationProgress;
}

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<GenerationStage, string> = {
  "design-system": "Generating design system...",
  "design-system-retry": "Refining design system...",
  pages: "Generating pages",
  saving: "Saving checkpoint...",
  deploying: "Deploying to preview...",
  complete: "Build complete!",
  error: "Build failed",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerationProgressIndicator({ progress }: GenerationProgressProps) {
  const { stage, current, total, error } = progress;
  const label =
    stage === "pages" && total > 0
      ? `${STAGE_LABELS[stage]} (${current}/${total})...`
      : STAGE_LABELS[stage];

  const percentage =
    stage === "design-system" || stage === "design-system-retry"
      ? 15
      : stage === "pages" && total > 0
        ? 15 + Math.round((current / total) * 60)
        : stage === "saving"
          ? 80
          : stage === "deploying"
            ? 90
            : stage === "complete"
              ? 100
              : 0;

  const isError = stage === "error";
  const isComplete = stage === "complete";

  return (
    <div className="mt-4" aria-live="polite" role="status">
      <p
        className={`mb-2 text-sm font-medium ${
          isError
            ? "text-red-700"
            : isComplete
              ? "text-green-700"
              : "text-yellow-800"
        }`}
      >
        {label}
      </p>
      {error && (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      )}
      {!isError && (
        <div
          className={`h-2 overflow-hidden rounded-full ${
            isComplete ? "bg-green-100" : "bg-yellow-100"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? "bg-green-500" : "bg-yellow-400"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
