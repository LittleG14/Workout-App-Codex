import { supabase } from "./supabase";
import { assertAccountScope, type AccountScope } from "./account-scope";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

/**
 * Returns the current Supabase session access token,
 * or null if not signed in. Used by workout-storage for API calls.
 */
export async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function getTokenForAccount(scope: AccountScope): Promise<string> {
  assertAccountScope(scope);
  const { data: { session }, error } = await supabase.auth.getSession();
  assertAccountScope(scope);
  if (error || session?.user.id !== scope.userId || !session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return session.access_token;
}

/**
 * Signs out from Supabase, clearing the session.
 * Called by AuthContext.logout().
 */
export async function clearAllAuth(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
