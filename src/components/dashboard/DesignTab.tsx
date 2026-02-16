import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StyleSelector } from "@/components/dashboard/StyleSelector";
import { PaletteSelector } from "@/components/dashboard/PaletteSelector";
import { TypographySelector } from "@/components/dashboard/TypographySelector";
import { DesignChatPanel } from "@/components/dashboard/DesignChatPanel";
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
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
}

export function DesignTab({ siteSpec, onFieldChange, updateSiteSpec }: DesignTabProps) {
  const [showDesignChat, setShowDesignChat] = useState(false);

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

  const designControls = (
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

        <div className="mt-6 border-t border-gray-200 pt-6">
          <Button
            variant="secondary"
            onClick={() => setShowDesignChat(true)}
          >
            Chat with AI to refine your design
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            Describe what you want in plain language — &ldquo;make it warmer&rdquo;,
            &ldquo;use a serif heading font&rdquo;, &ldquo;more breathing room&rdquo;
          </p>
        </div>
      </Card>
    </div>
  );

  if (!showDesignChat) {
    return designControls;
  }

  // Desktop: two-column grid (controls left, chat panel right)
  // Mobile: panel renders as full-screen overlay via its own markup
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-6">
      {/* Design controls (hidden on mobile when chat is open) */}
      <div className="hidden lg:block">
        {designControls}
      </div>

      {/* Design chat panel */}
      <div className="h-[700px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <DesignChatPanel
          siteSpec={siteSpec}
          updateSiteSpec={updateSiteSpec}
          onClose={() => setShowDesignChat(false)}
        />
      </div>
    </div>
  );
}
