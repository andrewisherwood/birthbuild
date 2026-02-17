import { useRef, useEffect, useState, useCallback } from "react";
import type { SiteSpec } from "@/types/site-spec";

export type TabKey =
  | "business"
  | "design"
  | "content"
  | "photos"
  | "contact"
  | "seo"
  | "preview"
  | "editor";

interface Tab {
  key: TabKey;
  label: string;
  /** Only show this tab when the predicate returns true */
  showWhen?: (spec: SiteSpec) => boolean;
}

const TABS: Tab[] = [
  { key: "business", label: "Business Details" },
  { key: "design", label: "Design" },
  { key: "content", label: "Content" },
  { key: "photos", label: "Photos" },
  { key: "contact", label: "Contact & Social" },
  { key: "seo", label: "SEO" },
  { key: "preview", label: "Preview & Publish" },
  {
    key: "editor",
    label: "Site Editor",
    showWhen: (spec) => spec.use_llm_generation && spec.latest_checkpoint_id !== null,
  },
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
      return false;
    case "contact":
      return Boolean(siteSpec.email);
    case "seo":
      return Boolean(siteSpec.primary_keyword);
    case "preview":
      return siteSpec.status === "live" || siteSpec.status === "preview";
    case "editor":
      return false;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftFade(scrollLeft > 4);
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  // Update fades on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateFades, { passive: true });
    // Initial check
    updateFades();
    return () => el.removeEventListener("scroll", updateFades);
  }, [updateFades]);

  // Also re-check fades on resize
  useEffect(() => {
    window.addEventListener("resize", updateFades);
    return () => window.removeEventListener("resize", updateFades);
  }, [updateFades]);

  // Auto-scroll active tab into view on mount
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeTab]);

  return (
    <div className={`relative border-b border-gray-200 ${className}`}>
      {/* Left fade overlay */}
      {showLeftFade && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-white to-transparent"
          aria-hidden="true"
        />
      )}

      {/* Right fade overlay */}
      {showRightFade && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white to-transparent"
          aria-hidden="true"
        />
      )}

      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Dashboard sections"
      >
        <nav className="flex min-w-max gap-0">
          {TABS.filter((tab) => !tab.showWhen || tab.showWhen(siteSpec)).map((tab) => {
            const isActive = activeTab === tab.key;
            const isComplete = isTabComplete(tab.key, siteSpec);

            return (
              <button
                key={tab.key}
                ref={isActive ? activeTabRef : undefined}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                onClick={() => onTabChange(tab.key)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${
                  isActive
                    ? "border-b-2 border-green-700 text-green-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                style={{ minHeight: "44px" }}
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
    </div>
  );
}
