import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkoutRepository, type WorkoutRequest } from '../lib/workout-repository';
import { assertAccountScope, getAccountScope, setAccountScope } from '../lib/account-scope';
import type { GeneratedWorkout } from '../lib/exercises';

const workout = (id: string, name = id): GeneratedWorkout => ({ id, name, topCategory: 'cardio', subType: 'running',
  style: 'running', createdAt: '2026-01-01', durationMinutes: 30, exercises: [] });
function fixture() {
  const data = new Map<string, string>(); const server = new Map<string, GeneratedWorkout>();
  let offline = true;
  const calls: { user: string; method: string; id?: string }[] = [];
  const storage = { getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); }, removeItem: async (key: string) => { data.delete(key); } };
  const request: WorkoutRequest = async (scope, method, path, body) => {
    assertAccountScope(scope); if (offline) throw new Error('offline');
    const id = decodeURIComponent(path.split('/').pop()!);
    calls.push({ user: scope.userId, method, id: body?.id });
    if (method === 'GET') return { status: 200, workouts: [...server.values()] };
    if (method === 'PUT' && !server.has(id)) return { status: 404 };
    if (method === 'DELETE') server.delete(id); else if (body) server.set(body.id, body);
    return { status: 200 };
  };
  return { data, storage, server, request, calls, repo: createWorkoutRepository(storage, request), online: () => { offline = false; } };
}
test('legacy data is not uploaded or assigned to the next account', async () => {
  const f = fixture(); f.data.set('ironforge_workouts', JSON.stringify([workout('legacy-A')]));
  setAccountScope('B'); f.online(); await f.repo.syncLocalWorkoutsToServer();
  assert.equal(f.calls.length, 0); assert.ok(f.data.has('ironforge_workouts'));
  assert.deepEqual(await f.repo.getLocalWorkoutsOnly(), []);
});

test('new workouts are explicitly owner-tagged and foreign ownership cannot be reassigned', async () => {
  const f = fixture(); setAccountScope('A'); await f.repo.saveWorkout(workout('own'));
  assert.equal((await f.repo.getLocalWorkoutsOnly())[0].userId, 'A');
  setAccountScope('B');
  await assert.rejects(f.repo.saveWorkout({ ...workout('own'), userId: 'A' }), /another account/);
  assert.deepEqual(await f.repo.getLocalWorkoutsOnly(), []);
});

test('retry after a stopped run was persisted keeps one workout with the original identity', async () => {
  const f = fixture(); setAccountScope('A');
  await f.repo.saveWorkout(workout('persistent-run-id'));
  const restarted = createWorkoutRepository(f.storage, f.request);
  await restarted.saveWorkout(workout('persistent-run-id'));
  assert.equal((await restarted.getLocalWorkoutsOnly()).length, 1);
  assert.equal((await restarted.getLocalWorkoutsOnly())[0].userId, 'A');
});

