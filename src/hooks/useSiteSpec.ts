import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { SiteSpec } from "@/types/site-spec";

interface UseSiteSpecReturn {
  siteSpec: SiteSpec | null;
  loading: boolean;
  error: string | null;
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
  createSiteSpec: () => Promise<SiteSpec | null>;
}

export function useSiteSpec(): UseSiteSpecReturn {
  const { user, profile } = useAuth();
  const [siteSpec, setSiteSpec] = useState<SiteSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const { data, error: fetchError } = await supabase
        .from("site_specs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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
  }, [user]);

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
    updateSiteSpec,
    createSiteSpec,
  };
}
