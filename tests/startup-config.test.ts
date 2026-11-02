import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startupDeadline } from '../lib/startup';
import { clientConfigErrors } from '../lib/client-config';
import { validate } from '../scripts/validate-release-config.cjs';

test('startup timeout/error is recoverable by a fresh attempt; late completion does not change rejection', async () => {
  let release!: (value: string) => void;
  const slow = new Promise<string>(resolve => { release = resolve; });
  await assert.rejects(startupDeadline(slow, 5), /too long/); release('late');
  await assert.rejects(startupDeadline(Promise.reject(new Error('storage failed')), 20), /storage failed/);
  assert.equal(await startupDeadline(Promise.resolve('retried'), 20), 'retried');
});
test('missing/malformed configuration is reported without returning credential values', () => {
  assert.equal(clientConfigErrors({}).length, 3);
  const errors = clientConfigErrors({ apiHost: 'localhost', supabaseUrl: 'http://project.test', supabaseKey: 'sb_secret_do_not_print' });
  assert.equal(errors.length, 3); assert.ok(!JSON.stringify(errors).includes('do_not_print'));
});
test('release preflight accepts public fields and rejects missing project or privileged JWT', () => {
  const env = { EXPO_PUBLIC_DOMAIN: 'api.swole.test', EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_public', EAS_PROJECT_ID: '12345678-1234-1234-1234-123456789abc' };
  const config = { ios: { bundleIdentifier: 'com.forge.app' } };
  assert.deepEqual(validate(env, config), []);
  assert.ok(validate({ ...env, EAS_PROJECT_ID: '' }, config).length > 0);
  const secretJwt = 'eyJ.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.signature';
  assert.ok(validate({ ...env, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretJwt }, config).some((s: string) => s.includes('privileged')));
});
test('testing and production profiles select explicit environments and valid square opaque icon', () => {
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(eas.build.testflight.environment, 'preview'); assert.equal(eas.build.testflight.distribution, 'store');
  assert.equal(eas.build.production.environment, 'production'); assert.equal(eas.build.simulator.ios.simulator, true);
  assert.equal(eas.build.base.ios.image, 'sdk-54');
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  assert.equal(app.ios.bundleIdentifier, 'com.forge.app');
  const png = fs.readFileSync(app.ios.icon);
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20)); assert.ok(png.readUInt32BE(16) >= 1024);
  assert.equal(png[25], 2); // RGB, no alpha channel.
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    assert.notEqual(type, 'tRNS'); offset += length + 12;
  }
});
