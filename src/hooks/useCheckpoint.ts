/**
 * useCheckpoint hook — CRUD for site_checkpoints.
 *
 * Manages versioned HTML snapshots of LLM-generated sites.
 * Each checkpoint stores the full HTML pages and optionally the design system
 * used to generate them (cached for deterministic edits).
 */

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import type {
  SiteCheckpoint,
  CheckpointPage,
  CheckpointDesignSystem,
} from "@/types/site-spec";

// ---------------------------------------------------------------------------
// Supabase row → domain type mapper
// ---------------------------------------------------------------------------

/** Shape returned by Supabase for site_checkpoints rows. */
interface CheckpointRow {
  id: string;
  site_spec_id: string;
  version: number;
  html_pages: { pages: CheckpointPage[] };
  design_system: CheckpointDesignSystem | null;
  label: string | null;
  created_at: string;
}

function toCheckpoint(row: CheckpointRow): SiteCheckpoint {
  return {
    id: row.id,
    site_spec_id: row.site_spec_id,
    version: row.version,
    html_pages: row.html_pages,
    design_system: row.design_system,
    label: row.label,
    created_at: row.created_at,
  };
}

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

  // Hard backstop: never let the spinner hang indefinitely (matches useSiteSpec/usePhotoUpload).
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 10_000);
    return () => clearTimeout(id);
  }, [loading]);

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

    setCheckpoints((data ?? []).map((row) => toCheckpoint(row as CheckpointRow)));
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

      // Retry loop: handles TOCTOU race on version numbers.
      // The unique constraint (site_spec_id, version) rejects duplicates;
      // on conflict we re-read the max version and retry (up to 3 attempts).
      let checkpoint: SiteCheckpoint | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: versionRows, error: versionError } = await supabase
          .from("site_checkpoints")
          .select("version")
          .eq("site_spec_id", siteSpecId)
          .order("version", { ascending: false })
          .limit(1);

        if (versionError) {
          console.error("[useCheckpoint] Failed to read checkpoint versions:", versionError.message);
          setError("Failed to save checkpoint.");
          return null;
        }

        const nextVersion = (versionRows?.[0]?.version ?? 0) + 1;

        const { data: insertRows, error: insertError } = await supabase
          .from("site_checkpoints")
          .insert({
            site_spec_id: siteSpecId,
            version: nextVersion,
            html_pages: { pages },
            design_system: designSystem ?? null,
            label: label ?? null,
          })
          .select("*");

        if (!insertError && insertRows?.[0]) {
          checkpoint = toCheckpoint(insertRows[0] as CheckpointRow);
          break;
        }

        // 23505 = unique constraint violation (version already exists)
        if (insertError?.code === "23505" && attempt < 2) {
          console.warn(`[useCheckpoint] Version conflict (attempt ${attempt + 1}), retrying…`);
          continue;
        }

        console.error("[useCheckpoint] Insert error:", insertError?.message ?? "Unknown error");
        setError("Failed to save checkpoint.");
        return null;
      }

      if (!checkpoint) {
        setError("Failed to save checkpoint after retries.");
        return null;
      }

      // Update latest_checkpoint_id on the site spec
      const { error: updateError } = await supabase
        .from("site_specs")
        .update({ latest_checkpoint_id: checkpoint.id })
        .eq("id", siteSpecId);

      if (updateError) {
        console.error("[useCheckpoint] Failed to update latest_checkpoint_id:", updateError.message);
      }

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
      const { data: cpRows, error: fetchError } = await supabase
        .from("site_checkpoints")
        .select("*")
        .eq("id", checkpointId)
        .limit(1);

      if (fetchError || !cpRows?.[0]) {
        setError("Checkpoint not found.");
        return false;
      }

      const typedCheckpoint = toCheckpoint(cpRows[0] as CheckpointRow);
      const htmlPages = typedCheckpoint.html_pages.pages;

      // Build files array for the build Edge Function
      const files: Array<{ path: string; content: string }> = htmlPages.map(
        (page: CheckpointPage) => ({
          path: page.filename,
          content: page.html,
        }),
      );

      // Generate sitemap and robots.txt
      const { data: specRows } = await supabase
        .from("site_specs")
        .select("subdomain_slug")
        .eq("id", siteSpecId)
        .limit(1);

      const slug = specRows?.[0]?.subdomain_slug;
      const baseUrl = slug
        ? `https://${slug}.birthbuild.com`
        : "https://example.birthbuild.com";

      files.push({
        path: "sitemap.xml",
        content: generateSitemap(htmlPages, baseUrl),
      });
      files.push({
        path: "robots.txt",
        content: generateRobotsTxt(baseUrl),
      });

      const { error: buildErr } = await invokeEdgeFunction<{
        success?: boolean;
        error?: string;
      }>("build", { site_spec_id: siteSpecId, files });

      if (buildErr) {
        setError(buildErr);
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
