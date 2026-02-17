import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
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

/**
 * Invoke the publish edge function via raw fetch, bypassing the Supabase SDK's
 * internal getSession() which can hang when auth state is corrupted.
 */
async function invokePublishDirect(
  body: { site_spec_id: string; action: "publish" | "unpublish" },
): Promise<{ data: { success?: boolean; error?: string; deploy_url?: string } | null; error: string | null }> {
  // Get a fresh access token
  const { data: sessionData, error: sessionError } =
    await supabase.auth.refreshSession();

  if (sessionError || !sessionData.session) {
    return {
      data: null,
      error: "Your session has expired. Please sign in again.",
    };
  }

  const accessToken = sessionData.session.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/publish`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) errorMessage = parsed.error;
    } catch {
      if (text) errorMessage = text;
    }
    return { data: null, error: errorMessage };
  }

  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    deploy_url?: string;
  };
  return { data, error: null };
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
      const { data, error } = await invokePublishDirect({
        site_spec_id: siteSpec.id,
        action: "publish",
      });

      if (error) {
        setPublishError(error);
        setPublishing(false);
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
      const { data, error } = await invokePublishDirect({
        site_spec_id: siteSpec.id,
        action: "unpublish",
      });

      if (error) {
        setPublishError(error);
        setPublishing(false);
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
