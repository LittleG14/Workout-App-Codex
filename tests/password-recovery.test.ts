import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordRecovery } from '../lib/password-recovery';

function fixture() {
  let now = 1700000000000, owner = 'A', kind = 'PASSWORD_RECOVERY', fail = false;
  let exchanges = 0, updates = 0;
  const flow = createPasswordRecovery({
    exchangeCodeForSession: async () => { exchanges++; return { data: { session: { user: { id: 'A' }, expires_at: (now + 3600000) / 1000, access_token: 'test-A' }, redirectType: kind }, error: null }; },
    getSession: async () => ({ data: { session: { user: { id: owner }, expires_at: (now + 3600000) / 1000, access_token: `test-${owner}` } } }),
    updatePassword: async (session) => { assert.equal(session.user.id, 'A'); assert.equal(session.access_token, 'test-A'); updates++; return { error: fail ? new Error('offline') : null }; },
  }, () => now);
  return { flow, user: (id: string) => { owner = id; }, kind: (value: string) => { kind = value; },
    advance: () => { now += 11 * 60000; }, fail: (value: boolean) => { fail = value; }, exchanges: () => exchanges, updates: () => updates };
}
test('only verified recovery redirect type permits a password reset', async () => {
  const f = fixture(); f.kind('signup'); assert.equal(await f.flow.accept('signup-code'), false);
  assert.equal(f.flow.authorized('A'), false); await assert.rejects(f.flow.update('long-password'), /expired/);
  assert.equal(f.updates(), 0);
});
test('duplicate callback mounts exchange a one-time code only once', async () => {
  const f = fixture(); assert.deepEqual(await Promise.all([f.flow.accept('one-code'), f.flow.accept('one-code')]), [true, true]);
  assert.equal(f.exchanges(), 1); assert.equal(f.flow.authorized('A'), true);
});
test('account changes, expiry and clearing prevent recovery updates', async () => {
  const f = fixture(); await f.flow.accept('one'); f.user('B');
  await assert.rejects(f.flow.update('long-password'), /account changed/); assert.equal(f.updates(), 0);
  f.user('A'); f.advance(); await assert.rejects(f.flow.update('long-password'), /expired/);
  await f.flow.accept('two'); f.flow.clear(); await assert.rejects(f.flow.update('long-password'), /expired/);
});
test('successful reset consumes authority and replaying the link cannot grant it again', async () => {
  const f = fixture(); await f.flow.accept('one');
  await assert.rejects(f.flow.update('short'), /8 characters/); assert.equal(f.updates(), 0);
  await f.flow.update('long-password'); assert.equal(f.updates(), 1); assert.equal(f.flow.authorized('A'), false);
  await f.flow.accept('one'); assert.equal(f.flow.authorized('A'), false);
  await assert.rejects(f.flow.update('long-password'), /expired/); assert.equal(f.updates(), 1);
});
test('backend password failure preserves a verified grant for a safe retry', async () => {
  const f = fixture(); await f.flow.accept('one'); f.fail(true);
  await assert.rejects(f.flow.update('long-password'), /could not be updated/); assert.equal(f.flow.authorized('A'), true);
  f.fail(false); await f.flow.update('long-password'); assert.equal(f.flow.authorized('A'), false);
});

test('failed/expired code exchange never creates recovery authority', async () => {
  const flow = createPasswordRecovery({
    exchangeCodeForSession: async () => ({ data: { session: null, redirectType: 'PASSWORD_RECOVERY' }, error: new Error('expired') }),
    getSession: async () => ({ data: { session: null } }),
    updatePassword: async () => { throw new Error('must not run'); },
  });
  await assert.rejects(flow.accept('expired-code'), /invalid or expired/); assert.equal(flow.authorized('A'), false);
});
