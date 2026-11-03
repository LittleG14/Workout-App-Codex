import test from 'node:test';
import assert from 'node:assert/strict';
import { withRequestTimeout } from '../lib/request-timeout';

const waitForAbort = (signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
  if (signal.aborted) reject(new Error('aborted'));
  else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
});
test('requests time out without relying on AbortSignal static methods', async () => {
  await assert.rejects(withRequestTimeout(waitForAbort, undefined, 5), /aborted/);
});
test('query cancellation propagates and already cancelled queries never proceed', async () => {
  const controller = new AbortController();
  const task = withRequestTimeout(waitForAbort, controller.signal); controller.abort();
  await assert.rejects(task, /aborted/);
  await assert.rejects(withRequestTimeout(waitForAbort, controller.signal), /aborted/);
});
test('successful requests return without leaving timeout work', async () => {
  assert.equal(await withRequestTimeout(async () => 'ok'), 'ok');
});
