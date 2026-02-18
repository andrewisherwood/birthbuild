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
  "Placenta Services",
  "Breastfeeding Support",
  "Other",
];

const BIRTH_TYPE_OPTIONS = [
  "Home birth",
  "Hospital",
  "Birth centre",
  "Water birth",
  "VBAC",
  "Caesarean birth companion",
];

const EXPERIENCE_OPTIONS = [
  { value: "starting_out", label: "Just starting out" },
  { value: "10-30", label: "10-30 families" },
  { value: "30-60", label: "30-60 families" },
  { value: "60-100", label: "60-100 families" },
  { value: "100+", label: "100+ families" },
];

const FORMAT_OPTIONS = [
  { value: "group", label: "Group" },
  { value: "private", label: "Private" },
  { value: "both", label: "Both" },
];

function isBirthDoula(type: string): boolean {
  return type.toLowerCase().includes("birth doula") || type.toLowerCase() === "birth-support";
}

function isHypnobirthing(type: string): boolean {
  return type.toLowerCase().includes("hypnobirthing");
}

function createEmptyService(): ServiceItem {
  return { type: "", title: "", description: "", price: "" };
}

export function ServiceEditor({ services, onChange }: ServiceEditorProps) {
  const handleFieldChange = (
    index: number,
    field: string,
    value: string | string[],
  ) => {
    const updated = services.map((service, i) =>
      i === index ? { ...service, [field]: value } : service,
    );
    onChange(updated);
  };

  const handleBirthTypeToggle = (index: number, birthType: string) => {
    const current = services[index]?.birth_types ?? [];
    const next = current.includes(birthType)
      ? current.filter((t) => t !== birthType)
      : [...current, birthType];
    handleFieldChange(index, "birth_types", next);
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

              {/* Experience level — shown for all service types */}
              {service.type && (
                <div>
                  <label
                    htmlFor={`service-experience-${index}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Experience
                  </label>
                  <select
                    id={`service-experience-${index}`}
                    value={service.experience_level ?? ""}
                    onChange={(e) =>
                      handleFieldChange(index, "experience_level", e.target.value)
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  >
                    <option value="">How many families?</option>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Birth Doula depth: birth_types */}
            {isBirthDoula(service.type) && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700">
                  Types of birth you support
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {BIRTH_TYPE_OPTIONS.map((bt) => {
                    const selected = (service.birth_types ?? []).includes(bt);
                    return (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => handleBirthTypeToggle(index, bt)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                        }`}
                        aria-pressed={selected}
                      >
                        {bt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hypnobirthing depth: format + programme */}
            {isHypnobirthing(service.type) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`service-format-${index}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Format
                  </label>
                  <select
                    id={`service-format-${index}`}
                    value={service.format ?? ""}
                    onChange={(e) =>
                      handleFieldChange(index, "format", e.target.value)
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                  >
                    <option value="">Select format...</option>
                    {FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Programme"
                  value={service.programme ?? ""}
                  onChange={(value) => handleFieldChange(index, "programme", value)}
                  placeholder="e.g. KGH, Calm Birth School"
                  id={`service-programme-${index}`}
                />
              </div>
            )}
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
