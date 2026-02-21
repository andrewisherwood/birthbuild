import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseMissing = !supabaseUrl || !supabaseAnonKey;

// Guard against Vite HMR re-evaluating this module and creating a second
// Supabase client.
declare global {
  interface Window {
    __birthbuild_supabase?: SupabaseClient;
  }
}

export const supabase: SupabaseClient = supabaseMissing
  ? (null as unknown as SupabaseClient)
  : (window.__birthbuild_supabase ??= createClient(
      supabaseUrl as string,
      supabaseAnonKey as string,
    ));
