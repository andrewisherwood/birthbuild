import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { StudentOverview } from "@/types/database";
import type { SiteSpec } from "@/types/site-spec";

interface UseStudentsReturn {
  students: StudentOverview[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
}

/** Required fields used to calculate spec completion percentage. */
const REQUIRED_FIELDS: Array<keyof SiteSpec> = [
  "business_name",
  "doula_name",
  "service_area",
  "email",
  "bio",
  "tagline",
];

function calculateCompletion(spec: Record<string, unknown>): number {
  let filled = 0;
  for (const field of REQUIRED_FIELDS) {
    const value = spec[field];
    if (value !== null && value !== undefined && value !== "") {
      filled += 1;
    }
  }

  // Also check services array has at least one entry
  const services = spec.services as unknown[] | null;
  const totalFields = REQUIRED_FIELDS.length + 1;
  if (Array.isArray(services) && services.length > 0) {
    filled += 1;
  }

  return Math.round((filled / totalFields) * 100);
}

export function useStudents(sessionId?: string): UseStudentsReturn {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build the profiles query
      let profilesQuery = supabase
        .from("profiles")
        .select("id, email, display_name, session_id")
        .eq("tenant_id", tenantId)
        .eq("role", "student")
        .order("created_at", { ascending: false });

      if (sessionId) {
        profilesQuery = profilesQuery.eq("session_id", sessionId);
      }

      const { data: profileData, error: profileError } = await profilesQuery;

      if (profileError) {
        setError("Failed to load students. Please try again.");
        return;
      }

      const profileRows = (profileData ?? []) as Array<{
        id: string;
        email: string;
        display_name: string | null;
        session_id: string | null;
      }>;

      if (profileRows.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch site specs for these students
      const studentIds = profileRows.map((p) => p.id);
      const { data: specData } = await supabase
        .from("site_specs")
        .select(
          "id, user_id, status, business_name, doula_name, deploy_url, preview_url, service_area, email, bio, tagline, services",
        )
        .in("user_id", studentIds);

      // Build a map: user_id -> spec
      const specMap = new Map<string, Record<string, unknown>>();
      if (specData) {
        for (const spec of specData as Array<Record<string, unknown>>) {
          specMap.set(spec.user_id as string, spec);
        }
      }

      const results: StudentOverview[] = profileRows.map((p) => {
        const spec = specMap.get(p.id);
        return {
          id: p.id,
          email: p.email,
          display_name: p.display_name,
          session_id: p.session_id,
          site_spec: spec
            ? {
                id: spec.id as string,
                status: spec.status as StudentOverview["site_spec"] extends null
                  ? never
                  : NonNullable<StudentOverview["site_spec"]>["status"],
                business_name: (spec.business_name as string | null) ?? null,
                doula_name: (spec.doula_name as string | null) ?? null,
                deploy_url: (spec.deploy_url as string | null) ?? null,
                preview_url: (spec.preview_url as string | null) ?? null,
                completion_percent: calculateCompletion(spec),
              }
            : null,
        };
      });

      setStudents(results);
    } catch {
      setError("Failed to load students. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, sessionId]);

  const deleteStudent = useCallback(
    async (studentId: string) => {
      setError(null);

      // Delete site_specs belonging to this student
      await supabase.from("site_specs").delete().eq("user_id", studentId);

      // Delete the profile (detaches from tenant/session)
      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", studentId);

      if (deleteError) {
        setError("Failed to remove student. Please try again.");
        return;
      }

      // Optimistic removal from local state
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    },
    [],
  );

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  return {
    students,
    loading,
    error,
    refetch: fetchStudents,
    deleteStudent,
  };
}
