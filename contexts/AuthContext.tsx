import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useCallback,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearAllAuth, type StoredUser } from "@/lib/auth-storage";
import { syncLocalWorkoutsToServer } from "@/lib/workout-storage";

export type AuthUser = StoredUser;

function toAuthUser(u: SupabaseUser): AuthUser {
  return {
    id: u.id,
    email: u.email ?? "",
    name:
      u.user_metadata?.name ??
      u.email?.split("@")[0] ??
      "User",
    avatarUrl: u.user_metadata?.avatar_url ?? null,
    createdAt: u.created_at,
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(toAuthUser(session.user));
          if (event === "SIGNED_IN") {
            syncLocalWorkoutsToServer().catch(() => {});
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error(
          "Account created! Please check your email to confirm your address before signing in."
        );
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await clearAllAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
