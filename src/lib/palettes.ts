/**
 * Shared palette and typography definitions.
 * Used by PaletteSelector, site-generator, and page generators.
 */

import type {
  PaletteOption,
  CustomColours,
  TypographyOption,
} from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Palette definitions
// ---------------------------------------------------------------------------

export interface PaletteDefinition {
  key: PaletteOption;
  label: string;
  colours: CustomColours;
}

export const PALETTES: PaletteDefinition[] = [
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

const DEFAULT_PALETTE = PALETTES[0]!;

/**
 * Resolve the active colours for a given palette option.
 * If "custom" is selected, returns the provided custom colours (or sage_sand fallback).
 */
export function getPaletteColours(
  palette: PaletteOption,
  customColours: CustomColours | null,
): CustomColours {
  if (palette === "custom" && customColours) {
    return customColours;
  }

  const found = PALETTES.find((p) => p.key === palette);
  return found ? found.colours : DEFAULT_PALETTE.colours;
}

// ---------------------------------------------------------------------------
// Typography definitions
// ---------------------------------------------------------------------------

export interface TypographyConfig {
  heading: string;
  body: string;
  googleFontsUrl: string;
}

export const TYPOGRAPHY_CONFIG: Record<TypographyOption, TypographyConfig> = {
  modern: {
    heading: "Inter",
    body: "Inter",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  classic: {
    heading: "Playfair Display",
    body: "Source Sans 3",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+3:wght@400;600&display=swap",
  },
  mixed: {
    heading: "DM Serif Display",
    body: "Inter",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap",
  },
};
