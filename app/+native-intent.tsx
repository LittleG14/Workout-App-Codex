import { captureAuthCallback } from '@/lib/auth-links';
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return captureAuthCallback(path) ? '/auth/callback' : '/';
}
