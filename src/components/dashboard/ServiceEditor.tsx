import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ServiceItem } from "@/types/site-spec";

interface ServiceEditorProps {
  services: ServiceItem[];
  onChange: (services: ServiceItem[]) => void;
}

const SERVICE_TYPE_SUGGESTIONS = [
  "Birth Doula",
  "Postnatal Doula",
  "Antenatal Education",
  "Hypnobirthing",
  "Other",
];

function createEmptyService(): ServiceItem {
  return { type: "", title: "", description: "", price: "" };
}

export function ServiceEditor({ services, onChange }: ServiceEditorProps) {
  const handleFieldChange = (
    index: number,
    field: keyof ServiceItem,
    value: string,
  ) => {
    const updated = services.map((service, i) =>
      i === index ? { ...service, [field]: value } : service,
    );
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...services, createEmptyService()]);
  };

  const handleRemove = (index: number) => {
    onChange(services.filter((_, i) => i !== index));
  };

  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium text-gray-700">Services</legend>
      <p className="mt-1 text-sm text-gray-500">
        Add the services you offer. You can add as many as you like.
      </p>

      <div className="mt-4 space-y-4">
        {services.map((service, index) => (
          <div
            key={index}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-700">
                Service {index + 1}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(index)}
                aria-label={`Remove service ${index + 1}`}
              >
                Remove
              </Button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`service-type-${index}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  Type
                </label>
                <select
                  id={`service-type-${index}`}
                  value={service.type}
                  onChange={(e) =>
                    handleFieldChange(index, "type", e.target.value)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                >
                  <option value="">Select type...</option>
                  {SERVICE_TYPE_SUGGESTIONS.map((suggestion) => (
                    <option key={suggestion} value={suggestion}>
                      {suggestion}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Title"
                value={service.title}
                onChange={(value) => handleFieldChange(index, "title", value)}
                placeholder="e.g. Full Birth Support Package"
                id={`service-title-${index}`}
              />

              <div className="sm:col-span-2">
                <Input
                  label="Description"
                  value={service.description}
                  onChange={(value) =>
                    handleFieldChange(index, "description", value)
                  }
                  placeholder="Brief description of this service"
                  id={`service-description-${index}`}
                />
              </div>

              <Input
                label="Price"
                value={service.price}
                onChange={(value) => handleFieldChange(index, "price", value)}
                placeholder="e.g. From £800"
                id={`service-price-${index}`}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="mt-4"
      >
        + Add service
      </Button>
    </fieldset>
  );
}
