import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useCallback,
} from "react";
import { getApiUrl } from "@/lib/query-client";
import {
  getToken,
  setToken,
  getCachedUser,
  setCachedUser,
  clearAllAuth,
  type StoredUser,
} from "@/lib/auth-storage";
import { syncLocalWorkoutsToServer } from "@/lib/workout-storage";

export type AuthUser = StoredUser;

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithProvider: (provider: "google" | "apple", tokenOrPayload: string | Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiFetch(path: string, options?: RequestInit) {
  const url = new URL(path, getApiUrl()).toString();
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUserAndToken = useCallback(async (newUser: AuthUser, token: string) => {
    await setToken(token);
    await setCachedUser(newUser);
    setUser(newUser);
    syncLocalWorkoutsToServer().catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await apiFetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const freshUser: AuthUser = data.user;
      await setCachedUser(freshUser);
      setUser(freshUser);
    } catch (err: any) {
      // If server says user doesn't exist (401), clear stale auth so
      // the user is prompted to create a new account.
      if (err?.message?.startsWith("401")) {
        await clearAllAuth();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const cached = await getCachedUser();
        if (cached) {
          setUser(cached);
          setIsLoading(false);
          refreshUser();
          return;
        }

        const token = await getToken();
        if (token) {
          const data = await apiFetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const freshUser: AuthUser = data.user;
          await setCachedUser(freshUser);
          setUser(freshUser);
        }
      } catch {
        await clearAllAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setUserAndToken(data.user, data.token);
  }, [setUserAndToken]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    await setUserAndToken(data.user, data.token);
  }, [setUserAndToken]);

  const loginWithProvider = useCallback(
    async (provider: "google" | "apple", tokenOrPayload: string | Record<string, any>) => {
      let endpoint = "";
      let body: Record<string, any> = {};
      if (provider === "google") {
        endpoint = "/api/auth/google";
        body = { accessToken: tokenOrPayload as string };
      } else {
        endpoint = "/api/auth/apple";
        body = tokenOrPayload as Record<string, any>;
      }
      const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await setUserAndToken(data.user, data.token);
    },
    [setUserAndToken]
  );

  const logout = useCallback(async () => {
    await clearAllAuth();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, loginWithProvider, logout, refreshUser }),
    [user, isLoading, login, register, loginWithProvider, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
