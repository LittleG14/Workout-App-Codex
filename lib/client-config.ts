export interface ClientEnvironment { apiHost?: string; supabaseUrl?: string; supabaseKey?: string }
function isPublicKey(key?: string): boolean {
  if (key?.startsWith('sb_publishable_')) return true;
  if (!key?.startsWith('eyJ') || key.length > 16384) return false;
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role === 'anon';
  } catch { return false; }
}
export function clientConfigErrors(env: ClientEnvironment): string[] {
  const errors: string[] = [];
  try {
    const url = new URL(env.supabaseUrl ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
  } catch { errors.push('Supabase HTTPS project URL'); }
  if (!isPublicKey(env.supabaseKey)) errors.push('Supabase public client key');
  try {
    const host = env.apiHost?.trim();
    if (!host || /[\s/?#@]/.test(host) || host.includes('://')) throw new Error();
    const url = new URL(`https://${host}`);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
  } catch { errors.push('public HTTPS API hostname'); }
  return errors;
}
export const clientEnvironment: ClientEnvironment = {
  apiHost: process.env.EXPO_PUBLIC_DOMAIN,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
export function assertClientConfigured() {
  if (clientConfigErrors(clientEnvironment).length) throw new Error('This app is missing valid service configuration. Please contact support for an updated app.');
}
