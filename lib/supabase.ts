import './native-crypto';
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createSecureSessionStorage } from "./secure-session-storage";
import { assertClientConfigured, clientConfigErrors, clientEnvironment } from './client-config';
import { withRequestTimeout } from './request-timeout';

// Invalid build configuration must reach the recoverable startup screen, not throw
// while modules are loading (before React's error boundary exists).
const configured = clientConfigErrors(clientEnvironment).length === 0;
const SUPABASE_URL = configured ? clientEnvironment.supabaseUrl! : 'https://unconfigured.invalid';
const SUPABASE_ANON_KEY = configured ? clientEnvironment.supabaseKey! : 'unconfigured';

// Background location may need the persisted owner while the phone is locked.
// Device-only Keychain access after first unlock supports that without moving
// session credentials into AsyncStorage or making them migrate to another device.
const keychainOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const nativeStorage = createSecureSessionStorage({
  getItemAsync: key => SecureStore.getItemAsync(key, keychainOptions),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, keychainOptions),
  deleteItemAsync: key => SecureStore.deleteItemAsync(key, keychainOptions),
});
const ExpoSecureStoreAdapter = Platform.OS === "web" ? {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => { localStorage.setItem(key, value); },
  removeItem: async (key: string) => { localStorage.removeItem(key); },
} : nativeStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: (input, init) => {
    assertClientConfigured();
    return withRequestTimeout(signal => fetch(input, { ...init, signal }), init?.signal ?? undefined);
  } },
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
