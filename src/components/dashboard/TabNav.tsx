import type { SiteSpec } from "@/types/site-spec";

export type TabKey =
  | "business"
  | "design"
  | "content"
  | "photos"
  | "contact"
  | "seo"
  | "preview";

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: "business", label: "Business Details" },
  { key: "design", label: "Design" },
  { key: "content", label: "Content" },
  { key: "photos", label: "Photos" },
  { key: "contact", label: "Contact & Social" },
  { key: "seo", label: "SEO" },
  { key: "preview", label: "Preview & Publish" },
];

interface TabNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  siteSpec: SiteSpec;
  className?: string;
}

function isTabComplete(tab: TabKey, siteSpec: SiteSpec): boolean {
  switch (tab) {
    case "business":
      return Boolean(siteSpec.business_name && siteSpec.doula_name && siteSpec.service_area);
    case "design":
      return Boolean(siteSpec.style && siteSpec.palette && siteSpec.typography);
    case "content":
      return Boolean(siteSpec.bio);
    case "photos":
      // Photos are optional, mark complete if at least one field elsewhere is filled
      return false;
    case "contact":
      return Boolean(siteSpec.email);
    case "seo":
      return Boolean(siteSpec.primary_keyword);
    case "preview":
      return siteSpec.status === "live";
    default:
      return false;
  }
}

export function TabNav({
  activeTab,
  onTabChange,
  siteSpec,
  className = "",
}: TabNavProps) {
  return (
    <div
      className={`overflow-x-auto border-b border-gray-200 ${className}`}
      role="tablist"
      aria-label="Dashboard sections"
    >
      <nav className="flex min-w-max gap-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isComplete = isTabComplete(tab.key, siteSpec);

          return (
            <button
              key={tab.key}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              onClick={() => onTabChange(tab.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${
                isActive
                  ? "border-b-2 border-green-700 text-green-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {isComplete && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-green-600"
                  aria-label={`${tab.label} complete`}
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
