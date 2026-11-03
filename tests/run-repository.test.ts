import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunRepository, elapsedRunSeconds, runData, type RunDraft } from '../lib/run-repository';

function fixture() {
  const data = new Map<string, string>(); let owner: string | null = 'A'; let now = 100000;
  let nextId = 0, tracking = false, failStart = false, failWrite = false;
  const storage = { getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (failWrite) throw new Error('disk full'); data.set(key, value); },
    removeItem: async (key: string) => { data.delete(key); } };
  const deps = { storage, userId: async () => owner, now: () => now, id: () => `run-${++nextId}`,
    start: async (_mode: RunDraft['mode']) => { if (failStart) throw new Error('permission denied'); tracking = true; },
    stop: async () => { tracking = false; } };
  const repo = createRunRepository(deps);
  return { repo, data, restart: () => createRunRepository(deps), tracking: () => tracking,
    user: (id: string | null) => { owner = id; }, time: (value: number) => { now = value; },
    failStart: () => { failStart = true; }, failWrite: () => { failWrite = true; } };
}
const fix = (timestamp: number, latitude = 40, longitude = -74) => ({ timestamp, latitude, longitude, accuracy: 5 });

test('locked/suspended JS elapsed time derives from timestamps, not timer ticks', async () => {
  const f = fixture(); const run = await f.repo.begin('A', 'miles', 1, 'background');
  f.time(400000); const restored = await f.restart().get('A');
  assert.equal(restored?.id, run.id); assert.equal(restored?.userId, 'A');
  assert.equal(elapsedRunSeconds(restored!, 400000), 300); assert.equal(f.tracking(), true);
});
test('headless location batches preserve route and reject duplicate, stale and inaccurate fixes', async () => {
  const f = fixture(); await f.repo.begin('A', 'km', 1, 'background'); f.time(110000);
  const headless = f.restart();
  await headless.locations([fix(104000, 40.001), fix(102000), fix(102000), fix(99999), { ...fix(106000), accuracy: 500 }]);
  const run = await headless.get('A');
  assert.equal(run?.coordinates.length, 2); assert.ok(run!.distanceMeters > 110 && run!.distanceMeters < 112);
  await headless.locations([fix(104000, 40.001)]); assert.equal((await headless.get('A'))?.coordinates.length, 2);
});
test('pause excludes time and paused travel, including delayed fixes from an earlier segment', async () => {
  const f = fixture(); const run = await f.repo.begin('A', 'miles', 0, 'background');
  f.time(102000); await f.repo.locations([fix(101000)]);
  f.time(110500); await f.repo.pause('A', run.id); assert.equal(f.tracking(), false);
  f.time(120000); await f.repo.locations([fix(115000, 41)]);
  f.time(200000); await f.repo.resume('A', run.id);
  f.time(210000); await f.repo.locations([fix(150000, 42), fix(202000, 41), fix(204000, 41.001)]);
  const final = await f.repo.finish('A', run.id);
  assert.equal(elapsedRunSeconds(final, 900000), 20);
  assert.deepEqual(final.segmentStarts, [0, 1]); assert.equal(final.coordinates.length, 3);
  assert.ok(final.distanceMeters < 112); assert.equal(f.tracking(), false);
});

test('approximate GPS produces visible guidance and recovers when accurate fixes arrive', async () => {
  const f = fixture(); await f.repo.begin('A', 'km', 0, 'background'); f.time(110000);
  await f.repo.locations([{ ...fix(102000), accuracy: 1000 }]);
  assert.match((await f.repo.get('A'))!.error!, /accurate GPS/);
  await f.repo.locations([fix(104000)]); assert.equal((await f.repo.get('A'))!.error, undefined);
});
test('new account cannot read, finish, discard or upload the previous owner draft', async () => {
  const f = fixture(); const a = await f.repo.begin('A', 'miles', 1, 'background');
  f.user('B'); await f.repo.accountChanged('B');
  assert.equal(f.tracking(), false); assert.equal(await f.repo.get('B'), null);
  await assert.rejects(f.repo.get('A'), /account changed/);
  await assert.rejects(f.repo.finish('B', a.id), /no longer available/);
  const b = await f.repo.begin('B', 'km', 0, 'background'); f.time(110000);
  await f.repo.locations([fix(105000)], { userId: 'A', id: a.id });
  assert.equal((await f.repo.get('B'))?.coordinates.length, 0);
  assert.equal((await f.repo.get('B'))?.id, b.id);
  f.user('A'); await f.repo.accountChanged('A');
  assert.equal((await f.repo.get('A'))?.status, 'paused');
});
test('expired or absent secure session stops headless updates without assigning a new owner', async () => {
  const f = fixture(); await f.repo.begin('A', 'miles', 1, 'background');
  f.user(null); await f.restart().locations([fix(101000)]);
  assert.equal(f.tracking(), false);
  f.user('A'); assert.equal((await f.repo.get('A'))?.coordinates.length, 0);
});
test('OS interruption recovers conservatively through last recorded location', async () => {
  const f = fixture(); await f.repo.begin('A', 'miles', 0, 'background'); f.time(110000);
  await f.repo.locations([fix(105000)]); f.time(900000);
  const run = await f.restart().reconcile('A', false);
  assert.equal(run.status, 'paused'); assert.equal(elapsedRunSeconds(run, 900000), 5);
  assert.match(run.error!, /interrupted/);
});
test('finish is idempotent and stopped draft survives restart for a fixed-ID save retry', async () => {
  const f = fixture(); const run = await f.repo.begin('A', 'km', 1, 'background'); f.time(110000);
  const first = await f.repo.finish('A', run.id); f.time(120000);
  const second = await f.restart().finish('A', run.id);
  assert.deepEqual(second, first); assert.equal(runData(second, 200000).durationSeconds, 10);
  await assert.rejects(f.repo.begin('A', 'miles', 1, 'background'), /existing run/);
  await f.repo.discard('A', run.id); assert.equal(await f.repo.get('A'), null);
});
test('permission failure preserves a paused recoverable draft and stops GPS', async () => {
  const f = fixture(); f.failStart(); await assert.rejects(f.repo.begin('A', 'km', 0, 'background'), /permission denied/);
  const run = await f.repo.get('A'); assert.equal(run?.status, 'paused'); assert.equal(f.tracking(), false);
});
test('pause storage failure still stops native tracking and preserves prior draft', async () => {
  const f = fixture(); const run = await f.repo.begin('A', 'km', 0, 'background');
  f.failWrite(); await assert.rejects(f.repo.pause('A', run.id), /disk full/);
  assert.equal(f.tracking(), false); assert.ok(f.data.size > 0);
});
test('unbound native task is stopped, and corrupted drafts are not overwritten', async () => {
  const f = fixture(); await f.repo.locations([fix(101000)]); assert.equal(f.tracking(), false);
  const key = 'swolehouse:v1:A:run-draft'; f.data.set(key, '{invalid');
  await assert.rejects(f.repo.begin('A', 'miles', 0, 'background'), /preserved/); assert.equal(f.data.get(key), '{invalid');
});
