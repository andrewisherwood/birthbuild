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
// Contrast ratio utilities (WCAG 2.1)
// ---------------------------------------------------------------------------

/**
 * Convert a hex colour string to its relative luminance.
 * Uses the WCAG 2.1 formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function hexToRgbChannel(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function linearise(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgbChannel(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Calculate the WCAG 2.1 contrast ratio between two hex colours.
 * Returns a value between 1 and 21.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check whether two colours meet WCAG AA contrast requirements
 * for normal text (ratio >= 4.5).
 */
export function meetsContrastAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
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
