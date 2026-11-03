import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStorageKey, assertAccountScope, getAccountScope, setAccountScope } from '../lib/account-scope';

test('scopes reject old work after account switch and logout/relogin', () => {
  setAccountScope('A'); const a = getAccountScope();
  assert.equal(setAccountScope('A'), false); assertAccountScope(a);
  setAccountScope('B'); const b = getAccountScope();
  assert.notEqual(accountStorageKey(a, 'workouts'), accountStorageKey(b, 'workouts'));
  assert.throws(() => assertAccountScope(a), /account changed/);
  setAccountScope(null); assert.throws(getAccountScope, /sign in/);
  setAccountScope('A'); assert.throws(() => assertAccountScope(a), /account changed/);
  setAccountScope(null);
});
