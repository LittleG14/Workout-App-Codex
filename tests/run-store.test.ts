import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPendingRun, consumePendingRun, setPendingRun } from '../lib/run-store';
import { getAccountScope, setAccountScope } from '../lib/account-scope';
import type { RunData } from '../lib/exercises';

test('run handoff and delayed stop confirmations cannot cross account boundaries', () => {
  const run = { coordinates: [{ latitude: 1, longitude: 2, timestamp: 0 }] } as RunData;
  setAccountScope('A'); const owner = getAccountScope(); setPendingRun(run, owner);
  assert.equal(consumePendingRun(), run);
  setPendingRun(run, owner); setAccountScope('B');
  assert.equal(consumePendingRun(), null);
  assert.throws(() => setPendingRun(run, owner), /account changed/);
  clearPendingRun(); setAccountScope(null);
});
