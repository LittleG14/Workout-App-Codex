import { supabase } from "./supabase";

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

/**
 * Signs out from Supabase, clearing the session.
 * Called by AuthContext.logout().
 */
export async function clearAllAuth(): Promise<void> {
  await supabase.auth.signOut();
}
