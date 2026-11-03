import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

// Supabase PKCE otherwise falls back to Math.random / a plain challenge on runtimes
// without WebCrypto. Supply native randomness + SHA-256 without replacing web APIs.
if (Platform.OS !== 'web') {
  const target = globalThis as unknown as { crypto?: {
    getRandomValues?: typeof ExpoCrypto.getRandomValues;
    subtle?: { digest?: (algorithm: string | { name: string }, data: BufferSource) => Promise<ArrayBuffer> };
  } };
  if (!target.crypto) Object.defineProperty(target, 'crypto', { value: {}, configurable: true });
  target.crypto!.getRandomValues ??= ExpoCrypto.getRandomValues;
  target.crypto!.subtle ??= {};
  target.crypto!.subtle.digest ??= (algorithm, data) => {
    if ((typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase() !== 'SHA-256') return Promise.reject(new Error('Unsupported digest algorithm'));
    return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
  };
}

export function assertPkceAvailable() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle?.digest || typeof TextEncoder === 'undefined') {
    throw new Error('Secure email links are unavailable in this app environment. Please use the installed native app or a secure browser.');
  }
}
