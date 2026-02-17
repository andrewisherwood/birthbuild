/**
 * useCheckpoint hook — CRUD for site_checkpoints.
 *
 * Manages versioned HTML snapshots of LLM-generated sites.
 * Each checkpoint stores the full HTML pages and optionally the design system
 * used to generate them (cached for deterministic edits).
 */

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  SiteCheckpoint,
  CheckpointPage,
  CheckpointDesignSystem,
} from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCheckpointReturn {
  checkpoints: SiteCheckpoint[];
  latestCheckpoint: SiteCheckpoint | null;
  loading: boolean;
  error: string | null;
  fetchCheckpoints: (siteSpecId: string) => Promise<void>;
  createCheckpoint: (
    siteSpecId: string,
    pages: CheckpointPage[],
    designSystem?: CheckpointDesignSystem,
    label?: string,
  ) => Promise<SiteCheckpoint | null>;
  deployCheckpoint: (
    checkpointId: string,
    siteSpecId: string,
  ) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCheckpoint(): UseCheckpointReturn {
  const [checkpoints, setCheckpoints] = useState<SiteCheckpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestCheckpoint = checkpoints.length > 0 ? checkpoints[0]! : null;

  const fetchCheckpoints = useCallback(async (siteSpecId: string) => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("site_checkpoints")
      .select("*")
      .eq("site_spec_id", siteSpecId)
      .order("version", { ascending: false });

    if (fetchError) {
      console.error("[useCheckpoint] Fetch error:", fetchError.message);
      setError("Failed to load checkpoints.");
      setLoading(false);
      return;
    }

    setCheckpoints((data ?? []) as unknown as SiteCheckpoint[]);
    setLoading(false);
  }, []);

  const createCheckpoint = useCallback(
    async (
      siteSpecId: string,
      pages: CheckpointPage[],
      designSystem?: CheckpointDesignSystem,
      label?: string,
    ): Promise<SiteCheckpoint | null> => {
      setError(null);

      // Determine next version number
      const { data: maxRow } = await supabase
        .from("site_checkpoints")
        .select("version")
        .eq("site_spec_id", siteSpecId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const nextVersion = maxRow ? (maxRow.version as number) + 1 : 1;

      const { data, error: insertError } = await supabase
        .from("site_checkpoints")
        .insert({
          site_spec_id: siteSpecId,
          version: nextVersion,
          html_pages: { pages },
          design_system: designSystem ?? null,
          label: label ?? null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[useCheckpoint] Insert error:", insertError.message);
        setError("Failed to save checkpoint.");
        return null;
      }

      const checkpoint = data as unknown as SiteCheckpoint;

      // Update latest_checkpoint_id on the site spec
      await supabase
        .from("site_specs")
        .update({ latest_checkpoint_id: checkpoint.id })
        .eq("id", siteSpecId);

      // Prepend to local state
      setCheckpoints((prev) => [checkpoint, ...prev]);

      return checkpoint;
    },
    [],
  );

  const deployCheckpoint = useCallback(
    async (checkpointId: string, siteSpecId: string): Promise<boolean> => {
      setError(null);

      // Fetch the checkpoint
      const { data: checkpoint, error: fetchError } = await supabase
        .from("site_checkpoints")
        .select("*")
        .eq("id", checkpointId)
        .single();

      if (fetchError || !checkpoint) {
        setError("Checkpoint not found.");
        return false;
      }

      const htmlPages = (checkpoint.html_pages as { pages: CheckpointPage[] }).pages;

      // Build files array for the build Edge Function
      const files: Array<{ path: string; content: string }> = htmlPages.map(
        (page: CheckpointPage) => ({
          path: page.filename,
          content: page.html,
        }),
      );

      // Generate sitemap and robots.txt
      const { data: spec } = await supabase
        .from("site_specs")
        .select("subdomain_slug")
        .eq("id", siteSpecId)
        .single();

      const baseUrl = spec?.subdomain_slug
        ? `https://${spec.subdomain_slug}.birthbuild.com`
        : "https://example.birthbuild.com";

      files.push({
        path: "sitemap.xml",
        content: generateSitemap(htmlPages, baseUrl),
      });
      files.push({
        path: "robots.txt",
        content: generateRobotsTxt(baseUrl),
      });

      // Call build Edge Function
      const { error: buildError } = await supabase.functions.invoke("build", {
        body: { site_spec_id: siteSpecId, files },
      });

      if (buildError) {
        const message =
          typeof buildError === "object" && buildError !== null && "message" in buildError
            ? (buildError as { message: string }).message
            : "Deploy failed. Please try again.";
        setError(message);
        return false;
      }

      return true;
    },
    [],
  );

  return {
    checkpoints,
    latestCheckpoint,
    loading,
    error,
    fetchCheckpoints,
    createCheckpoint,
    deployCheckpoint,
  };
}

// ---------------------------------------------------------------------------
// Sitemap/robots helpers (same logic as site-generator.ts)
// ---------------------------------------------------------------------------

function generateSitemap(pages: CheckpointPage[], baseUrl: string): string {
  const urls = pages
    .map(
      (page) =>
        `  <url>
    <loc>${baseUrl}/${page.filename}</loc>
    <changefreq>monthly</changefreq>
    <priority>${page.filename === "index.html" ? "1.0" : "0.8"}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}
