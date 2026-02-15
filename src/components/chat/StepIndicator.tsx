/**
 * StepIndicator — horizontal row of 7 step dots showing onboarding progress.
 *
 * Current step highlighted in green, completed steps show a tick, future steps grey.
 */

import type { ChatStep } from "@/types/site-spec";

interface StepIndicatorProps {
  currentStep: ChatStep;
  completedSteps: ChatStep[];
  className?: string;
}

const STEPS: { key: ChatStep; label: string }[] = [
  { key: "welcome", label: "Welcome" },
  { key: "basics", label: "Basics" },
  { key: "style", label: "Style" },
  { key: "content", label: "Content" },
  { key: "photos", label: "Photos" },
  { key: "contact", label: "Contact" },
  { key: "review", label: "Review" },
];

export function StepIndicator({
  currentStep,
  completedSteps,
  className = "",
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Onboarding progress"
      className={`flex items-center justify-center gap-1 px-4 py-3 sm:gap-2 ${className}`}
    >
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.key);
        const isCurrent = currentStep === step.key;
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step dot + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isCompleted
                    ? "bg-green-700 text-white"
                    : isCurrent
                      ? "border-2 border-green-700 bg-green-50 text-green-700"
                      : "border border-gray-300 bg-white text-gray-400"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={`hidden text-[10px] sm:block ${
                  isCurrent
                    ? "font-semibold text-green-700"
                    : isFuture
                      ? "text-gray-400"
                      : "text-gray-600"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < STEPS.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-4 sm:w-6 ${
                  isCompleted ? "bg-green-700" : "bg-gray-200"
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
