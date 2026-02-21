import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

type UserRole = Profile["role"] | null;

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  loading: boolean;
}

interface AuthActions {
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    // Profile may not exist yet (first-time user before profile creation).
    // SEC-004: Do not log Supabase error details to the console.
    return null;
  }

  return data as Profile;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Hard backstop: if loading hasn't resolved within 3 seconds (for any
  // reason — hung getSession, lock contention, unexpected error), force it
  // off so the UI is never stuck on a spinner.
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setLoading(false), 3_000);
    return () => clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    let mounted = true;
    let profileRequestVersion = 0;

    const loadProfile = async (nextSession: Session, requestVersion: number) => {
      try {
        const nextProfile = await fetchProfile(nextSession.user.id);
        if (!mounted || requestVersion !== profileRequestVersion) return;
        setProfile(nextProfile);
        setRole(nextProfile?.role ?? null);
      } catch {
        if (!mounted || requestVersion !== profileRequestVersion) return;
        setProfile(null);
        setRole(null);
      } finally {
        if (mounted && requestVersion === profileRequestVersion) {
          setLoading(false);
        }
      }
    };

    // Use onAuthStateChange as the sole session source.
    // INITIAL_SESSION fires after the client has fully initialised
    // (including hash-token processing for magic-link redirects).
    // This avoids a redundant getSession() call that can race with
    // onAuthStateChange's own internal session initialisation.
    //
    // IMPORTANT: keep this callback synchronous. Supabase auth invokes it
    // under an internal lock; awaiting SDK calls here can deadlock.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !newSession?.user) {
        profileRequestVersion += 1;
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      // INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, etc.
      profileRequestVersion += 1;
      const requestVersion = profileRequestVersion;
      setSession(newSession);
      setUser(newSession.user);
      setLoading(true);

      // Defer profile read until after the auth callback returns, otherwise
      // the nested SDK query can contend on Supabase auth's internal lock.
      setTimeout(() => {
        if (!mounted) return;
        void loadProfile(newSession, requestVersion);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(
    async (email: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "/app",
        },
      });

      if (error) {
        // SEC-004: Return safe error messages — never leak raw Supabase error details.
        if (error.status === 429 || error.message?.includes("rate")) {
          return { error: "rate_limit" };
        }
        return { error: "Unable to send magic link. Please try again." };
      }

      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Always clear client state, even if the server call fails or hangs.
    // A failed signOut must never leave the user in a ghost session
    // where the server session is cleared but the UI still shows as
    // authenticated (causing RLS to block every subsequent query).
    // The 5s timeout guards against a stalled network request.
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Sign-out timed out")), 5000),
        ),
      ]);
    } catch {
      // Server call failed or timed out — clear local state anyway.
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role,
      loading,
      signInWithMagicLink,
      signOut,
    }),
    [user, session, profile, role, loading, signInWithMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
