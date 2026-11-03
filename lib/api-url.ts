export function getApiUrl(): string {
  const host = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!host || /[\s/?#@]/.test(host) || host.includes('://')) {
    throw new Error('The app server is not configured. Please contact support.');
  }
  const url = new URL(`https://${host}`);
  if (!__DEV__ && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    throw new Error('The production server must use a public HTTPS address.');
  }
  return url.href;
}
