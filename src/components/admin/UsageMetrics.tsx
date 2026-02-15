import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";

interface UsageMetricsProps {
  tenantId: string;
}

interface MetricData {
  totalStudents: number;
  totalSessions: number;
  liveSites: number;
  draftSites: number;
}

interface MetricCardProps {
  label: string;
  value: number | null;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card className="text-center">
      {value === null ? (
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-12 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-500">{label}</p>
        </>
      )}
    </Card>
  );
}

export function UsageMetrics({ tenantId }: UsageMetricsProps) {
  const [metrics, setMetrics] = useState<MetricData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMetrics() {
      // Fetch all counts in parallel
      const [studentsResult, sessionsResult, liveResult, draftResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("role", "student"),
          supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabase
            .from("site_specs")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("status", "live"),
          supabase
            .from("site_specs")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("status", "draft"),
        ]);

      if (!mounted) return;

      setMetrics({
        totalStudents: studentsResult.count ?? 0,
        totalSessions: sessionsResult.count ?? 0,
        liveSites: liveResult.count ?? 0,
        draftSites: draftResult.count ?? 0,
      });
    }

    void fetchMetrics();

    return () => {
      mounted = false;
    };
  }, [tenantId]);

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <MetricCard
        label="Students"
        value={metrics?.totalStudents ?? null}
      />
      <MetricCard
        label="Sessions"
        value={metrics?.totalSessions ?? null}
      />
      <MetricCard
        label="Live Sites"
        value={metrics?.liveSites ?? null}
      />
      <MetricCard
        label="Draft Sites"
        value={metrics?.draftSites ?? null}
      />
    </div>
  );
}
