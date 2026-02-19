import type { CustomColours } from "@/types/site-spec";

interface CustomColourPickerProps {
  colours: CustomColours;
  onChange: (colours: CustomColours) => void;
}

type HexKey = "background" | "primary" | "accent" | "text" | "cta";
type DescKey = "background_description" | "primary_description" | "accent_description" | "text_description" | "cta_description";

interface ColourField {
  key: HexKey;
  descKey: DescKey;
  label: string;
}

const COLOUR_FIELDS: ColourField[] = [
  { key: "background", descKey: "background_description", label: "Background" },
  { key: "primary", descKey: "primary_description", label: "Primary" },
  { key: "accent", descKey: "accent_description", label: "Accent" },
  { key: "text", descKey: "text_description", label: "Text" },
  { key: "cta", descKey: "cta_description", label: "CTA" },
];

export function CustomColourPicker({
  colours,
  onChange,
}: CustomColourPickerProps) {
  const handleChange = (key: HexKey, value: string) => {
    onChange({ ...colours, [key]: value });
  };

  return (
    <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <legend className="text-sm font-medium text-gray-700">
        Custom Colours
      </legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-5">
        {COLOUR_FIELDS.map((field) => {
          const description = colours[field.descKey];
          return (
            <div key={field.key}>
              <label
                htmlFor={`colour-${field.key}`}
                className="block text-xs font-medium text-gray-600"
              >
                {field.label}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`colour-${field.key}`}
                  type="color"
                  value={colours[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-gray-300"
                  aria-label={`${field.label} colour`}
                />
                <span className="text-xs text-gray-500">
                  {colours[field.key]}
                </span>
              </div>
              {description && (
                <p className="mt-0.5 text-xs italic text-gray-400">
                  &ldquo;{description}&rdquo;
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
