export const NATIVE_AUTH_REDIRECT = 'swolehouse://auth/callback';
export type AuthCallback = { code: string } | { error: true };
let pending: AuthCallback | null = null;

/** Only the exact callback may reach the router. Tokens/fragments are never accepted. */
export function parseAuthCallback(input: string, webOrigin?: string): AuthCallback | null {
  if (input.length > 4096) return null;
  try {
    const url = new URL(input, input.startsWith('/') ? 'swolehouse://local' : undefined);
    const native = url.protocol === 'swolehouse:' && url.hostname === 'auth' && url.pathname === '/callback';
    const relative = input.startsWith('/auth/callback') && url.pathname === '/auth/callback';
    const web = !!webOrigin && url.origin === webOrigin && url.pathname === '/auth/callback';
    if ((!native && !relative && !web) || url.username || url.password || (!web && url.port) || url.hash) return null;
    if (url.searchParams.has('error') || url.searchParams.has('error_code')) return { error: true };
    const codes = url.searchParams.getAll('code');
    if (codes.length !== 1 || !/^[a-zA-Z0-9_-]{8,2048}$/.test(codes[0])) return { error: true };
    return { code: codes[0] };
  } catch { return null; }
}
export function captureAuthCallback(input: string, webOrigin?: string): boolean {
  const callback = parseAuthCallback(input, webOrigin);
  if (!callback) return false;
  pending = callback; return true;
}
export const pendingAuthCallback = () => pending;
export function clearAuthCallback() { pending = null; }
export function authRedirect(webOrigin?: string): string {
  if (!webOrigin) return NATIVE_AUTH_REDIRECT;
  const url = new URL(webOrigin);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('A secure web origin is required.');
  return `${url.origin}/auth/callback`;
}
