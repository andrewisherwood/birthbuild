import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
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
  const [sites, setSites] = useState<SiteSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
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
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setSites((data as SiteSpec[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchSites();
  }, [fetchSites]);

  const createSite = useCallback(async (): Promise<SiteSpec | null> => {
    if (!user) {
      setError("Must be authenticated to create a site.");
      return null;
    }

    setError(null);

    const newSpec = {
      user_id: user.id,
      tenant_id: profile?.tenant_id ?? null,
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
  }, [user, profile]);

  const deleteSite = useCallback(async (siteId: string) => {
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "delete-site",
        { body: { site_spec_id: siteId } },
      );

      if (invokeError) {
        const message =
          typeof invokeError === "object" && invokeError !== null && "message" in invokeError
            ? (invokeError as { message: string }).message
            : "Failed to delete site.";
        setError(message);
        return;
      }

      const response = data as { success?: boolean; error?: string } | undefined;
      if (response?.error) {
        setError(response.error);
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
