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
import { setAccountScope, getAccountScope, assertAccountScope } from "@/lib/account-scope";
import { queryClient } from "@/lib/query-client";
import { clearPendingRun } from "@/lib/run-store";
import { settleRunAccount, pauseRunBeforeLogout, setRunOwner, pauseForegroundRun } from '@/lib/run-tracking';
import { getApiUrl } from "@/lib/api-url";
import { AppState, Platform } from 'react-native';
import { assertClientConfigured, clientConfigErrors, clientEnvironment } from '@/lib/client-config';
import { startupDeadline } from '@/lib/startup';
import { authRedirect } from '@/lib/auth-links';
import { createPasswordRecovery } from '@/lib/password-recovery';
import { assertPkceAvailable } from '@/lib/native-crypto';
import { withRequestTimeout } from '@/lib/request-timeout';

const recovery = createPasswordRecovery({
  exchangeCodeForSession: code => supabase.auth.exchangeCodeForSession(code),
  getSession: () => supabase.auth.getSession(),
  updatePassword: async (session, password) => {
    assertClientConfigured();
    const response = await withRequestTimeout(signal => fetch(new URL('/auth/v1/user', clientEnvironment.supabaseUrl!).toString(), {
      method: 'PUT', signal,
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: clientEnvironment.supabaseKey!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }));
    return { error: response.ok ? null : new Error('Password update rejected') };
  },
});
const redirectTo = () => authRedirect(Platform.OS === 'web' ? window.location.origin : undefined);

export type AuthUser = StoredUser;
function getAccountScopeOrNull(): string | null {
  try { return getAccountScope().userId; } catch { return null; }
}

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
  startupError: string | null;
  isPasswordRecovery: boolean;
  requestPasswordReset: (email: string) => Promise<void>;
  processAuthCallback: (code: string) => Promise<boolean>;
  resetPassword: (password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [isPasswordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const updateRefresh = (state: string) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else { void supabase.auth.stopAutoRefresh(); void pauseForegroundRun().catch(() => {}); }
    };
    updateRefresh(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateRefresh);
    return () => { subscription.remove(); void supabase.auth.stopAutoRefresh(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setRunOwner(session?.user.id ?? null);
        if (event === 'INITIAL_SESSION') setTimeout(() => { void settleRunAccount().catch(() => {}); }, 0);
        if (setAccountScope(session?.user.id ?? null)) {
          recovery.clear(); setPasswordRecovery(false);
          void queryClient.cancelQueries();
          queryClient.clear();
          clearPendingRun();
          // Defer secure-session reads outside Supabase's auth callback lock.
          setTimeout(() => { void settleRunAccount().catch(() => {}); }, 0);
        }
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
    void (async () => {
      try {
        assertClientConfigured();
        const { error } = await startupDeadline(supabase.auth.getSession());
        if (error) throw error;
        if (mounted) { setStartupError(null); setIsLoading(false); }
      } catch {
        if (mounted) {
          setStartupError(clientConfigErrors(clientEnvironment).length
            ? 'This app is missing valid service configuration. Please contact support for an updated app.'
            : 'We could not restore your session. Check your connection and try again. If this continues, your saved session may need attention.');
          setIsLoading(false);
        }
      }
    })();
    return () => { mounted = false; subscription.unsubscribe(); setAccountScope(null); };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    assertPkceAvailable();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address.');
    const { error } = await startupDeadline(supabase.auth.resetPasswordForEmail(normalized, { redirectTo: redirectTo() }), 30000, 'The email request timed out. Please try again.');
    if (error) throw new Error('Could not send the reset email. Please try again later.');
  }, []);
  const processAuthCallback = useCallback(async (code: string) => {
    const recovering = await startupDeadline(recovery.accept(code));
    const scope = getAccountScope();
    setPasswordRecovery(recovering && recovery.authorized(scope.userId));
    return recovering;
  }, []);
  const resetPassword = useCallback(async (password: string) => {
    const scope = getAccountScope();
    if (!recovery.authorized(scope.userId)) throw new Error('Request a new password reset email to continue.');
    await startupDeadline(recovery.update(password), 45000, 'The request timed out. Your password may have changed. Try signing in with your new password or request another reset email.'); assertAccountScope(scope);
    setPasswordRecovery(false);
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
      assertPkceAvailable();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim() }, emailRedirectTo: redirectTo() },
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
    try { await pauseRunBeforeLogout(); await clearAllAuth(); }
    finally { setRunOwner(getAccountScopeOrNull()); }
  }, []);

  const updateEmail = useCallback(async (newEmail: string) => {
    assertPkceAvailable();
    const { error } = await supabase.auth.updateUser({
      email: newEmail.trim().toLowerCase(),
    }, { emailRedirectTo: redirectTo() });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (!currentUser?.email) throw new Error("No authenticated user found.");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    });
    if (signInError) throw new Error("Current password is incorrect.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }, []);

  const deleteAccount = useCallback(async () => {
    const scope = getAccountScope();
    try {
      await pauseRunBeforeLogout();
      const { data: { session } } = await supabase.auth.getSession();
      assertAccountScope(scope);
      if (!session?.access_token) throw new Error("No active session.");
      const res = await fetch(new URL('/api/account', getApiUrl()).toString(), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      assertAccountScope(scope);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || "Failed to delete account.");
      }
      await clearAllAuth();
    } finally { setRunOwner(getAccountScopeOrNull()); }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, startupError, isPasswordRecovery, requestPasswordReset, processAuthCallback, resetPassword, login, register, logout, updateEmail, updatePassword, deleteAccount }),
    [user, isLoading, startupError, isPasswordRecovery, requestPasswordReset, processAuthCallback, resetPassword, login, register, logout, updateEmail, updatePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
