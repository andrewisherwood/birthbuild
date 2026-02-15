import { Card } from "@/components/ui/Card";
import { StyleSelector } from "@/components/dashboard/StyleSelector";
import { PaletteSelector } from "@/components/dashboard/PaletteSelector";
import { TypographySelector } from "@/components/dashboard/TypographySelector";
import type {
  SiteSpec,
  StyleOption,
  PaletteOption,
  TypographyOption,
  CustomColours,
} from "@/types/site-spec";

interface DesignTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
}

export function DesignTab({ siteSpec, onFieldChange }: DesignTabProps) {
  const handleStyleChange = (style: StyleOption) => {
    onFieldChange({ style });
  };

  const handlePaletteChange = (palette: PaletteOption) => {
    onFieldChange({ palette });
  };

  const handleCustomColoursChange = (customColours: CustomColours) => {
    onFieldChange({ custom_colours: customColours });
  };

  const handleTypographyChange = (
    typography: TypographyOption,
    fontHeading: string,
    fontBody: string,
  ) => {
    onFieldChange({
      typography,
      font_heading: fontHeading,
      font_body: fontBody,
    });
  };

  return (
    <div className="space-y-6">
      <Card title="Design">
        <StyleSelector
          value={siteSpec.style ?? "modern"}
          onChange={handleStyleChange}
        />

        <PaletteSelector
          value={siteSpec.palette ?? "sage_sand"}
          customColours={siteSpec.custom_colours}
          onChange={handlePaletteChange}
          onCustomChange={handleCustomColoursChange}
        />

        <TypographySelector
          value={siteSpec.typography ?? "modern"}
          onChange={handleTypographyChange}
        />
      </Card>
    </div>
  );
}
