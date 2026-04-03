import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "ironforge_auth_token";
const USER_KEY = "ironforge_auth_user";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return secureGet(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  return secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  return secureDelete(TOKEN_KEY);
}

export async function getCachedUser(): Promise<StoredUser | null> {
  const raw = await secureGet(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredUser; } catch { return null; }
}

export async function setCachedUser(user: StoredUser): Promise<void> {
  return secureSet(USER_KEY, JSON.stringify(user));
}

export async function clearCachedUser(): Promise<void> {
  return secureDelete(USER_KEY);
}

export async function clearAllAuth(): Promise<void> {
  await Promise.all([clearToken(), clearCachedUser()]);
}
