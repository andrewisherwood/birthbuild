import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Session } from "@/types/database";
import type { SessionWithCounts } from "@/types/database";

interface UseSessionsReturn {
  sessions: SessionWithCounts[];
  loading: boolean;
  error: string | null;
  createSession: (name: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
}

export function useSessions(): UseSessionsReturn {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<SessionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch sessions
    const { data: sessionData, error: fetchError } = await supabase
      .from("sessions")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("Failed to load sessions. Please try again.");
      setLoading(false);
      return;
    }

    const rawSessions = (sessionData ?? []) as Session[];

    // Fetch student counts per session
    const { data: profiles } = await supabase
      .from("profiles")
      .select("session_id")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "student");

    // Fetch live site counts per session
    const { data: siteSpecs } = await supabase
      .from("site_specs")
      .select("session_id, status")
      .eq("tenant_id", profile.tenant_id);

    const studentCountMap = new Map<string, number>();
    const liveCountMap = new Map<string, number>();

    if (profiles) {
      for (const p of profiles) {
        if (p.session_id) {
          studentCountMap.set(
            p.session_id,
            (studentCountMap.get(p.session_id) ?? 0) + 1,
          );
        }
      }
    }

    if (siteSpecs) {
      for (const spec of siteSpecs as Array<{ session_id: string | null; status: string }>) {
        if (spec.session_id && spec.status === "live") {
          liveCountMap.set(
            spec.session_id,
            (liveCountMap.get(spec.session_id) ?? 0) + 1,
          );
        }
      }
    }

    const sessionsWithCounts: SessionWithCounts[] = rawSessions.map((s) => ({
      ...s,
      student_count: studentCountMap.get(s.id) ?? 0,
      live_site_count: liveCountMap.get(s.id) ?? 0,
    }));

    setSessions(sessionsWithCounts);
    setLoading(false);
  }, [profile?.tenant_id]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (name: string) => {
      if (!profile?.tenant_id) {
        setError("No tenant found. Please contact your administrator.");
        return;
      }

      setError(null);

      const { data, error: createError } = await supabase
        .from("sessions")
        .insert({
          tenant_id: profile.tenant_id,
          name,
          status: "active",
        })
        .select()
        .single();

      if (createError) {
        setError("Failed to create session. Please try again.");
        return;
      }

      const newSession: SessionWithCounts = {
        ...(data as Session),
        student_count: 0,
        live_site_count: 0,
      };

      setSessions((prev) => [newSession, ...prev]);
    },
    [profile?.tenant_id],
  );

  const archiveSession = useCallback(
    async (id: string) => {
      setError(null);

      const { error: updateError } = await supabase
        .from("sessions")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updateError) {
        setError("Failed to archive session. Please try again.");
        return;
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "archived" } : s)),
      );
    },
    [],
  );

  return {
    sessions,
    loading,
    error,
    createSession,
    archiveSession,
  };
}
