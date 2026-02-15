import { useState, useEffect, useCallback } from "react";
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

type UseAuthReturn = AuthState & AuthActions;

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

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const userProfile = await fetchProfile(currentSession.user.id);
        if (!mounted) return;
        setProfile(userProfile);
        setRole(userProfile?.role ?? null);
      }

      setLoading(false);
    }

    void getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const userProfile = await fetchProfile(newSession.user.id);
        if (!mounted) return;
        setProfile(userProfile);
        setRole(userProfile?.role ?? null);
      } else {
        setProfile(null);
        setRole(null);
      }

      setLoading(false);
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
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        // SEC-004: Return a generic error message instead of leaking Supabase error details.
        return { error: "Unable to send magic link. Please try again." };
      }

      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  }, []);

  return {
    user,
    session,
    profile,
    role,
    loading,
    signInWithMagicLink,
    signOut,
  };
}
