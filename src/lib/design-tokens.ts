/**
 * Design token library — font registry, spacing/radius/scale constants,
 * derivation utilities, and validation.
 *
 * Pure data/utility module with no React dependencies.
 */

import type {
  SiteSpec,
  DesignConfig,
  DesignColours,
  SpacingDensity,
  BorderRadiusOption,
  TypographyScale,
} from "@/types/site-spec";
import { getPaletteColours, TYPOGRAPHY_CONFIG } from "@/lib/palettes";

// ---------------------------------------------------------------------------
// Font Registry
// ---------------------------------------------------------------------------

export interface FontDefinition {
  name: string;
  googleFontsParam: string;
  category: "serif" | "sans-serif" | "display";
}

export const HEADING_FONTS: FontDefinition[] = [
  { name: "Playfair Display", googleFontsParam: "Playfair+Display:wght@400;700", category: "serif" },
  { name: "Lora", googleFontsParam: "Lora:wght@400;700", category: "serif" },
  { name: "Montserrat", googleFontsParam: "Montserrat:wght@400;500;600;700", category: "sans-serif" },
  { name: "Raleway", googleFontsParam: "Raleway:wght@400;500;600;700", category: "sans-serif" },
  { name: "DM Serif Display", googleFontsParam: "DM+Serif+Display", category: "display" },
  { name: "Inter", googleFontsParam: "Inter:wght@400;500;600;700", category: "sans-serif" },
  { name: "Source Sans 3", googleFontsParam: "Source+Sans+3:wght@400;600;700", category: "sans-serif" },
];

export const BODY_FONTS: FontDefinition[] = [
  { name: "Inter", googleFontsParam: "Inter:wght@400;500;600;700", category: "sans-serif" },
  { name: "Open Sans", googleFontsParam: "Open+Sans:wght@400;600;700", category: "sans-serif" },
  { name: "Lato", googleFontsParam: "Lato:wght@400;700", category: "sans-serif" },
  { name: "Source Sans 3", googleFontsParam: "Source+Sans+3:wght@400;600", category: "sans-serif" },
  { name: "Lora", googleFontsParam: "Lora:wght@400;700", category: "serif" },
];

/** All curated font names (heading + body, deduplicated). */
export const ALL_FONT_NAMES: string[] = [
  ...new Set([
    ...HEADING_FONTS.map((f) => f.name),
    ...BODY_FONTS.map((f) => f.name),
  ]),
];

export function findFont(name: string): FontDefinition | undefined {
  return (
    HEADING_FONTS.find((f) => f.name === name) ??
    BODY_FONTS.find((f) => f.name === name)
  );
}

// ---------------------------------------------------------------------------
// Spacing Density Scale
// ---------------------------------------------------------------------------

export interface SpacingTokens {
  sectionPadding: string;
  gap: string;
  heroPadding: string;
  cardPadding: string;
}

export const SPACING_SCALES: Record<SpacingDensity, SpacingTokens> = {
  compact: { sectionPadding: "2.5rem 1.5rem", gap: "1rem", heroPadding: "3rem 1.5rem", cardPadding: "1.25rem" },
  default: { sectionPadding: "4rem 1.5rem", gap: "1.5rem", heroPadding: "5rem 1.5rem", cardPadding: "2rem" },
  relaxed: { sectionPadding: "5.5rem 1.5rem", gap: "2rem", heroPadding: "6.5rem 1.5rem", cardPadding: "2.5rem" },
  spacious: { sectionPadding: "7rem 1.5rem", gap: "2.5rem", heroPadding: "8rem 1.5rem", cardPadding: "3rem" },
};

// ---------------------------------------------------------------------------
// Border Radius Scale
// ---------------------------------------------------------------------------

export interface BorderRadiusTokens {
  card: string;
  button: string;
  image: string;
}

export const BORDER_RADIUS_SCALES: Record<BorderRadiusOption, BorderRadiusTokens> = {
  "sharp": { card: "0px", button: "0px", image: "0px" },
  "slightly-rounded": { card: "4px", button: "4px", image: "4px" },
  "rounded": { card: "8px", button: "6px", image: "8px" },
  "circular": { card: "16px", button: "24px", image: "50%" },
};

// ---------------------------------------------------------------------------
// Typography Scale
// ---------------------------------------------------------------------------

export interface TypographyScaleTokens {
  h1: string;
  h2: string;
  h3: string;
  body: string;
  tagline: string;
}

