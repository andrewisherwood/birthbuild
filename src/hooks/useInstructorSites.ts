import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFunctionBypass } from "@/lib/auth-bypass";
import { useAuth } from "@/hooks/useAuth";
import type { SiteSpec } from "@/types/site-spec";

interface UseInstructorSitesReturn {
  sites: SiteSpec[];
  loading: boolean;
  error: string | null;
  createSite: () => Promise<SiteSpec | null>;
  deleteSite: (siteId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useInstructorSites(): UseInstructorSitesReturn {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const tenantId = profile?.tenant_id ?? null;
  const [sites, setSites] = useState<SiteSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("site_specs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setSites((data as SiteSpec[]) ?? []);
    } catch {
      setError("Failed to load sites. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchSites();
  }, [fetchSites]);

  const createSite = useCallback(async (): Promise<SiteSpec | null> => {
    if (!userId) {
      setError("Must be authenticated to create a site.");
      return null;
    }

    setError(null);

    const newSpec = {
      user_id: userId,
      tenant_id: tenantId,
      session_id: null,
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
    setSites((prev) => [created, ...prev]);
    return created;
  }, [userId, tenantId]);

  const deleteSite = useCallback(async (siteId: string) => {
    setError(null);

    try {
      const { data, error: invokeError } = await invokeEdgeFunctionBypass<{
        success?: boolean;
        error?: string;
      }>("delete-site", { site_spec_id: siteId });

      if (invokeError) {
        setError(invokeError);
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSites((prev) => prev.filter((s) => s.id !== siteId));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    }
  }, []);

  return {
    sites,
    loading,
    error,
    createSite,
    deleteSite,
    refetch: fetchSites,
  };
}
