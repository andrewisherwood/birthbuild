import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ServiceEditor } from "@/components/dashboard/ServiceEditor";
import type { SiteSpec, ServiceItem } from "@/types/site-spec";

interface BusinessDetailsTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
}

export function BusinessDetailsTab({
  siteSpec,
  onFieldChange,
}: BusinessDetailsTabProps) {
  const handleServicesChange = (services: ServiceItem[]) => {
    onFieldChange({ services });
  };

  return (
    <div className="space-y-6">
      <Card title="Business Information">
        <div className="space-y-4">
          <Input
            label="Business Name"
            value={siteSpec.business_name ?? ""}
            onChange={(value) => onFieldChange({ business_name: value })}
            required
            placeholder="e.g. Bloom Doula Services"
            helperText="The name displayed across your website"
          />

          <Input
            label="Your Name"
            value={siteSpec.doula_name ?? ""}
            onChange={(value) => onFieldChange({ doula_name: value })}
            required
            placeholder="e.g. Sarah Thompson"
            helperText="Your full name as it appears on your site"
          />

          <Input
            label="Tagline"
            value={siteSpec.tagline ?? ""}
            onChange={(value) => onFieldChange({ tagline: value })}
            placeholder="e.g. Supporting families through their birth journey"
            helperText="A short phrase that appears below your business name"
          />

          <Input
            label="Service Area"
            value={siteSpec.service_area ?? ""}
            onChange={(value) => onFieldChange({ service_area: value })}
            required
            placeholder="e.g. Greater Manchester, North West England"
            helperText="The area you cover — helps with local SEO"
          />
        </div>
      </Card>

      <Card>
        <ServiceEditor
          services={siteSpec.services ?? []}
          onChange={handleServicesChange}
        />
      </Card>
    </div>
  );
}
