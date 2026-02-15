import type { CustomColours } from "@/types/site-spec";

interface CustomColourPickerProps {
  colours: CustomColours;
  onChange: (colours: CustomColours) => void;
}

interface ColourField {
  key: keyof CustomColours;
  label: string;
}

const COLOUR_FIELDS: ColourField[] = [
  { key: "background", label: "Background" },
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
  { key: "cta", label: "CTA" },
];

export function CustomColourPicker({
  colours,
  onChange,
}: CustomColourPickerProps) {
  const handleChange = (key: keyof CustomColours, value: string) => {
    onChange({ ...colours, [key]: value });
  };

  return (
    <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <legend className="text-sm font-medium text-gray-700">
        Custom Colours
      </legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-5">
        {COLOUR_FIELDS.map((field) => (
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
          </div>
        ))}
      </div>
    </fieldset>
  );
}
