import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseMissing = !supabaseUrl || !supabaseAnonKey;

// Create client only when env vars are present; otherwise export a
// placeholder that will never be used (the UI shows a config error screen).
export const supabase: SupabaseClient = supabaseMissing
  ? (null as unknown as SupabaseClient)
  : createClient(supabaseUrl as string, supabaseAnonKey as string);
