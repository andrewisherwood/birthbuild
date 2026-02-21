/**
 * useBuild hook — triggers site build and tracks realtime status.
 *
 * Supports two build paths:
 * 1. Template build (triggerBuild) — deterministic, client-side HTML generation
 * 2. LLM build (triggerLlmBuild) — AI-generated pages via Edge Functions
 *
 * The LLM path:
 *   - Calls generate-design-system EF → CSS + nav + footer
 *   - Calls generate-page EF in parallel for each page
 *   - Creates a checkpoint in site_checkpoints
 *   - Sends files to the build EF for ZIP + Netlify deploy
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { generateSite } from "@/lib/site-generator";
import { getPaletteColours, meetsContrastAA } from "@/lib/palettes";
import { generateRobotsTxt, generateSitemap } from "@/lib/seo-files";
import { generateLlmsTxt } from "@/lib/llms-txt";
import { logEvent } from "@/lib/log-event";
import type { SiteSpec, SiteSpecStatus, CheckpointPage, CheckpointDesignSystem } from "@/types/site-spec";
import type { PhotoData } from "@/lib/pages/shared";
import type { GenerationProgress, GenerationStage } from "@/components/dashboard/GenerationProgress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuildStatus {
  status: SiteSpecStatus;
  deploy_url: string | null;
  preview_url: string | null;
  subdomain_slug: string | null;
}

interface UseBuildReturn {
  building: boolean;
  buildError: string | null;
  triggerBuild: () => Promise<void>;
  triggerLlmBuild: () => Promise<void>;
  generationProgress: GenerationProgress | null;
  lastBuildStatus: BuildStatus | null;
  validationWarnings: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRequiredFields(spec: SiteSpec): string[] {
  const missing: string[] = [];
  if (!spec.business_name) missing.push("business name");
  if (!spec.doula_name) missing.push("your name");
  if (!spec.service_area) missing.push("service area");
  if (!spec.services || spec.services.length < 1) missing.push("at least one service");
  if (!spec.email) missing.push("email address");
  return missing;
}

// ---------------------------------------------------------------------------
// Shared photo fetching
// ---------------------------------------------------------------------------

async function fetchPhotos(specId: string): Promise<{ photos: PhotoData[]; warnings: string[] }> {
  const warnings: string[] = [];

  const { data: photoRows, error: photoError } = await supabase
    .from("photos")
    .select("purpose, storage_path, alt_text")
    .eq("site_spec_id", specId);

  if (photoError) {
    console.error("[useBuild] Failed to fetch photos:", photoError.message);
  }

  // Use public URLs with Supabase Image Transforms (Pro plan).
  // The photos bucket is public so URLs never expire — safe to embed
  // in deployed sites. Transforms cap images at 1200px wide with
  // quality 80, typically reducing 2MB+ originals to ~100-150KB.
  // Supabase auto-converts to WebP for supported browsers.
  const rows = (photoRows ?? []) as Array<{ purpose: string; storage_path: string; alt_text: string }>;

  const photos: PhotoData[] = rows.map((row) => {
    const path = String(row.storage_path ?? "");
    const { data } = supabase.storage
      .from("photos")
      .getPublicUrl(path, {
        transform: { width: 1200, quality: 80 },
      });
    return {
      purpose: String(row.purpose ?? "general"),
      publicUrl: data.publicUrl,
      altText: String(row.alt_text ?? ""),
    };
  });

  const missingAlt = photos.filter((p) => !p.altText || p.altText.trim() === "");
  if (missingAlt.length > 0) {
    warnings.push(
      `${missingAlt.length} photo${missingAlt.length === 1 ? "" : "s"} missing alt text. Adding descriptive alt text improves accessibility.`,
    );
  }

  return { photos, warnings };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBuild(siteSpec: SiteSpec | null): UseBuildReturn {
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [lastBuildStatus, setLastBuildStatus] = useState<BuildStatus | null>(
    siteSpec
      ? {
          status: siteSpec.status,
          deploy_url: siteSpec.deploy_url,
          preview_url: siteSpec.preview_url,
          subdomain_slug: siteSpec.subdomain_slug,
        }
      : null,
  );

  const siteSpecRef = useRef(siteSpec);
  siteSpecRef.current = siteSpec;

  // Update local status when siteSpec changes externally
  useEffect(() => {
    if (siteSpec) {
      setLastBuildStatus({
        status: siteSpec.status,
        deploy_url: siteSpec.deploy_url,
        preview_url: siteSpec.preview_url,
        subdomain_slug: siteSpec.subdomain_slug,
      });
      if (siteSpec.status !== "building") {
        setBuilding(false);
      }
    }
  }, [siteSpec]);

  // Realtime subscription for status changes
  useEffect(() => {
    if (!siteSpec?.id) return;

    const channel = supabase
      .channel(`build-status-${siteSpec.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_specs",
          filter: `id=eq.${siteSpec.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const newStatus: BuildStatus = {
            status: (String(updated.status ?? "draft")) as SiteSpecStatus,
            deploy_url: updated.deploy_url ? String(updated.deploy_url) : null,
            preview_url: updated.preview_url ? String(updated.preview_url) : null,
            subdomain_slug: updated.subdomain_slug ? String(updated.subdomain_slug) : null,
          };
          setLastBuildStatus(newStatus);
          if (newStatus.status !== "building") {
            setBuilding(false);
            // Safety net: if the imperative setProgress("complete") didn't fire
            // (e.g. network hiccup), the Realtime subscription ensures the
            // progress bar reaches 100% when the backend confirms success.
            if (newStatus.status === "preview" || newStatus.status === "live") {
              setGenerationProgress((prev) =>
                prev && prev.stage !== "complete" ? { ...prev, stage: "complete" } : prev,
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [siteSpec?.id]);

  const isBuilding = building || lastBuildStatus?.status === "building";

  // -----------------------------------------------------------------
  // Template build (existing path)
  // -----------------------------------------------------------------

  const triggerBuild = useCallback(async () => {
    const spec = siteSpecRef.current;
    if (!spec) {
      setBuildError("No site specification loaded.");
      return;
    }

    const missing = validateRequiredFields(spec);
    if (missing.length > 0) {
      setBuildError(
        `Please complete the following before building: ${missing.join(", ")}.`,
      );
      return;
    }

    setBuildError(null);
    setBuilding(true);
    setValidationWarnings([]);
    setGenerationProgress(null);
    logEvent("build_triggered", { mode: "template" }, { siteSpecId: spec.id, userId: spec.user_id });

    const warnings: string[] = [];

    try {
      const { photos, warnings: photoWarnings } = await fetchPhotos(spec.id);
      warnings.push(...photoWarnings);

      const colours = getPaletteColours(spec.palette, spec.custom_colours);
      if (!meetsContrastAA(colours.text, colours.background)) {
        warnings.push(
          "Text colour may not meet WCAG AA contrast requirements against the background. Consider adjusting your colour palette.",
        );
      }

      setValidationWarnings(warnings);

      const site = generateSite(spec, photos);

      const files: Array<{ path: string; content: string }> = [];
      for (const page of site.pages) {
        files.push({ path: page.filename, content: page.html });
      }
      files.push({ path: "sitemap.xml", content: site.sitemap });
      files.push({ path: "robots.txt", content: site.robots });
      files.push({ path: "llms.txt", content: site.llmsTxt });

      const { data, error } = await invokeEdgeFunction<{
        success?: boolean;
        error?: string;
      }>("build", { site_spec_id: spec.id, files });

      if (error) {
        setBuildError(error);
        logEvent("build_failed", { mode: "template", error }, { siteSpecId: spec.id, userId: spec.user_id });
        setBuilding(false);
        return;
      }

      if (data?.error) {
        setBuildError(data.error);
        logEvent("build_failed", { mode: "template", error: data.error }, { siteSpecId: spec.id, userId: spec.user_id });
        setBuilding(false);
        return;
      }

      // Realtime should normally deliver this, but fetch once as a fallback so
      // the UI never stays in a stale "building" state.
      const { data: updatedRows } = await supabase
        .from("site_specs")
        .select("status, deploy_url, preview_url, subdomain_slug")
        .eq("id", spec.id)
        .limit(1);
      const updatedSpec = updatedRows?.[0] ?? null;

      if (updatedSpec) {
        setLastBuildStatus({
          status: String(updatedSpec.status ?? "preview") as SiteSpecStatus,
          deploy_url: updatedSpec.deploy_url ? String(updatedSpec.deploy_url) : null,
          preview_url: updatedSpec.preview_url ? String(updatedSpec.preview_url) : null,
          subdomain_slug: updatedSpec.subdomain_slug ? String(updatedSpec.subdomain_slug) : null,
        });
        if (updatedSpec.status !== "building") {
          setBuilding(false);
        }
      } else {
        setBuilding(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("[useBuild] Build error:", message);
      setBuildError("Something went wrong. Please try again.");
      logEvent("build_failed", { mode: "template", error: message }, { siteSpecId: spec.id, userId: spec.user_id });
      setBuilding(false);
    }
  }, []);

  // -----------------------------------------------------------------
  // LLM build (new path)
  // -----------------------------------------------------------------

  const triggerLlmBuild = useCallback(async () => {
    console.log("[useBuild] triggerLlmBuild called");

    const spec = siteSpecRef.current;
    if (!spec) {
      setBuildError("No site specification loaded.");
      return;
    }

    const missing = validateRequiredFields(spec);
    if (missing.length > 0) {
      setBuildError(
        `Please complete the following before building: ${missing.join(", ")}.`,
      );
      return;
    }

    console.log("[useBuild] Starting LLM build…");

    setBuildError(null);
    setBuilding(true);
    setValidationWarnings([]);
    logEvent("build_triggered", { mode: "llm" }, { siteSpecId: spec.id, userId: spec.user_id });

    const setProgress = (stage: GenerationStage, current = 0, total = 0, error?: string) => {
      setGenerationProgress({ stage, current, total, error });
    };

    try {
      // 1. Fetch photos
      console.log("[useBuild] Fetching photos…");
      const { photos, warnings: photoWarnings } = await fetchPhotos(spec.id);
      setValidationWarnings(photoWarnings);

      // 2. Generate design system
      console.log("[useBuild] Calling generate-design-system…");
      setProgress("design-system");

      const { data: dsData, error: dsError } = await invokeEdgeFunction<{
        success?: boolean;
        css?: string;
        nav_html?: string;
        footer_html?: string;
        wordmark_svg?: string;
        error?: string;
      }>("generate-design-system", { site_spec_id: spec.id });

      if (dsError) {
        console.error("[useBuild] generate-design-system error:", dsError);
        setBuildError(dsError);
        setProgress("error", 0, 0, dsError);
        setBuilding(false);
        return;
      }

      const designResponse = dsData;

      if (designResponse?.error || !designResponse?.css) {
        const msg = designResponse?.error ?? "Design system generation failed.";
        console.error("[useBuild] Design system response error:", msg);
        setBuildError(msg);
        setProgress("error", 0, 0, msg);
        setBuilding(false);
        return;
      }

      console.log("[useBuild] Design system generated successfully.");

      const designSystem: CheckpointDesignSystem = {
        css: designResponse.css,
        nav_html: designResponse.nav_html ?? "",
        footer_html: designResponse.footer_html ?? "",
        wordmark_svg: designResponse.wordmark_svg,
      };

      // 3. Generate pages in parallel
      //
      // Generate pages in parallel; each invocation has its own timeout guard.

      const pagesToGenerate = spec.pages.filter((p) => {
        if (p === "testimonials" && spec.testimonials.length === 0) return false;
        if (p === "faq" && !spec.faq_enabled) return false;
        return true;
      });

      console.log("[useBuild] Generating %d page(s): %s", pagesToGenerate.length, pagesToGenerate.join(", "));
      setProgress("pages", 0, pagesToGenerate.length);

      const generateSinglePage = async (page: string): Promise<CheckpointPage> => {
        console.log("[useBuild] Calling generate-page for '%s'…", page);
        const { data, error } = await invokeEdgeFunction<{
          filename?: string;
          html?: string;
          error?: string;
        }>(
          "generate-page",
          {
            site_spec_id: spec.id,
            page,
            design_system: {
              css: designSystem.css,
              nav_html: designSystem.nav_html,
              footer_html: designSystem.footer_html,
              wordmark_svg: designSystem.wordmark_svg ?? "",
            },
            photos: photos.map((p) => ({
              purpose: p.purpose,
              publicUrl: p.publicUrl,
              altText: p.altText,
            })),
          },
        );

        if (error) {
          throw new Error(error || `Failed to generate ${page} page.`);
        }

        if (data?.error || !data?.html) {
          throw new Error(data?.error ?? `Empty response for ${page} page.`);
        }

        console.log("[useBuild] Page '%s' generated → %s", page, data.filename);
        return { filename: data.filename ?? `${page}.html`, html: data.html };
      };

      // First pass: parallel generation
      let completedCount = 0;
      const results = await Promise.allSettled(
        pagesToGenerate.map(async (page) => {
          const result = await generateSinglePage(page);
          completedCount++;
          setProgress("pages", completedCount, pagesToGenerate.length);
          return result;
        }),
      );

      // Collect successes and failures
      const generatedPages: CheckpointPage[] = [];
      const failedPages: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          generatedPages.push(result.value);
        } else {
          failedPages.push(pagesToGenerate[index]!);
        }
      });

      // Retry failed pages once
      if (failedPages.length > 0) {
        console.warn("[useBuild] Retrying failed pages:", failedPages.join(", "));

        const retryResults = await Promise.allSettled(
          failedPages.map((page) => generateSinglePage(page)),
        );

        const stillFailed: string[] = [];
        retryResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            generatedPages.push(result.value);
          } else {
            stillFailed.push(failedPages[index]!);
          }
        });

        if (stillFailed.length > 0) {
          const msg = `Failed to generate page(s): ${stillFailed.join(", ")}. Please try again.`;
          setBuildError(msg);
          setProgress("error", 0, 0, msg);
          setBuilding(false);
          return;
        }
      }

      // 4. Save checkpoint (retry on version conflict from TOCTOU race)
      console.log("[useBuild] Saving checkpoint (%d pages)…", generatedPages.length);
      setProgress("saving");

      let checkpointId: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: versionRows, error: versionError } = await supabase
          .from("site_checkpoints")
          .select("version")
          .eq("site_spec_id", spec.id)
          .order("version", { ascending: false })
          .limit(1);

        if (versionError) {
          console.error("[useBuild] Failed to read checkpoint versions:", versionError.message);
          setBuildError("Failed to save checkpoint. Please try again.");
          setProgress("error", 0, 0, "Checkpoint save failed.");
          setBuilding(false);
          return;
        }

        const nextVersion = (versionRows?.[0]?.version ?? 0) + 1;

        const { data: cpRows, error: cpError } = await supabase
          .from("site_checkpoints")
          .insert({
            site_spec_id: spec.id,
            version: nextVersion,
            html_pages: { pages: generatedPages },
            design_system: designSystem,
            label: `AI build v${nextVersion}`,
          })
          .select("id");

        if (!cpError && cpRows?.[0]) {
          checkpointId = cpRows[0].id;
          break;
        }

        // 23505 = unique constraint violation (version already exists)
        if (cpError?.code === "23505" && attempt < 2) {
          console.warn(`[useBuild] Version conflict (attempt ${attempt + 1}), retrying…`);
          continue;
        }

        console.error("[useBuild] Checkpoint save error:", cpError?.message ?? "Unknown error");
        setBuildError("Failed to save checkpoint. Your pages were generated but not saved.");
        setProgress("error", 0, 0, "Checkpoint save failed.");
        setBuilding(false);
        return;
      }

      if (!checkpointId) {
        setBuildError("Failed to save checkpoint after retries.");
        setProgress("error", 0, 0, "Checkpoint save failed.");
        setBuilding(false);
        return;
      }

      // Update latest_checkpoint_id
      const { error: cpLinkError } = await supabase
        .from("site_specs")
        .update({ latest_checkpoint_id: checkpointId })
        .eq("id", spec.id);

      if (cpLinkError) {
        console.error("[useBuild] Failed to update latest_checkpoint_id:", cpLinkError.message);
      }

      // 5. Generate sitemap + robots and deploy
      console.log("[useBuild] Deploying to Netlify…");
      setProgress("deploying");

      const baseUrl = spec.subdomain_slug
        ? `https://${spec.subdomain_slug}.birthbuild.com`
        : "https://example.birthbuild.com";

      const files: Array<{ path: string; content: string }> = generatedPages.map((p) => ({
        path: p.filename,
        content: p.html,
      }));
      files.push({ path: "sitemap.xml", content: generateSitemap(generatedPages, baseUrl) });
      files.push({ path: "robots.txt", content: generateRobotsTxt(baseUrl) });
      files.push({ path: "llms.txt", content: generateLlmsTxt(spec) });

      const { data: buildData, error: buildErr } = await invokeEdgeFunction<{
        success?: boolean;
        error?: string;
      }>("build", { site_spec_id: spec.id, files });

      if (buildErr) {
        console.error("[useBuild] Deploy error:", buildErr);
        setBuildError(buildErr);
        setProgress("error", 0, 0, buildErr);
        setBuilding(false);
        return;
      }

      if (buildData?.error) {
        console.error("[useBuild] Deploy response error:", buildData.error);
        setBuildError(buildData.error);
        setProgress("error", 0, 0, buildData.error);
        setBuilding(false);
        return;
      }

      console.log("[useBuild] LLM build complete.");
      setProgress("complete");
      logEvent("build_succeeded", { mode: "llm" }, { siteSpecId: spec.id, userId: spec.user_id });

      // Fetch updated spec to get deploy_url/status (don't rely solely on realtime)
      const { data: updatedRows } = await supabase
        .from("site_specs")
        .select("status, deploy_url, preview_url, subdomain_slug")
        .eq("id", spec.id)
        .limit(1);
      const updatedSpec = updatedRows?.[0] ?? null;

      if (updatedSpec) {
        setLastBuildStatus({
          status: String(updatedSpec.status ?? "preview") as SiteSpecStatus,
          deploy_url: updatedSpec.deploy_url ? String(updatedSpec.deploy_url) : null,
          preview_url: updatedSpec.preview_url ? String(updatedSpec.preview_url) : null,
          subdomain_slug: updatedSpec.subdomain_slug ? String(updatedSpec.subdomain_slug) : null,
        });
      }

      setBuilding(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("[useBuild] LLM build error:", message);
      setBuildError("Something went wrong. Please try again.");
      setProgress("error", 0, 0, message);
      logEvent("build_failed", { mode: "llm", error: message }, { siteSpecId: spec.id, userId: spec.user_id });
      setBuilding(false);
    }
  }, []);

  return {
    building: isBuilding,
    buildError,
    triggerBuild,
    triggerLlmBuild,
    generationProgress,
    lastBuildStatus,
    validationWarnings,
  };
}
