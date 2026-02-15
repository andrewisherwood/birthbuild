import { Card } from "@/components/ui/Card";
import { TextareaField } from "@/components/dashboard/TextareaField";
import { TestimonialEditor } from "@/components/dashboard/TestimonialEditor";
import { ToggleSwitch } from "@/components/dashboard/ToggleSwitch";
import type { SiteSpec, Testimonial } from "@/types/site-spec";

interface ContentTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
}

export function ContentTab({ siteSpec, onFieldChange }: ContentTabProps) {
  const handleTestimonialsChange = (testimonials: Testimonial[]) => {
    onFieldChange({ testimonials });
  };

  return (
    <div className="space-y-6">
      <Card title="Written Content">
        <div className="space-y-4">
          <TextareaField
            label="Bio"
            value={siteSpec.bio ?? ""}
            onChange={(value) => onFieldChange({ bio: value })}
            rows={4}
            placeholder="Tell potential clients about yourself, your experience, and your approach..."
            helperText="Your main biography that appears on the About page"
            showAskAi
            siteSpec={siteSpec}
            onAiGenerated={(text) => onFieldChange({ bio: text })}
          />

          <TextareaField
            label="Philosophy"
            value={siteSpec.philosophy ?? ""}
            onChange={(value) => onFieldChange({ philosophy: value })}
            rows={3}
            placeholder="What guides your practice? What do you believe about birth and supporting families?"
            helperText="Your approach and values as a birth worker"
            showAskAi
            siteSpec={siteSpec}
            onAiGenerated={(text) => onFieldChange({ philosophy: text })}
          />

          <TextareaField
            label="Tagline"
            value={siteSpec.tagline ?? ""}
            onChange={(value) => onFieldChange({ tagline: value })}
            rows={2}
            placeholder="A short, memorable phrase for your homepage hero section"
            helperText="Appears prominently on your homepage"
            showAskAi
            siteSpec={siteSpec}
            onAiGenerated={(text) => onFieldChange({ tagline: text })}
          />
        </div>
      </Card>

      <Card title="Sections">
        <div className="space-y-4">
          <ToggleSwitch
            label="Include FAQ section"
            checked={siteSpec.faq_enabled ?? false}
            onChange={(checked) => onFieldChange({ faq_enabled: checked })}
          />
          <ToggleSwitch
            label="Include blog section (coming soon)"
            checked={siteSpec.blog_enabled ?? false}
            onChange={(checked) => onFieldChange({ blog_enabled: checked })}
            disabled
          />
        </div>
      </Card>

      <Card>
        <TestimonialEditor
          testimonials={siteSpec.testimonials ?? []}
          onChange={handleTestimonialsChange}
        />
      </Card>
    </div>
  );
}
