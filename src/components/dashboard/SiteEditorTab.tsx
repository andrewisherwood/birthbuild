/**
 * SiteEditorTab — deterministic editing controls for LLM-generated sites.
 *
 * Appears in the dashboard after the first LLM build.
 * All edits are instant (no LLM calls) and create new checkpoint versions.
 *
 * Features:
 * - Section list with reorder (up/down) and delete
 * - Colour pickers for the 5 CSS variable roles
 * - Font dropdowns for heading/body
 * - Live preview in iframe
 * - Save creates a new checkpoint, deploy sends to Netlify
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCheckpoint } from "@/hooks/useCheckpoint";
import { SiteEditChat } from "@/components/dashboard/SiteEditChat";
import { CheckpointHistory } from "@/components/dashboard/CheckpointHistory";
import {
  parseSections,
  reorderSections,
  removeSection,
} from "@/lib/section-parser";
import {
  extractCssVariables,
  updateAllPages,
  AVAILABLE_HEADING_FONTS,
  AVAILABLE_BODY_FONTS,
  type CssVariables,
} from "@/lib/css-editor";
import type { SiteSpec, CheckpointPage } from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SiteEditorTabProps {
  siteSpec: SiteSpec;
}

// ---------------------------------------------------------------------------
// Colour roles
// ---------------------------------------------------------------------------

const COLOUR_ROLES: Array<{ key: keyof CssVariables; label: string }> = [
  { key: "background", label: "Background" },
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
  { key: "cta", label: "CTA Button" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SiteEditorTab({ siteSpec }: SiteEditorTabProps) {
  const {
    checkpoints,
    latestCheckpoint,
    loading,
    error: checkpointError,
    fetchCheckpoints,
    createCheckpoint,
    deployCheckpoint,
  } = useCheckpoint();

  const [editedPages, setEditedPages] = useState<CheckpointPage[] | null>(null);
  const [cssVars, setCssVars] = useState<CssVariables | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string>("index.html");
  const previewRef = useRef<HTMLIFrameElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Fetch checkpoints on mount
  useEffect(() => {
    void fetchCheckpoints(siteSpec.id);
  }, [siteSpec.id, fetchCheckpoints]);

  // Initialise edited pages from latest checkpoint
  useEffect(() => {
    if (latestCheckpoint && !editedPages) {
      setEditedPages(latestCheckpoint.html_pages.pages);
      const firstPageHtml = latestCheckpoint.html_pages.pages[0]?.html ?? "";
      setCssVars(extractCssVariables(firstPageHtml));
    }
  }, [latestCheckpoint, editedPages]);

  // Live preview: update iframe via srcdoc (debounced 300ms)
  const currentPageHtml = useMemo(() => {
    if (!editedPages) return "";
    const page = editedPages.find((p) => p.filename === selectedPage);
    return page?.html ?? "";
  }, [editedPages, selectedPage]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (previewRef.current && currentPageHtml) {
        previewRef.current.srcdoc = currentPageHtml;
      }
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [currentPageHtml]);

  // Section list for the selected page
  const sections = useMemo(() => {
    return parseSections(currentPageHtml);
  }, [currentPageHtml]);

  // -----------------------------------------------------------------
  // Edit handlers
  // -----------------------------------------------------------------

  const applyPagesUpdate = useCallback(
    (updater: (pages: CheckpointPage[]) => CheckpointPage[]) => {
      setEditedPages((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);
        setHasChanges(true);
        return updated;
      });
    },
    [],
  );

  const handleMoveSection = useCallback(
    (sectionName: string, direction: "up" | "down") => {
      applyPagesUpdate((pages) =>
        pages.map((page) => {
          if (page.filename !== selectedPage) return page;

          const names = parseSections(page.html).map((s) => s.name);
          const idx = names.indexOf(sectionName);
          if (idx === -1) return page;

          const newNames = [...names];
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= newNames.length) return page;

          [newNames[idx], newNames[swapIdx]] = [newNames[swapIdx]!, newNames[idx]!];

          return { ...page, html: reorderSections(page.html, newNames) };
        }),
      );
    },
    [selectedPage, applyPagesUpdate],
  );

  const handleRemoveSection = useCallback(
    (sectionName: string) => {
      applyPagesUpdate((pages) =>
        pages.map((page) => {
          if (page.filename !== selectedPage) return page;
          return { ...page, html: removeSection(page.html, sectionName) };
        }),
      );
    },
    [selectedPage, applyPagesUpdate],
  );

  const handleColourChange = useCallback(
    (key: keyof CssVariables, value: string) => {
      setCssVars((prev) => (prev ? { ...prev, [key]: value } : prev));
      applyPagesUpdate((pages) => updateAllPages(pages, { [key]: value }));
    },
    [applyPagesUpdate],
  );

  const handleFontChange = useCallback(
    (key: "fontHeading" | "fontBody", value: string) => {
      setCssVars((prev) => (prev ? { ...prev, [key]: value } : prev));
      applyPagesUpdate((pages) => updateAllPages(pages, { [key]: value }));
    },
    [applyPagesUpdate],
  );

  // -----------------------------------------------------------------
  // Save / Deploy
  // -----------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!editedPages || !latestCheckpoint) return;
    setSaving(true);

    const checkpoint = await createCheckpoint(
      siteSpec.id,
      editedPages,
      latestCheckpoint.design_system ?? undefined,
      "Edited",
    );

    setSaving(false);
    if (checkpoint) {
      setHasChanges(false);
    }
  }, [editedPages, latestCheckpoint, siteSpec.id, createCheckpoint]);

  const handleDeploy = useCallback(async () => {
    if (!latestCheckpoint) return;
    setDeploying(true);
    await deployCheckpoint(latestCheckpoint.id, siteSpec.id);
    setDeploying(false);
  }, [latestCheckpoint, siteSpec.id, deployCheckpoint]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  if (loading) {
    return (
      <Card title="Site Editor">
        <p className="text-sm text-gray-500">Loading checkpoints...</p>
      </Card>
    );
  }

  if (!latestCheckpoint || checkpoints.length === 0) {
    return (
      <Card title="Site Editor">
        <p className="text-sm text-gray-500">
          No AI-generated site yet. Generate your site on the Preview &amp; Publish tab first.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page selector */}
      <Card title="Page">
        <div className="flex flex-wrap gap-2">
          {editedPages?.map((page) => (
            <button
              key={page.filename}
              type="button"
              onClick={() => setSelectedPage(page.filename)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedPage === page.filename
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {page.filename.replace(".html", "") || "home"}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: edit controls */}
        <div className="space-y-6">
          {/* Section list */}
          <Card title="Sections">
            {sections.length === 0 ? (
              <p className="text-sm text-gray-500">No sections found on this page.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {sections.map((section, index) => (
                  <li
                    key={section.name}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {section.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(section.name, "up")}
                        disabled={index === 0}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                        aria-label={`Move ${section.name} up`}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(section.name, "down")}
                        disabled={index === sections.length - 1}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                        aria-label={`Move ${section.name} down`}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(section.name)}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        aria-label={`Remove ${section.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Colour pickers */}
          <Card title="Colours">
            <div className="space-y-3">
              {cssVars &&
                COLOUR_ROLES.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label
                      htmlFor={`colour-${key}`}
                      className="w-28 text-sm font-medium text-gray-700"
                    >
                      {label}
                    </label>
                    <input
                      id={`colour-${key}`}
                      type="color"
                      value={cssVars[key]}
                      onChange={(e) => handleColourChange(key, e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-gray-300"
                    />
                    <span className="font-mono text-xs text-gray-500">
                      {cssVars[key]}
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Font selectors */}
          <Card title="Typography">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="font-heading"
                  className="block text-sm font-medium text-gray-700"
                >
                  Heading font
                </label>
                <select
                  id="font-heading"
                  value={cssVars?.fontHeading ?? ""}
                  onChange={(e) => handleFontChange("fontHeading", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
                >
                  {AVAILABLE_HEADING_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="font-body"
                  className="block text-sm font-medium text-gray-700"
                >
                  Body font
                </label>
                <select
                  id="font-body"
                  value={cssVars?.fontBody ?? ""}
                  onChange={(e) => handleFontChange("fontBody", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
                >
                  {AVAILABLE_BODY_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges || saving}
            >
              Save Checkpoint
            </Button>
            <Button
              onClick={handleDeploy}
              loading={deploying}
              disabled={deploying || hasChanges}
              variant="secondary"
            >
              {hasChanges ? "Save First" : "Deploy Latest"}
            </Button>
          </div>

          {checkpointError && (
            <p className="text-sm text-red-600">{checkpointError}</p>
          )}

          {/* AI Edit Chat */}
          {editedPages && (
            <SiteEditChat
              siteSpec={siteSpec}
              pages={editedPages}
              selectedPage={selectedPage}
              onPagesUpdated={(updated) => {
                setEditedPages(updated);
                setHasChanges(true);
              }}
            />
          )}
        </div>

        {/* Right column: live preview */}
        <div className="space-y-6">
          <Card title="Live Preview">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <iframe
                ref={previewRef}
                title="Site editor preview"
                sandbox=""
                className="h-[600px] w-full border-0 bg-white"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Checkpoint History */}
      <CheckpointHistory
        siteSpecId={siteSpec.id}
        checkpoints={checkpoints}
        onRollback={() => void fetchCheckpoints(siteSpec.id)}
      />
    </div>
  );
}
