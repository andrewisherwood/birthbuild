import type { StyleOption } from "@/types/site-spec";

interface StyleSelectorProps {
  value: StyleOption;
  onChange: (style: StyleOption) => void;
}

interface StyleCard {
  key: StyleOption;
  label: string;
  description: string;
}

const STYLE_OPTIONS: StyleCard[] = [
  {
    key: "modern",
    label: "Modern",
    description: "Clean lines, bold typography, and generous whitespace",
  },
  {
    key: "classic",
    label: "Classic",
    description: "Elegant serif fonts, warm tones, and traditional layouts",
  },
  {
    key: "minimal",
    label: "Minimal",
    description: "Stripped-back design with focus on content and imagery",
  },
];

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700">
        Site Style
      </legend>
      <p className="mt-1 text-sm text-gray-500">
        Choose the overall feel of your website.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {STYLE_OPTIONS.map((option) => {
          const isSelected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={isSelected}
              className={`rounded-lg border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${
                isSelected
                  ? "border-green-700 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="block text-sm font-semibold text-gray-900">
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
