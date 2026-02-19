import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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

      <Card title="Your Story">
        <p className="mb-4 text-sm text-gray-500">
          These details help us generate a richer, more personal bio for your About page.
          Fill in as much or as little as you like.
        </p>
        <div className="space-y-4">
          <TextareaField
            label="Previous Career"
            value={siteSpec.bio_previous_career ?? ""}
            onChange={(value) => onFieldChange({ bio_previous_career: value })}
            rows={2}
            placeholder="What did you do before becoming a birth worker?"
            helperText="Helps visitors connect with your journey"
          />

          <TextareaField
            label="Origin Story"
            value={siteSpec.bio_origin_story ?? ""}
            onChange={(value) => onFieldChange({ bio_origin_story: value })}
            rows={3}
            placeholder="What made you decide to train as a doula? Was there a moment that sparked it?"
            helperText="This becomes the heart of your About page"
            showAskAi
            siteSpec={siteSpec}
            onAiGenerated={(text) => onFieldChange({ bio_origin_story: text })}
          />

          <Input
            label="Training Year"
            value={siteSpec.training_year ?? ""}
            onChange={(value) => onFieldChange({ training_year: value })}
            placeholder="e.g. 2019"
            helperText="When you completed your doula training"
          />

          <Input
            label="Additional Training"
            value={(siteSpec.additional_training ?? []).join(", ")}
            onChange={(value) =>
              onFieldChange({
                additional_training: value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="e.g. Spinning Babies, Aromatherapy, Rebozo"
            helperText="Comma-separated list of additional qualifications or CPD"
          />

          <TextareaField
            label="Client Perception"
            value={siteSpec.client_perception ?? ""}
            onChange={(value) => onFieldChange({ client_perception: value })}
            rows={2}
            placeholder="What do your clients say about you most often?"
            helperText="Not a testimonial — just the thing that keeps coming up"
          />

          <TextareaField
            label="Signature Story"
            value={siteSpec.signature_story ?? ""}
            onChange={(value) => onFieldChange({ signature_story: value })}
            rows={3}
            placeholder="A birth or family that stayed with you (no names or details needed)"
            helperText="Optional — makes your About page feel really human"
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
