/**
 * Placeholder Supabase database types.
 *
 * In production these will be auto-generated via:
 *   npx supabase gen types typescript --local > src/types/database.ts
 *
 * For now we define the table row types manually to match the migration schema.
 */

export interface Tenant {
  id: string;
  name: string;
  owner_id: string | null;
  plan: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// SEC-003: API keys stored in a separate owner-only table
export interface TenantSecret {
  tenant_id: string;
  claude_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: "student" | "instructor" | "admin";
  tenant_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  site_spec_id: string;
  storage_path: string;
  purpose: string | null;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface SessionWithCounts extends Session {
  student_count: number;
  live_site_count: number;
}

export interface StudentOverview {
  id: string;
  email: string;
  display_name: string | null;
  session_id: string | null;
  site_spec: {
    id: string;
    status: "draft" | "building" | "preview" | "live" | "error";
    business_name: string | null;
    doula_name: string | null;
    deploy_url: string | null;
    preview_url: string | null;
    completion_percent: number;
    density_score: number;
    density_level: string;
  } | null;
}