test('a foreign-owner record returned by an API cannot enter the account cache', async () => {
  const f = fixture(); setAccountScope('B');
  const repo = createWorkoutRepository(f.storage, async () => ({ status: 200, workouts: [{ ...workout('foreign'), userId: 'A' }] }));
  assert.deepEqual(await repo.getWorkouts(), []);
});
test('concurrent saves persist both records and independent account queues', async () => {
  const f = fixture(); setAccountScope('A');
  await Promise.all([f.repo.saveWorkout(workout('one')), f.repo.saveWorkout(workout('two'))]);
  assert.equal((await f.repo.getLocalWorkoutsOnly()).length, 2);
  setAccountScope('B'); assert.deepEqual(await f.repo.getLocalWorkoutsOnly(), []);
  f.online(); await f.repo.syncLocalWorkoutsToServer(); assert.equal(f.calls.length, 0);
});
test('offline updates and deletions survive process-style repository recreation', async () => {
  const f = fixture(); setAccountScope('A');
  f.server.set('edited', workout('edited', 'old')); f.server.set('deleted', workout('deleted'));
  await f.repo.updateWorkout(workout('edited', 'new')); await f.repo.deleteWorkout('deleted');
  const restarted = createWorkoutRepository(f.storage, f.request); f.online();
  const list = await restarted.getWorkouts();
  assert.equal(list.find(w => w.id === 'edited')?.name, 'new');
  assert.ok(!list.some(w => w.id === 'deleted')); assert.equal(await restarted.pendingCount(), 0);
});
test('failed server mutations retain pending data rather than accepting stale GETs', async () => {
  const f = fixture(); setAccountScope('A'); await f.repo.saveWorkout(workout('one', 'new'));
  const repo = createWorkoutRepository(f.storage, async (_scope, method) => method === 'GET'
    ? { status: 200, workouts: [workout('one', 'old')] } : { status: 503 });
  assert.equal((await repo.getWorkouts())[0].name, 'new'); assert.equal(await repo.pendingCount(), 1);
});
test('late account-A reads cannot replace account-B local data', async () => {
  const f = fixture(); setAccountScope('A');
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const repo = createWorkoutRepository(f.storage, async () => { await gate; return { status: 200, workouts: [workout('A')] }; });
  const pending = repo.getWorkouts();
  // Let the queued local read and GET begin.
  await new Promise(resolve => setImmediate(resolve));
  setAccountScope('B'); release(); await assert.rejects(pending, /account changed/);
  assert.deepEqual(await f.repo.getLocalWorkoutsOnly(), []);
});
test('corrupt persisted data is preserved and reported', async () => {
  const f = fixture(); setAccountScope('A');
  const key = `swolehouse:v1:${getAccountScope().userId}:workouts`; f.data.set(key, '{broken');
  await assert.rejects(f.repo.getLocalWorkoutsOnly(), /preserved/); assert.equal(f.data.get(key), '{broken');
});

test('a GET started before a concurrent edit cannot overwrite the acknowledged edit', async () => {
  const f = fixture(); setAccountScope('A');
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const began = new Promise<void>(resolve => { started = resolve; });
  const repo = createWorkoutRepository(f.storage, async (_scope, method) => {
    if (method === 'GET') { started(); await gate; return { status: 200, workouts: [workout('one', 'old')] }; }
    return { status: 200 };
  });
  const reading = repo.getWorkouts(); await began;
  await repo.updateWorkout(workout('one', 'new')); await repo.syncLocalWorkoutsToServer();
  release(); assert.equal((await reading)[0].name, 'new');
});

test('an in-flight write cannot acknowledge a newer pending edit', async () => {
  const f = fixture(); setAccountScope('A');
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const began = new Promise<void>(resolve => { started = resolve; });
  const writes: string[] = [];
  const repo = createWorkoutRepository(f.storage, async (_scope, method, _path, body) => {
    if (method === 'PUT') { writes.push(body!.name); if (writes.length === 1) { started(); await gate; } }
    return { status: 200 };
  });
  await repo.saveWorkout(workout('one', 'first')); await began;
  await repo.updateWorkout(workout('one', 'second')); release(); await repo.syncLocalWorkoutsToServer();
  assert.deepEqual(writes, ['first', 'second']); assert.equal(await repo.pendingCount(), 0);
});

test('previous server workout format remains readable without changing its identity', async () => {
  const f = fixture(); setAccountScope('A');
  const legacy = { id: 'old', name: 'Old', createdAt: '2026-01-01', workoutType: 'legs', exercises: [] } as unknown as GeneratedWorkout;
  const repo = createWorkoutRepository(f.storage, async () => ({ status: 200, workouts: [legacy] }));
  const [restored] = await repo.getWorkouts();
  assert.equal(restored.id, 'old'); assert.equal(restored.topCategory, 'weight_lifting'); assert.equal(restored.subType, 'legs');
});
