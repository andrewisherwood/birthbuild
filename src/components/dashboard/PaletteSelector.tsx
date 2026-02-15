import type { PaletteOption, CustomColours } from "@/types/site-spec";
import { CustomColourPicker } from "@/components/dashboard/CustomColourPicker";

interface PaletteSelectorProps {
  value: PaletteOption;
  customColours: CustomColours | null;
  onChange: (palette: PaletteOption) => void;
  onCustomChange: (colours: CustomColours) => void;
}

interface PaletteDefinition {
  key: PaletteOption;
  label: string;
  colours: CustomColours;
}

const PALETTES: PaletteDefinition[] = [
  {
    key: "sage_sand",
    label: "Sage & Sand",
    colours: {
      background: "#f5f0e8",
      primary: "#5f7161",
      accent: "#a8b5a0",
      text: "#2d2d2d",
      cta: "#5f7161",
    },
  },
  {
    key: "blush_neutral",
    label: "Blush & Neutral",
    colours: {
      background: "#fdf6f0",
      primary: "#c9928e",
      accent: "#e8cfc4",
      text: "#3d3d3d",
      cta: "#c9928e",
    },
  },
  {
    key: "deep_earth",
    label: "Deep Earth",
    colours: {
      background: "#f0ebe3",
      primary: "#6b4c3b",
      accent: "#a67c52",
      text: "#2b2b2b",
      cta: "#6b4c3b",
    },
  },
  {
    key: "ocean_calm",
    label: "Ocean Calm",
    colours: {
      background: "#f0f4f5",
      primary: "#3d6b7e",
      accent: "#7ca5b8",
      text: "#2c3e50",
      cta: "#3d6b7e",
    },
  },
];

function ColourSwatches({ colours }: { colours: CustomColours }) {
  const swatchOrder: (keyof CustomColours)[] = [
    "background",
    "primary",
    "accent",
    "text",
    "cta",
  ];

  return (
    <div className="flex gap-1.5">
      {swatchOrder.map((key) => (
        <span
          key={key}
          className="inline-block h-5 w-5 rounded-full border border-gray-200"
          style={{ backgroundColor: colours[key] }}
          aria-label={`${key}: ${colours[key]}`}
        />
      ))}
    </div>
  );
}

export function PaletteSelector({
  value,
  customColours,
  onChange,
  onCustomChange,
}: PaletteSelectorProps) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium text-gray-700">
        Colour Palette
      </legend>
      <p className="mt-1 text-sm text-gray-500">
        Select a preset palette or create your own custom colours.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PALETTES.map((palette) => {
          const isSelected = value === palette.key;
          return (
            <button
              key={palette.key}
              type="button"
              onClick={() => onChange(palette.key)}
              aria-pressed={isSelected}
              className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${
                isSelected
                  ? "border-green-700 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <ColourSwatches colours={palette.colours} />
              <span className="text-sm font-medium text-gray-900">
                {palette.label}
              </span>
            </button>
          );
        })}

        {/* Custom option */}
        <button
          type="button"
          onClick={() => onChange("custom")}
          aria-pressed={value === "custom"}
          className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${
            value === "custom"
              ? "border-green-700 bg-green-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-gray-400 text-xs text-gray-400">
            +
          </span>
          <span className="text-sm font-medium text-gray-900">Custom</span>
        </button>
      </div>

      {value === "custom" && (
        <div className="mt-4">
          <CustomColourPicker
            colours={
              customColours ?? {
                background: "#ffffff",
                primary: "#165e40",
                accent: "#a8b5a0",
                text: "#2d2d2d",
                cta: "#165e40",
              }
            }
            onChange={onCustomChange}
          />
        </div>
      )}
    </fieldset>
  );
}
