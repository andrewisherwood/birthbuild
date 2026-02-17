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
      {
        auth: {
          // In-memory queue-based mutex for auth operations.
          //
          // navigator.locks (the default) causes AbortError and processLock
          // timeouts with React 18 Strict Mode double-mounting.
          //
          // A no-op lock (previous approach) allows concurrent token refreshes
          // that corrupt the auth module's internal state, causing subsequent
          // SDK calls (queries, invoke) to hang indefinitely — the HTTP
          // request is never sent.
          //
          // This mutex serializes auth operations (token refresh, session
          // retrieval) as the SDK expects, without cross-tab lock issues.
          lock: (() => {
            let chain: Promise<void> = Promise.resolve();
            return async <R>(
              _name: string,
              _acquireTimeout: number,
              fn: () => Promise<R>,
            ): Promise<R> => {
              let release!: () => void;
              const gate = new Promise<void>((r) => {
                release = r;
              });
              const previous = chain;
              chain = gate;
              await previous;
              try {
                return await fn();
              } finally {
                release();
              }
            };
          })(),
        },
      },
    ));
