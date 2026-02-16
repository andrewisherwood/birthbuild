import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { SiteSpec } from "@/types/site-spec";

interface UseSiteSpecReturn {
  siteSpec: SiteSpec | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
  createSiteSpec: () => Promise<SiteSpec | null>;
}

export function useSiteSpec(siteId?: string): UseSiteSpecReturn {
  const { user, profile } = useAuth();
  const [siteSpec, setSiteSpec] = useState<SiteSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the updated_at value when the spec last transitioned to "live" or "building".
  // If the spec is later edited (updated_at advances), the build is stale.
  const lastBuildUpdatedAtRef = useRef<string | null>(null);

  // Fetch the current user's site spec on mount
  useEffect(() => {
    let mounted = true;

    async function fetchSiteSpec() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // When siteId is provided (instructor multi-site), fetch by ID + user_id.
      // Otherwise, fetch the latest spec for the current user.
      // Both paths scope by user_id so we don't rely solely on RLS.
      let query = supabase.from("site_specs").select("*").eq("user_id", user.id);
      if (siteId) {
        query = query.eq("id", siteId);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }
      const { data, error: fetchError } = await query.maybeSingle();

      if (!mounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setSiteSpec(data as SiteSpec | null);
      setLoading(false);
    }

    void fetchSiteSpec();

    return () => {
      mounted = false;
    };
  }, [user, siteId]);

  // Record the updated_at timestamp when a build starts (status -> building)
  // or when the site first loads as "live". This lets us detect edits after build.
  useEffect(() => {
    if (!siteSpec) return;
    if (siteSpec.status === "building" || siteSpec.status === "live" || siteSpec.status === "preview") {
      // Only set the ref if it hasn't been set, or if transitioning to building
      // (which means a new build was just triggered).
      if (
        siteSpec.status === "building" ||
        lastBuildUpdatedAtRef.current === null
      ) {
        lastBuildUpdatedAtRef.current = siteSpec.updated_at;
      }
    }
  }, [siteSpec?.status, siteSpec?.updated_at, siteSpec]);

  // Detect stale build: the spec has been edited (updated_at is newer) since
  // the last build was started.
  const isStale =
    siteSpec !== null &&
    (siteSpec.status === "live" || siteSpec.status === "preview") &&
    lastBuildUpdatedAtRef.current !== null &&
    siteSpec.updated_at > lastBuildUpdatedAtRef.current;

  const updateSiteSpec = useCallback(
    async (partial: Partial<SiteSpec>) => {
      if (!siteSpec) {
        setError("No site specification to update");
        return;
      }

      // Optimistic update: apply change to local state immediately
      const previousSpec = siteSpec;
      const optimisticSpec: SiteSpec = {
        ...siteSpec,
        ...partial,
        updated_at: new Date().toISOString(),
      };
      setSiteSpec(optimisticSpec);
      setError(null);

      // Sync to Supabase
      const { error: updateError } = await supabase
        .from("site_specs")
        .update({
          ...partial,
          updated_at: new Date().toISOString(),
        })
        .eq("id", siteSpec.id);

      if (updateError) {
        // Rollback on error
        setSiteSpec(previousSpec);
        setError(updateError.message);
      }
    },
    [siteSpec],
  );

  const createSiteSpec = useCallback(async (): Promise<SiteSpec | null> => {
    if (!user) {
      setError("Must be authenticated to create a site specification");
      return null;
    }

    setError(null);

    // Guard: check if a spec already exists to prevent duplicates from
    // concurrent React effects or rapid navigation.
    const { data: existing } = await supabase
      .from("site_specs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const spec = existing as SiteSpec;
      setSiteSpec(spec);
      return spec;
    }

    const newSpec = {
      user_id: user.id,
      tenant_id: profile?.tenant_id ?? null,
      session_id: profile?.session_id ?? null,
      status: "draft" as const,
    };

    const { data, error: createError } = await supabase
      .from("site_specs")
      .insert(newSpec)
      .select()
      .single();

    if (createError) {
      setError(createError.message);
      return null;
    }

    const created = data as SiteSpec;
    setSiteSpec(created);
    return created;
  }, [user, profile]);

  return {
    siteSpec,
    loading,
    error,
    isStale,
    updateSiteSpec,
    createSiteSpec,
  };
}
