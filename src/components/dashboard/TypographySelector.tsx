import { useEffect } from "react";
import type { TypographyOption } from "@/types/site-spec";

interface TypographySelectorProps {
  value: TypographyOption;
  onChange: (typography: TypographyOption, fontHeading: string, fontBody: string) => void;
}

interface FontPair {
  key: TypographyOption;
  label: string;
  heading: string;
  body: string;
  googleFonts: string;
}

const FONT_PAIRS: FontPair[] = [
  {
    key: "modern",
    label: "Modern",
    heading: "Inter",
    body: "Inter",
    googleFonts: "Inter:wght@400;600;700",
  },
  {
    key: "classic",
    label: "Classic",
    heading: "Playfair Display",
    body: "Source Sans 3",
    googleFonts: "Playfair+Display:wght@400;700&family=Source+Sans+3:wght@400;600",
  },
  {
    key: "mixed",
    label: "Mixed",
    heading: "DM Serif Display",
    body: "Inter",
    googleFonts: "DM+Serif+Display&family=Inter:wght@400;600",
  },
];

export function TypographySelector({
  value,
  onChange,
}: TypographySelectorProps) {
  // Inject Google Fonts link elements into <head>
  useEffect(() => {
    const linkIds: string[] = [];

    for (const pair of FONT_PAIRS) {
      const linkId = `gfont-${pair.key}`;
      linkIds.push(linkId);

      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${pair.googleFonts}&display=swap`;
        document.head.appendChild(link);
      }
    }

    return () => {
      for (const id of linkIds) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    };
  }, []);

  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium text-gray-700">
        Typography
      </legend>
      <p className="mt-1 text-sm text-gray-500">
        Choose a font pairing for your headings and body text.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {FONT_PAIRS.map((pair) => {
          const isSelected = value === pair.key;
          return (
            <button
              key={pair.key}
              type="button"
              onClick={() => onChange(pair.key, pair.heading, pair.body)}
              aria-pressed={isSelected}
              className={`rounded-lg border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${
                isSelected
                  ? "border-green-700 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="block text-xs font-medium text-gray-500">
                {pair.label}
              </span>
              <span
                className="mt-2 block text-lg font-bold text-gray-900"
                style={{ fontFamily: `'${pair.heading}', serif` }}
              >
                Heading Text
              </span>
              <span
                className="mt-1 block text-sm text-gray-600"
                style={{ fontFamily: `'${pair.body}', sans-serif` }}
              >
                Body text looks like this, with your chosen font.
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
