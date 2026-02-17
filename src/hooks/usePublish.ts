import { useState, useCallback } from "react";
import { invokeEdgeFunctionBypass } from "@/lib/auth-bypass";
import type { SiteSpec } from "@/types/site-spec";

interface UsePublishOptions {
  onComplete?: () => void;
}

interface UsePublishReturn {
  publishing: boolean;
  publishError: string | null;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
}

export function usePublish(siteSpec: SiteSpec | null, options?: UsePublishOptions): UsePublishReturn {
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
      const { data, error } = await invokeEdgeFunctionBypass<{
        success?: boolean;
        error?: string;
        deploy_url?: string;
      }>("publish", { site_spec_id: siteSpec.id, action: "publish" });

      if (error) {
        setPublishError(error);
        return;
      }

      if (data?.error) {
        setPublishError(data.error);
      } else {
        options?.onComplete?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPublishError(message);
    } finally {
      setPublishing(false);
    }
  }, [siteSpec, options]);

  const unpublish = useCallback(async () => {
    if (!siteSpec) {
      setPublishError("No site specification loaded.");
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const { data, error } = await invokeEdgeFunctionBypass<{
        success?: boolean;
        error?: string;
      }>("publish", { site_spec_id: siteSpec.id, action: "unpublish" });

      if (error) {
        setPublishError(error);
        return;
      }

      if (data?.error) {
        setPublishError(data.error);
      } else {
        options?.onComplete?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setPublishError(message);
    } finally {
      setPublishing(false);
    }
  }, [siteSpec, options]);

  return {
    publishing,
    publishError,
    publish,
    unpublish,
  };
}
