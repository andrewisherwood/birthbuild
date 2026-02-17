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
import { generateSite } from "@/lib/site-generator";
import { getPaletteColours, meetsContrastAA } from "@/lib/palettes";
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

  const storagePaths = (photoRows ?? []).map((row) => row.storage_path as string);
  const signedUrlMap: Record<string, string> = {};
  if (storagePaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("photos")
      .createSignedUrls(storagePaths, 3600);
    if (signedData) {
      for (const item of signedData) {
        if (item.signedUrl) {
          signedUrlMap[item.path ?? ""] = item.signedUrl;
        }
      }
    }
  }

  const photos: PhotoData[] = (photoRows ?? []).map((row) => {
    const path = row.storage_path as string;
    return {
      purpose: (row.purpose as string) ?? "general",
      publicUrl: signedUrlMap[path] ?? "",
      altText: (row.alt_text as string) ?? "",
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
// Sitemap/robots helpers
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
            status: (updated.status as SiteSpecStatus) ?? "draft",
            deploy_url: (updated.deploy_url as string | null) ?? null,
            preview_url: (updated.preview_url as string | null) ?? null,
            subdomain_slug: (updated.subdomain_slug as string | null) ?? null,
          };
          setLastBuildStatus(newStatus);
          if (newStatus.status !== "building") {
            setBuilding(false);
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

      const { data, error } = await supabase.functions.invoke("build", {
        body: { site_spec_id: spec.id, files },
      });

      if (error) {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? (error as { message: string }).message
            : "Build failed. Please try again.";
        setBuildError(message);
        setBuilding(false);
        return;
      }

      const response = data as { success?: boolean; error?: string } | undefined;
      if (response?.error) {
        setBuildError(response.error);
        setBuilding(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("[useBuild] Build error:", message);
      setBuildError("Something went wrong. Please try again.");
      setBuilding(false);
    }
  }, []);

  // -----------------------------------------------------------------
  // LLM build (new path)
  // -----------------------------------------------------------------

  const triggerLlmBuild = useCallback(async () => {
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

    const setProgress = (stage: GenerationStage, current = 0, total = 0, error?: string) => {
      setGenerationProgress({ stage, current, total, error });
    };

    try {
      // 1. Fetch photos
      const { photos, warnings: photoWarnings } = await fetchPhotos(spec.id);
      setValidationWarnings(photoWarnings);

      // 2. Generate design system
      setProgress("design-system");

      const { data: dsData, error: dsError } = await supabase.functions.invoke(
        "generate-design-system",
        { body: { site_spec_id: spec.id } },
      );

      if (dsError) {
        const msg = typeof dsError === "object" && dsError !== null && "message" in dsError
          ? (dsError as { message: string }).message
          : "Failed to generate design system.";
        setBuildError(msg);
        setProgress("error", 0, 0, msg);
        setBuilding(false);
        return;
      }

      const designResponse = dsData as {
        success?: boolean;
        css?: string;
        nav_html?: string;
        footer_html?: string;
        wordmark_svg?: string;
        error?: string;
      } | undefined;

      if (designResponse?.error || !designResponse?.css) {
        const msg = designResponse?.error ?? "Design system generation failed.";
        setBuildError(msg);
        setProgress("error", 0, 0, msg);
        setBuilding(false);
        return;
      }

      const designSystem: CheckpointDesignSystem = {
        css: designResponse.css,
        nav_html: designResponse.nav_html ?? "",
        footer_html: designResponse.footer_html ?? "",
        wordmark_svg: designResponse.wordmark_svg,
      };

      // 3. Generate pages in parallel
      const pagesToGenerate = spec.pages.filter((p) => {
        if (p === "testimonials" && spec.testimonials.length === 0) return false;
        if (p === "faq" && !spec.faq_enabled) return false;
        return true;
      });

      setProgress("pages", 0, pagesToGenerate.length);

      const generateSinglePage = async (page: string): Promise<CheckpointPage> => {
        const { data, error } = await supabase.functions.invoke("generate-page", {
          body: {
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
        });

        if (error) {
          throw new Error(
            typeof error === "object" && error !== null && "message" in error
              ? (error as { message: string }).message
              : `Failed to generate ${page} page.`,
          );
        }

        const response = data as { filename?: string; html?: string; error?: string } | undefined;
        if (response?.error || !response?.html) {
          throw new Error(response?.error ?? `Empty response for ${page} page.`);
        }

        return { filename: response.filename ?? `${page}.html`, html: response.html };
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

      // 4. Save checkpoint
      setProgress("saving");

      const { data: maxRow } = await supabase
        .from("site_checkpoints")
        .select("version")
        .eq("site_spec_id", spec.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const nextVersion = maxRow ? (maxRow.version as number) + 1 : 1;

      const { data: checkpoint, error: cpError } = await supabase
        .from("site_checkpoints")
        .insert({
          site_spec_id: spec.id,
          version: nextVersion,
          html_pages: { pages: generatedPages },
          design_system: designSystem,
          label: `AI build v${nextVersion}`,
        })
        .select("id")
        .single();

      if (cpError) {
        console.error("[useBuild] Checkpoint save error:", cpError.message);
        setBuildError("Failed to save checkpoint. Your pages were generated but not saved.");
        setProgress("error", 0, 0, "Checkpoint save failed.");
        setBuilding(false);
        return;
      }

      // Update latest_checkpoint_id
      await supabase
        .from("site_specs")
        .update({ latest_checkpoint_id: checkpoint?.id })
        .eq("id", spec.id);

      // 5. Generate sitemap + robots and deploy
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

      const { data: buildData, error: buildErr } = await supabase.functions.invoke("build", {
        body: { site_spec_id: spec.id, files },
      });

      if (buildErr) {
        const msg =
          typeof buildErr === "object" && buildErr !== null && "message" in buildErr
            ? (buildErr as { message: string }).message
            : "Deploy failed. Please try again.";
        setBuildError(msg);
        setProgress("error", 0, 0, msg);
        setBuilding(false);
        return;
      }

      const buildResponse = buildData as { success?: boolean; error?: string } | undefined;
      if (buildResponse?.error) {
        setBuildError(buildResponse.error);
        setProgress("error", 0, 0, buildResponse.error);
        setBuilding(false);
        return;
      }

      setProgress("complete");
      // Realtime subscription will handle status updates from here
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("[useBuild] LLM build error:", message);
      setBuildError("Something went wrong. Please try again.");
      setProgress("error", 0, 0, message);
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
