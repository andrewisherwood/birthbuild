import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { SiteSpec } from "@/types/site-spec";

interface UsePublishReturn {
  publishing: boolean;
  publishError: string | null;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
}

export function usePublish(siteSpec: SiteSpec | null): UsePublishReturn {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const publish = useCallback(async () => {
    if (!siteSpec) {
      setPublishError("No site specification loaded.");
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const { data, error } = await supabase.functions.invoke("publish", {
        body: { site_spec_id: siteSpec.id, action: "publish" },
      });

      if (error) {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? (error as { message: string }).message
            : "Publish failed. Please try again.";
        setPublishError(message);
        setPublishing(false);
        return;
      }

      const response = data as { success?: boolean; error?: string } | undefined;
      if (response?.error) {
        setPublishError(response.error);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPublishError(message);
    } finally {
      setPublishing(false);
    }
  }, [siteSpec]);

  const unpublish = useCallback(async () => {
    if (!siteSpec) {
      setPublishError("No site specification loaded.");
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const { data, error } = await supabase.functions.invoke("publish", {
        body: { site_spec_id: siteSpec.id, action: "unpublish" },
      });

      if (error) {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? (error as { message: string }).message
            : "Unpublish failed. Please try again.";
        setPublishError(message);
        setPublishing(false);
        return;
      }

      const response = data as { success?: boolean; error?: string } | undefined;
      if (response?.error) {
        setPublishError(response.error);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPublishError(message);
    } finally {
      setPublishing(false);
    }
  }, [siteSpec]);

  return {
    publishing,
    publishError,
    publish,
    unpublish,
  };
}
