import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthCallback, captureAuthCallback, pendingAuthCallback, clearAuthCallback, authRedirect } from '../lib/auth-links';

test('auth callbacks accept only the exact native or explicitly allowed web endpoint', () => {
  assert.deepEqual(parseAuthCallback('swolehouse://auth/callback?code=valid-code-123'), { code: 'valid-code-123' });
  assert.deepEqual(parseAuthCallback('/auth/callback?code=valid-code-123'), { code: 'valid-code-123' });
  assert.deepEqual(parseAuthCallback('https://app.test/auth/callback?code=valid-code-123', 'https://app.test'), { code: 'valid-code-123' });
  assert.deepEqual(parseAuthCallback('http://localhost:8081/auth/callback?code=valid-code-123', 'http://localhost:8081'), { code: 'valid-code-123' });
  for (const url of ['https://evil.test/auth/callback?code=valid-code-123', 'swolehouse://auth/callback/extra?code=valid-code-123',
    'swolehouse://auth/profile?code=valid-code-123', 'swolehouse://user@auth/callback?code=valid-code-123',
    'swolehouse://auth/callback#access_token=secret', 'swolehouse://auth/callback?code=' + 'x'.repeat(5000)]) {
    assert.equal(parseAuthCallback(url, 'https://app.test'), null);
  }
});
test('callback errors and duplicate codes cannot create an authenticated intent', () => {
  assert.deepEqual(parseAuthCallback('swolehouse://auth/callback?code=abcdefgh&code=ijklmnop'), { error: true });
  assert.deepEqual(parseAuthCallback('swolehouse://auth/callback?error=access_denied&error_description=untrusted'), { error: true });
  assert.deepEqual(parseAuthCallback('swolehouse://auth/callback?access_token=secret'), { error: true });
  assert.equal(captureAuthCallback('swolehouse://auth/callback?code=valid-code-123'), true);
  assert.deepEqual(pendingAuthCallback(), { code: 'valid-code-123' }); clearAuthCallback(); assert.equal(pendingAuthCallback(), null);
});
test('redirects do not use transient Replit/Expo Go hosts', () => {
  assert.equal(authRedirect(), 'swolehouse://auth/callback');
  assert.equal(authRedirect('https://app.test'), 'https://app.test/auth/callback');
  assert.throws(() => authRedirect('http://insecure.test'), /secure/);
});
