import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecureSessionStorage } from '../lib/secure-session-storage';

function fixture() {
  const data = new Map<string, string>();
  let failWrite: ((key: string, value: string) => boolean) | undefined;
  let failDelete = false;
  const adapter = createSecureSessionStorage({
    getItemAsync: async key => data.get(key) ?? null,
    setItemAsync: async (key, value) => { if (failWrite?.(key, value)) throw new Error('write failed'); data.set(key, value); },
    deleteItemAsync: async key => { if (failDelete) throw new Error('delete failed'); data.delete(key); },
  });
  return { data, adapter, failWrites: (fn?: typeof failWrite) => { failWrite = fn; }, failDeletes: (v: boolean) => { failDelete = v; } };
}

test('PKCE verifier survives adapter recreation and is removed after use', async () => {
  const f = fixture(); const key = 'sb-project-auth-token-code-verifier';
  const verifier = 'test-verifier/PASSWORD_RECOVERY';
  await f.adapter.setItem(key, verifier);
  const restarted = createSecureSessionStorage({
    getItemAsync: async name => f.data.get(name) ?? null,
    setItemAsync: async (name, value) => { f.data.set(name, value); },
    deleteItemAsync: async name => { f.data.delete(name); },
  });
  assert.equal(await restarted.getItem(key), verifier);
  await restarted.removeItem(key); assert.equal(await f.adapter.getItem(key), null);
});

test('session size changes and logout remove all live and legacy representations', async () => {
  const f = fixture();
  f.data.set('session', 'legacy'); f.data.set('session_0', 'orphan');
  await f.adapter.setItem('session', 'x'.repeat(3600));
  await f.adapter.setItem('session', 'short');
  assert.equal(await f.adapter.getItem('session'), 'short');
  await f.adapter.setItem('session', 'y'.repeat(5400));
  await f.adapter.removeItem('session');
  assert.equal(await f.adapter.getItem('session'), null);
  assert.deepEqual([...f.data.keys()], ['session_v2']);
});
test('failed chunk write preserves the committed session', async () => {
  const f = fixture(); await f.adapter.setItem('s', 'original');
  f.failWrites((key, value) => key.endsWith('_1') && value.startsWith('z'));
  await assert.rejects(f.adapter.setItem('s', 'z'.repeat(4000)), /write failed/);
  assert.equal(await f.adapter.getItem('s'), 'original');
});
test('interrupted logout is unreadable and cleanup is retryable', async () => {
  const f = fixture(); await f.adapter.setItem('s', 'token');
  f.failDeletes(true); await assert.rejects(f.adapter.removeItem('s'));
  assert.equal(await f.adapter.getItem('s'), null);
  f.failDeletes(false); await f.adapter.removeItem('s');
  assert.deepEqual([...f.data.keys()], ['s_v2']);
});
test('Unicode chunks obey byte limits without splitting characters', async () => {
  const f = fixture(); const value = '💪é'.repeat(1200);
  await f.adapter.setItem('s', value);
  assert.equal(await f.adapter.getItem('s'), value);
  for (const [key, part] of f.data) if (key !== 's_v2') assert.ok(Buffer.byteLength(part) <= 1800);
});
test('malformed and missing chunks fail explicitly; legacy sessions remain readable', async () => {
  const f = fixture(); f.data.set('s_count', '2'); f.data.set('s_0', 'one');
  await assert.rejects(f.adapter.getItem('s'), /incomplete/);
  f.data.set('s_1', 'two'); assert.equal(await f.adapter.getItem('s'), 'onetwo');
  f.data.set('s_count', '-1'); await assert.rejects(f.adapter.getItem('s'), /invalid/);
});
test('concurrent operations on one session are serialized', async () => {
  const f = fixture();
  await Promise.all([f.adapter.setItem('s', 'one'), f.adapter.setItem('s', 'two'), f.adapter.removeItem('s')]);
  assert.equal(await f.adapter.getItem('s'), null);
});
