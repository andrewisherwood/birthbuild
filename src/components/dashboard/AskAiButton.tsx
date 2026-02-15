import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { sendChatMessage } from "@/lib/claude";
import type { SiteSpec } from "@/types/site-spec";

interface AskAiButtonProps {
  fieldName: string;
  siteSpec: SiteSpec;
  onGenerated: (text: string) => void;
}

function buildPrompt(fieldName: string, siteSpec: SiteSpec): string {
  const context = [
    siteSpec.business_name ? `Business: ${siteSpec.business_name}` : null,
    siteSpec.doula_name ? `Name: ${siteSpec.doula_name}` : null,
    siteSpec.service_area ? `Area: ${siteSpec.service_area}` : null,
    siteSpec.services && siteSpec.services.length > 0
      ? `Services: ${siteSpec.services.map((s) => s.title || s.type).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return `You are a copywriter for a UK doula/birth worker website. Write a compelling ${fieldName} for this professional. Context: ${context}. Use British English. Keep it warm, professional, and authentic. Return only the text, no headings or formatting.`;
}

export function AskAiButton({
  fieldName,
  siteSpec,
  onGenerated,
}: AskAiButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const prompt = buildPrompt(fieldName, siteSpec);
      const response = await sendChatMessage({
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (textBlock && textBlock.type === "text") {
        onGenerated(textBlock.text);
      } else {
        setError("No text was generated. Please try again.");
      }
    } catch (err) {
      console.error("Ask AI generation failed:", err);
      setError("Unable to generate content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant="outline"
        size="sm"
        loading={loading}
        onClick={() => void handleClick()}
        aria-label={`Generate ${fieldName} with AI`}
      >
        {"\u2728"} Ask AI
      </Button>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
