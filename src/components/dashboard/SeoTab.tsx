import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { SiteSpec } from "@/types/site-spec";

interface SeoTabProps {
  siteSpec: SiteSpec;
  onFieldChange: (partial: Partial<SiteSpec>) => void;
}

interface PageOption {
  key: string;
  label: string;
  alwaysOn: boolean;
}

const PAGE_OPTIONS: PageOption[] = [
  { key: "home", label: "Home", alwaysOn: true },
  { key: "about", label: "About", alwaysOn: false },
  { key: "services", label: "Services", alwaysOn: false },
  { key: "contact", label: "Contact", alwaysOn: false },
  { key: "testimonials", label: "Testimonials", alwaysOn: false },
  { key: "faq", label: "FAQ", alwaysOn: false },
  { key: "blog", label: "Blog", alwaysOn: false },
];

export function SeoTab({ siteSpec, onFieldChange }: SeoTabProps) {
  const pages = siteSpec.pages ?? ["home"];

  const handlePageToggle = (pageKey: string, checked: boolean) => {
    let updated: string[];
    if (checked) {
      updated = [...pages, pageKey];
    } else {
      updated = pages.filter((p) => p !== pageKey);
    }
    onFieldChange({ pages: updated });
  };

  return (
    <div className="space-y-6">
      <Card title="SEO">
        <div className="space-y-4">
          <Input
            label="Primary Keyword"
            value={siteSpec.primary_keyword ?? ""}
            onChange={(value) => onFieldChange({ primary_keyword: value })}
            placeholder="e.g. doula Manchester"
            helperText="The main search term you want to rank for. This informs meta tags and page titles."
          />
        </div>
      </Card>

      <Card title="Pages to Generate">
        <p className="mb-4 text-sm text-gray-500">
          Select which pages to include on your website. Home is always included.
        </p>
        <fieldset>
          <legend className="sr-only">Pages to generate</legend>
          <div className="space-y-3">
            {PAGE_OPTIONS.map((option) => {
              const isChecked = option.alwaysOn || pages.includes(option.key);
              const inputId = `page-${option.key}`;
              return (
                <label
                  key={option.key}
                  htmlFor={inputId}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={isChecked}
                    disabled={option.alwaysOn}
                    onChange={(e) =>
                      handlePageToggle(option.key, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-500 disabled:opacity-50"
                  />
                  <span
                    className={`text-sm ${
                      option.alwaysOn
                        ? "text-gray-400"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                    {option.alwaysOn && (
                      <span className="ml-1 text-xs text-gray-400">
                        (always included)
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>
    </div>
  );
}