export const TYPOGRAPHY_SCALES: Record<TypographyScale, TypographyScaleTokens> = {
  small: { h1: "2.25rem", h2: "1.5rem", h3: "1.1rem", body: "0.95rem", tagline: "1rem" },
  default: { h1: "2.5rem", h2: "2rem", h3: "1.25rem", body: "1rem", tagline: "1.2rem" },
  large: { h1: "3.5rem", h2: "2.5rem", h3: "1.5rem", body: "1.1rem", tagline: "1.4rem" },
};

// ---------------------------------------------------------------------------
// Google Fonts URL Builder
// ---------------------------------------------------------------------------

export function buildGoogleFontsUrl(headingFont: string, bodyFont: string): string {
  const headingDef = findFont(headingFont);
  const bodyDef = findFont(bodyFont);

  const params: string[] = [];
  if (headingDef) {
    params.push(`family=${headingDef.googleFontsParam}`);
  }
  if (bodyDef && bodyDef.name !== headingDef?.name) {
    params.push(`family=${bodyDef.googleFontsParam}`);
  }

  if (params.length === 0) {
    // Fallback to Inter
    return "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  }

  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

// ---------------------------------------------------------------------------
// Derivation: base spec fields -> DesignConfig
// ---------------------------------------------------------------------------

/**
 * Derive a DesignConfig from the base style/palette/typography fields
 * on a SiteSpec. Used when the design editor first opens and spec.design is null.
 */
export function deriveDesignFromSpec(spec: SiteSpec): DesignConfig {
  const colours = getPaletteColours(spec.palette, spec.custom_colours);
  const typography = TYPOGRAPHY_CONFIG[spec.typography];

  // Map base style to border radius
  const radiusMap: Record<string, BorderRadiusOption> = {
    modern: "rounded",
    classic: "slightly-rounded",
    minimal: "sharp",
  };

  return {
    colours: { ...colours },
    typography: {
      headingFont: spec.font_heading ?? typography.heading,
      bodyFont: spec.font_body ?? typography.body,
      scale: "default",
    },
    spacing: { density: "default" },
    borderRadius: radiusMap[spec.style] ?? "rounded",
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const HEX_COLOUR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function validateDesignConfig(config: DesignConfig): string[] {
  const errors: string[] = [];

  // Validate colours
  const colourKeys: (keyof DesignColours)[] = ["primary", "background", "accent", "text", "cta"];
  for (const key of colourKeys) {
    if (!HEX_COLOUR_REGEX.test(config.colours[key])) {
      errors.push(`Invalid hex colour for ${key}: ${config.colours[key]}`);
    }
  }

  // Validate fonts against curated lists
  if (!ALL_FONT_NAMES.includes(config.typography.headingFont)) {
    errors.push(`Unknown heading font: ${config.typography.headingFont}`);
  }
  if (!ALL_FONT_NAMES.includes(config.typography.bodyFont)) {
    errors.push(`Unknown body font: ${config.typography.bodyFont}`);
  }

  // Validate scale
  const validScales: TypographyScale[] = ["small", "default", "large"];
  if (!validScales.includes(config.typography.scale)) {
    errors.push(`Invalid typography scale: ${config.typography.scale}`);
  }

  // Validate spacing density
  const validDensities: SpacingDensity[] = ["compact", "default", "relaxed", "spacious"];
  if (!validDensities.includes(config.spacing.density)) {
    errors.push(`Invalid spacing density: ${config.spacing.density}`);
  }

  // Validate border radius
  const validRadii: BorderRadiusOption[] = ["sharp", "slightly-rounded", "rounded", "circular"];
  if (!validRadii.includes(config.borderRadius)) {
    errors.push(`Invalid border radius: ${config.borderRadius}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Deep Merge
// ---------------------------------------------------------------------------

/**
 * Deep-merge a partial design change into a full DesignConfig.
 * Only merges known keys to prevent injection of arbitrary properties.
 */
export function deepMergeDesign(
  base: DesignConfig,
  partial: Partial<DesignConfig>,
): DesignConfig {
  return {
    colours: partial.colours
      ? { ...base.colours, ...partial.colours }
      : base.colours,
    typography: partial.typography
      ? { ...base.typography, ...partial.typography }
      : base.typography,
    spacing: partial.spacing
      ? { ...base.spacing, ...partial.spacing }
      : base.spacing,
    borderRadius: partial.borderRadius ?? base.borderRadius,
  };
}
