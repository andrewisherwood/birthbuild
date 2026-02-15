import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteSpec } from "@/types/site-spec";

interface UseDebouncedSaveOptions {
  updateSiteSpec: (partial: Partial<SiteSpec>) => Promise<void>;
  delay?: number;
}

interface UseDebouncedSaveReturn {
  debouncedUpdate: (partial: Partial<SiteSpec>) => void;
  flushNow: () => void;
  isPending: boolean;
}

export function useDebouncedSave({
  updateSiteSpec,
  delay = 500,
}: UseDebouncedSaveOptions): UseDebouncedSaveReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<SiteSpec> | null>(null);
  const [isPending, setIsPending] = useState(false);
  const updateRef = useRef(updateSiteSpec);

  // Keep updateSiteSpec ref current without triggering effect re-runs
  useEffect(() => {
    updateRef.current = updateSiteSpec;
  }, [updateSiteSpec]);

  const flushNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      setIsPending(false);
      void updateRef.current(pending);
    }
  }, []);

  const debouncedUpdate = useCallback(
    (partial: Partial<SiteSpec>) => {
      // Merge with any pending updates
      pendingRef.current = { ...pendingRef.current, ...partial };
      setIsPending(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingRef.current) {
          const pending = pendingRef.current;
          pendingRef.current = null;
          setIsPending(false);
          void updateRef.current(pending);
        }
      }, delay);
    },
    [delay],
  );

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (pendingRef.current) {
        void updateRef.current(pendingRef.current);
      }
    };
  }, []);

  return { debouncedUpdate, flushNow, isPending };
}
