import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Expo SecureStore has a 2048-byte limit per key on iOS.
// Supabase sessions can exceed this, so we chunk large values.
const CHUNK_SIZE = 1800;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const countStr = await SecureStore.getItemAsync(`${key}_count`);
  if (!countStr) return SecureStore.getItemAsync(key);
  const count = parseInt(countStr, 10);
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
    if (chunk === null) return null;
    chunks.push(chunk);
  }
  return chunks.join("");
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.deleteItemAsync(`${key}_count`);
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
  await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}_${i}`, c)));
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  const countStr = await SecureStore.getItemAsync(`${key}_count`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}_count`),
      ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}_${i}`)),
    ]);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

const ExpoSecureStoreAdapter = {
  getItem: secureGet,
  setItem: secureSet,
  removeItem: secureDelete,
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
