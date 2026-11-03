// Read-only EAS preflight. Does not create projects, credentials or native files.
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
function validate(env, config) {
  const errors = [];
  const host = env.EXPO_PUBLIC_DOMAIN;
  try {
    if (!host || /[\s/?#@]/.test(host) || host.includes('://')) throw new Error();
    const url = new URL(`https://${host}`);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || /\.(invalid|example)$/.test(url.hostname)) throw new Error();
  } catch { errors.push('Set EXPO_PUBLIC_DOMAIN to the intended public API hostname.'); }
  try {
    const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || /placeholder|\.invalid$/.test(url.hostname)) throw new Error();
  } catch { errors.push('Set EXPO_PUBLIC_SUPABASE_URL to the intended HTTPS Supabase project.'); }
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  let publicKey = key.startsWith('sb_publishable_') && !/placeholder/i.test(key);
  if (key.startsWith('eyJ')) {
    try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { publicKey = false; }
  }
  if (!publicKey) errors.push('Set a public Supabase publishable/anon key; never a privileged key.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.EAS_PROJECT_ID ?? '')) errors.push('Set EAS_PROJECT_ID to the linked Expo project UUID.');
  if (config.ios?.bundleIdentifier !== 'com.forge.app') errors.push('The approved iOS bundle identifier must remain com.forge.app.');
  return errors;
}
module.exports = { validate };
if (require.main === module) {
  const errors = validate(process.env, JSON.parse(fs.readFileSync('app.json', 'utf8')).expo);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Release configuration has the required public fields. Ownership, service reachability and signing still require verification.');
}
