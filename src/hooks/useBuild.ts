/**
 * useBuild hook — triggers site build and tracks realtime status.
 *
 * 1. Validates required fields locally
 * 2. Fetches photos from Supabase
 * 3. Calls generateSite() to produce HTML/CSS/JS
 * 4. Sends generated files to the build Edge Function
 * 5. Subscribes to Supabase Realtime for status updates
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { generateSite } from "@/lib/site-generator";
import { getPaletteColours, meetsContrastAA } from "@/lib/palettes";
import type { SiteSpec, SiteSpecStatus } from "@/types/site-spec";
import type { PhotoData } from "@/lib/pages/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuildStatus {
  status: SiteSpecStatus;
  deploy_url: string | null;
  subdomain_slug: string | null;
}

interface UseBuildReturn {
  building: boolean;
  buildError: string | null;
  triggerBuild: () => Promise<void>;
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
// Hook
// ---------------------------------------------------------------------------

export function useBuild(siteSpec: SiteSpec | null): UseBuildReturn {
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [lastBuildStatus, setLastBuildStatus] = useState<BuildStatus | null>(
    siteSpec
      ? {
          status: siteSpec.status,
          deploy_url: siteSpec.deploy_url,
          subdomain_slug: siteSpec.subdomain_slug,
        }
      : null,
  );

  // Keep a ref to avoid stale closures with siteSpec
  const siteSpecRef = useRef(siteSpec);
  siteSpecRef.current = siteSpec;

  // Update local status when siteSpec changes externally
  useEffect(() => {
    if (siteSpec) {
      setLastBuildStatus({
        status: siteSpec.status,
        deploy_url: siteSpec.deploy_url,
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

  // Derive building state from lastBuildStatus
  const isBuilding = building || lastBuildStatus?.status === "building";

  const triggerBuild = useCallback(async () => {
    const spec = siteSpecRef.current;
    if (!spec) {
      setBuildError("No site specification loaded.");
      return;
    }

    // 1. Validate required fields
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

    const warnings: string[] = [];

    try {
      // 2. Fetch photos from Supabase
      const { data: photoRows, error: photoError } = await supabase
        .from("photos")
        .select("purpose, storage_path, alt_text")
        .eq("site_spec_id", spec.id);

      if (photoError) {
        console.error("[useBuild] Failed to fetch photos:", photoError.message);
      }

      const photos: PhotoData[] = (photoRows ?? []).map((row) => {
        const { data: urlData } = supabase.storage
          .from("photos")
          .getPublicUrl(row.storage_path as string);

        return {
          purpose: (row.purpose as string) ?? "general",
          publicUrl: urlData.publicUrl,
          altText: (row.alt_text as string) ?? "",
        };
      });

      // 2a. Check for missing alt text (non-blocking warning)
      const missingAlt = photos.filter((p) => !p.altText || p.altText.trim() === "");
      if (missingAlt.length > 0) {
        warnings.push(
          `${missingAlt.length} photo${missingAlt.length === 1 ? "" : "s"} missing alt text. Adding descriptive alt text improves accessibility.`,
        );
      }

      // 2b. Check colour contrast (non-blocking warning)
      const colours = getPaletteColours(spec.palette, spec.custom_colours);
      if (!meetsContrastAA(colours.text, colours.background)) {
        warnings.push(
          "Text colour may not meet WCAG AA contrast requirements against the background. Consider adjusting your colour palette.",
        );
      }

      setValidationWarnings(warnings);

      // 3. Generate site files
      const site = generateSite(spec, photos);

      // 4. Convert to files array for the Edge Function
      const files: Array<{ path: string; content: string }> = [];

      for (const page of site.pages) {
        files.push({ path: page.filename, content: page.html });
      }
      files.push({ path: "sitemap.xml", content: site.sitemap });
      files.push({ path: "robots.txt", content: site.robots });

      // 5. Call the build Edge Function
      const { data, error } = await supabase.functions.invoke("build", {
        body: {
          site_spec_id: spec.id,
          files,
        },
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

      const response = data as { success?: boolean; deploy_url?: string; error?: string } | undefined;
      if (response?.error) {
        setBuildError(response.error);
        setBuilding(false);
        return;
      }

      // Build was submitted. Realtime subscription will handle status updates.
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("[useBuild] Build error:", message);
      setBuildError("Something went wrong. Please try again.");
      setBuilding(false);
    }
  }, []);

  return {
    building: isBuilding,
    buildError,
    triggerBuild,
    lastBuildStatus,
    validationWarnings,
  };
}
