import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ToggleSwitch } from "@/components/dashboard/ToggleSwitch";
import type { SiteSpec, SocialLinks } from "@/types/site-spec";

interface ContactTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
}

interface SocialField {
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
}

const SOCIAL_FIELDS: SocialField[] = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/yourusername",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/yourpage",
  },
  {
    key: "twitter",
    label: "Twitter / X",
    placeholder: "https://twitter.com/yourusername",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/yourprofile",
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@yourusername",
  },
];

export function ContactTab({ siteSpec, onFieldChange }: ContactTabProps) {
  const socialLinks = siteSpec.social_links ?? {};

  const handleSocialChange = (platform: keyof SocialLinks, value: string) => {
    onFieldChange({
      social_links: { ...socialLinks, [platform]: value },
    });
  };

  return (
    <div className="space-y-6">
      <Card title="Contact Information">
        <div className="space-y-4">
          <Input
            label="Email"
            value={siteSpec.email ?? ""}
            onChange={(value) => onFieldChange({ email: value })}
            type="email"
            required
            placeholder="hello@yourdomain.co.uk"
            helperText="Your contact email, displayed on your website"
          />

          <Input
            label="Phone"
            value={siteSpec.phone ?? ""}
            onChange={(value) => onFieldChange({ phone: value })}
            type="tel"
            placeholder="07xxx xxxxxx"
          />

          <Input
            label="Booking URL"
            value={siteSpec.booking_url ?? ""}
            onChange={(value) => onFieldChange({ booking_url: value })}
            type="url"
            placeholder="https://calendly.com/yourname"
            helperText="Link to your online booking system (Calendly, Acuity, etc.)"
          />
        </div>
      </Card>

      <Card title="Social Media">
        <p className="mb-4 text-sm text-gray-500">
          Add your social media profiles. Leave blank any you do not use.
        </p>
        <div className="space-y-4">
          {SOCIAL_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={(socialLinks[field.key] as string) ?? ""}
              onChange={(value) => handleSocialChange(field.key, value)}
              type="url"
              placeholder={field.placeholder}
            />
          ))}
        </div>
      </Card>

      <Card title="Accreditation">
        <div className="space-y-4">
          <ToggleSwitch
            label="Doula UK member"
            checked={siteSpec.doula_uk ?? false}
            onChange={(checked) => onFieldChange({ doula_uk: checked })}
          />

          <Input
            label="Training Provider"
            value={siteSpec.training_provider ?? ""}
            onChange={(value) => onFieldChange({ training_provider: value })}
            placeholder="e.g. Developing Doulas, Nurturing Birth"
            helperText="Your doula training organisation"
          />

          <Input
            label="Training Year"
            value={siteSpec.training_year ?? ""}
            onChange={(value) => onFieldChange({ training_year: value })}
            placeholder="e.g. 2019"
            helperText="When you completed your training"
          />
        </div>
      </Card>
    </div>
  );
}
