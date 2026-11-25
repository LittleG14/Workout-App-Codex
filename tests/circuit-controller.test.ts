import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeneratedWorkout, WorkoutExercise } from '../lib/exercises';
import { prepareCircuitTracking } from '../lib/circuit-session';
import { createCircuitController } from '../lib/circuit-controller';
import { createWorkoutRepository } from '../lib/workout-repository';
import { getAccountScope, setAccountScope } from '../lib/account-scope';
import { createAudioOwnership } from '../lib/audio-ownership';

function template(format = 'emom', id = 'w', count = 3, rounds = 2): GeneratedWorkout {
  const exercises: WorkoutExercise[] = Array.from({ length: count }, () => ({ exercise: { id: 'same-exercise', name: 'Run', equipment: 'None', muscles: ['quads'], category: 'compound' }, sets: 1, reps: '1km', restSeconds: 0 }));
  const name = format === 'emom' ? 'EMOM' : format === 'hyrox' ? 'Hyrox' : 'AMRAP';
  return prepareCircuitTracking({ id, userId: 'A', name, topCategory: 'circuit', subType: format, style: format, durationMinutes: count * rounds,
    createdAt: '2026-11-25T10:00:00Z', exercises, circuitBlocks: [{ name, format: name, exercises, rounds, timeCapMinutes: count * rounds }] });
}
function fixture() {
  const data = new Map<string, string>(), server = new Map<string, GeneratedWorkout>();
  let elapsed = 0, runtime = 'one', offline = true, chimeCount = 0, stopCount = 0, cancelCount = 0, failSound = false, failStorage = false;
  let scheduled: number[] = [];
  const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { if (failStorage) throw new Error('disk full'); data.set(key, value); }, removeItem: async (key: string) => { data.delete(key); } };
  const request = async (_scope: unknown, method: string, path: string, body?: GeneratedWorkout) => {
    if (offline) throw new Error('offline');
    if (method === 'GET') return { status: 200, workouts: [...server.values()] };
    const id = decodeURIComponent(path.split('/').at(-1)!);
    if (method === 'PUT' && !server.has(id)) return { status: 404 };
    if (method === 'DELETE') server.delete(id); else if (body) server.set(body.id, structuredClone(body));
    return { status: 200 };
  };
  const repo = createWorkoutRepository(storage, request);
  const deps = { load: repo.getLocalWorkoutsOnly, edit: repo.editWorkout, clock: () => ({ wall: 1795600800000 + elapsed, mono: elapsed, runtime }), id: () => 'session',
    chime: async () => { chimeCount++; if (failSound) throw new Error('audio interrupted'); }, stopChime: () => { stopCount++; },
    schedule: async (_id: string, delays: number[]) => { scheduled = delays; return delays.length; }, cancelScheduled: async () => { cancelCount++; scheduled = []; } };
  const controller = createCircuitController(deps);
  return { repo, controller, recreate: () => createCircuitController(deps), data, server,
    time: (ms: number) => { elapsed = ms; }, reload: () => { runtime = 'two'; }, online: () => { offline = false; },
    failSound: () => { failSound = true; }, failStorage: (fail: boolean) => { failStorage = fail; },
    chimes: () => chimeCount, stops: () => stopCount, cancellations: () => cancelCount, scheduled: () => scheduled };
}
async function start(f: ReturnType<typeof fixture>, w = template(), background = false) {
  setAccountScope('A'); await f.repo.saveWorkout(w); await f.controller.activate(getAccountScope());
  await f.controller.start(w.id, background); f.time(5000); await f.controller.tick();
}

test('controller persists one chime claim per minute, coalesces stalled ticks, and finishes the final interval with a chime', async () => {
  const f = fixture(); await start(f, template('emom', 'w', 1, 3));
  assert.equal(f.chimes(), 0); f.time(65000); await f.controller.tick(); assert.equal(f.chimes(), 1);
  await f.controller.tick(); assert.equal(f.chimes(), 1);
  f.time(185000); await f.controller.tick(); assert.equal(f.chimes(), 2);
  assert.equal(f.controller.getSnapshot().workout?.circuitSession?.status, 'completed');
  assert.equal(f.controller.getSnapshot().workout?.elapsedSeconds, 180);
  const saved = (await f.repo.getLocalWorkoutsOnly())[0]; assert.equal(saved.circuitSession?.chimeCursor, 3);
  f.time(500000); await f.controller.tick(); assert.equal(f.chimes(), 2);
});
test('EMOM pause just before a boundary excludes rest and ending prevents all later chimes', async () => {
  const f = fixture(); await start(f); f.time(64999);
  await f.controller.action('w', { type: 'pause' }); f.time(184999); await f.controller.tick(); assert.equal(f.chimes(), 0);
  await f.controller.action('w', { type: 'resume' }); f.time(185000); await f.controller.tick(); assert.equal(f.chimes(), 1);
  await f.controller.action('w', { type: 'finish' }); f.time(500000); await f.controller.tick(); assert.equal(f.chimes(), 1);
  assert.ok(f.cancellations() > 0);
});
test('background notifications use finite offsets, foreground catches up silently, and pause cancels pending requests', async () => {
  const f = fixture(); await start(f, template(), true); f.time(10000); await f.controller.setForeground(false);
  assert.equal(f.scheduled()[0], 55000); assert.equal(f.scheduled().length, 6);
  f.time(150000); await f.controller.tick(); assert.equal(f.chimes(), 0);
  await f.controller.setForeground(true); assert.equal(f.chimes(), 0); assert.deepEqual(f.scheduled(), []);
  assert.equal(f.controller.getSnapshot().workout?.circuitSession?.chimeCursor, 2);
  f.time(185000); await f.controller.tick(); assert.equal(f.chimes(), 1);
  await f.controller.setForeground(false); await f.controller.action('w', { type: 'pause' }); assert.deepEqual(f.scheduled(), []);
});
test('audio failure cannot delay logical progression or destroy saved intervals', async () => {
  const f = fixture(); await start(f); f.failSound(); f.time(65000); await f.controller.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(f.controller.getSnapshot().error, /audio interrupted/);
  assert.equal(f.controller.getSnapshot().workout?.circuitSession?.occurrences[0].elapsedMs, 60000);
  assert.equal(f.controller.getSnapshot().workout?.circuitSession?.status, 'running');
});
test('rapid AMRAP actions serialize against the existing workout store and survive process recreation', async () => {
  const f = fixture(); const w = template('amrap'); w.circuitBlocks!.push({ ...w.circuitBlocks![0] }); await start(f, w);
  await Promise.all(Array.from({ length: 30 }, () => f.controller.action('w', { type: 'round', blockIndex: 0, delta: 1 })));
  await f.controller.action('w', { type: 'round', blockIndex: 1, delta: 1 });
  await f.controller.action('w', { type: 'round', blockIndex: 0, delta: -1 });
  await f.controller.action('w', { type: 'pause' });
  const restored = f.recreate(); await restored.activate(getAccountScope());
  assert.deepEqual(restored.getSnapshot().workout?.circuitSession?.rounds, [29, 1]);
  await restored.action('w', { type: 'finish' });
  assert.deepEqual((await f.repo.getLocalWorkoutsOnly())[0].circuitSession?.rounds, [29, 1]);
});
test('restart recovery pauses the correct station, preserves independent occurrences and prevents replay', async () => {
  const f = fixture(); await start(f, template('hyrox'));
  const id = f.controller.getSnapshot().workout!.circuitSession!.occurrences[1].id;
  await f.controller.action('w', { type: 'station', id }); f.time(65000); f.reload();
  const restored = f.recreate(); await restored.activate(getAccountScope());
  const s = restored.getSnapshot().workout!.circuitSession!;
  assert.equal(s.status, 'paused'); assert.equal(s.occurrences[1].elapsedMs, 60000); assert.equal(s.activeId, id); assert.equal(s.clockUncertain, true);
  assert.equal(s.occurrences[0].elapsedMs, 0); assert.equal(f.chimes(), 0);
});
test('cold EMOM recovery never replays missed chimes', async () => {
  const f = fixture(); await start(f); f.time(140000); f.reload();
  const restored = f.recreate(); await restored.activate(getAccountScope());
  assert.equal(restored.getSnapshot().workout?.circuitSession?.chimeCursor, 2); assert.equal(f.chimes(), 0);
  assert.equal(restored.getSnapshot().workout?.circuitSession?.status, 'paused');
});
test('offline completion round-trips optional circuit metadata through the existing API without duplicates', async () => {
  const f = fixture(); await start(f, template('amrap'));
  await f.controller.action('w', { type: 'round', blockIndex: 0, delta: 1 }); f.time(65000); await f.controller.action('w', { type: 'finish' });
  const saved = (await f.repo.getLocalWorkoutsOnly())[0];
  await f.repo.saveWorkout(saved); f.online(); await f.repo.syncLocalWorkoutsToServer(); await f.repo.syncLocalWorkoutsToServer();
  assert.equal(f.server.size, 1); assert.deepEqual(f.server.get('w')?.circuitSession, saved.circuitSession);
  assert.deepEqual((await f.repo.getWorkouts())[0].circuitSession, saved.circuitSession);
  setAccountScope('B'); assert.deepEqual(await f.repo.getLocalWorkoutsOnly(), []);
  await assert.rejects(f.controller.action('w', { type: 'resume' }), /account changed/i);
});
test('storage failure cannot report a successful count and an old full-record edit cannot erase timing', async () => {
  const f = fixture(); await start(f, template('amrap')); const stale = template('amrap');
  await assert.rejects(f.repo.updateWorkout(stale), /timing changed/);
  f.failStorage(true); await assert.rejects(f.controller.action('w', { type: 'round', blockIndex: 0, delta: 1 }), /disk full/);
  assert.equal(f.controller.getSnapshot().workout?.circuitSession?.rounds[0], 0);
  f.failStorage(false); assert.equal((await f.repo.getLocalWorkoutsOnly())[0].circuitSession?.rounds[0], 0);
});
test('an unfinished circuit cannot be deleted, overwritten, or run alongside another circuit', async () => {
  const f = fixture(); await start(f); await f.repo.saveWorkout(template('hyrox', 'second'));
  await assert.rejects(f.controller.start('second'), /unfinished circuit/);
  await assert.rejects(f.repo.deleteWorkout('w'), /Finish or cancel/);
  await f.controller.action('w', { type: 'cancel' }); await f.repo.deleteWorkout('w');
  await f.controller.start('second'); assert.equal(f.controller.getSnapshot().workout?.id, 'second');
});
test('legacy records cannot be backfilled by starting timers and normal logout pauses the owned circuit', async () => {
  const f = fixture(); setAccountScope('A'); const old = template('hyrox'); delete old.circuitTrackingVersion;
  await f.repo.saveWorkout(old); await f.controller.activate(getAccountScope()); await assert.rejects(f.controller.start('w'), /read-only/);
  assert.equal((await f.repo.getLocalWorkoutsOnly())[0].circuitSession, undefined);
  await f.repo.saveWorkout(template('hyrox', 'new')); await f.controller.start('new'); f.time(5000); await f.controller.tick();
  await f.controller.beforeLogout(); assert.equal((await f.repo.getLocalWorkoutsOnly()).find(w => w.id === 'new')?.circuitSession?.status, 'paused');
});
test('shared audio ownership prevents cross-feature cancellation and stale completion from releasing a new claim', async () => {
  const resolves: (() => void)[] = []; let stops = 0;
  const bus = createAudioOwnership({ play: async () => new Promise<void>(resolve => { resolves.push(resolve); }), stop: async () => { stops++; } });
  const run = Symbol(), circuit = Symbol();
  const first = bus.play(run, 'update', 'Run'); bus.stop(circuit); assert.equal(stops, 0);
  await assert.rejects(bus.play(circuit, 'sound', ''), /Another workout/);
  bus.stop(run); assert.equal(stops, 1); const second = bus.play(run, 'update', 'Next');
  resolves[0](); await first; await assert.rejects(bus.play(circuit, 'sound', ''), /Another workout/);
  resolves[1](); await second; const third = bus.play(circuit, 'sound', ''); bus.stop(run); assert.equal(stops, 1);
  resolves[2](); await third;
});
test('an account change while notification cleanup awaits cannot apply an old pause to the new account', async () => {
  setAccountScope('A'); let release!: () => void, blocked = false;
  const w = template('emom'); let owned = w;
  const controller = createCircuitController({ load: async () => [owned], edit: async (_id, change) => { owned = change(owned); return owned; },
    clock: () => ({ wall: 100000, mono: 0, runtime: 'test' }), id: () => 'session', chime: async () => {}, stopChime: () => {},
    schedule: async () => 0, cancelScheduled: async () => { if (blocked) await new Promise<void>(resolve => { release = resolve; }); } });
  await controller.activate(getAccountScope()); await controller.start('w');
  blocked = true; const request = controller.action('w', { type: 'cancel' });
  await new Promise(resolve => setImmediate(resolve));
  setAccountScope('B'); owned = { ...w, userId: 'B' }; release();
  await assert.rejects(request, /account changed/i); assert.equal(owned.circuitSession, undefined);
});
test('failed EMOM finalization preserves the running anchor for retry rather than losing completed intervals', async () => {
  const f = fixture(); await start(f, template('emom', 'w', 1, 1)); f.failStorage(true); f.time(65000);
  await f.controller.tick(); assert.match(f.controller.getSnapshot().error, /disk full/);
  assert.equal((await f.repo.getLocalWorkoutsOnly())[0].circuitSession?.status, 'running');
  f.failStorage(false); await f.controller.action('w', { type: 'finish' });
  const saved = (await f.repo.getLocalWorkoutsOnly())[0]; assert.equal(saved.circuitSession?.status, 'completed');
  assert.equal(saved.circuitSession?.occurrences[0].elapsedMs, 60000); assert.equal(saved.elapsedSeconds, 60);
});
test('unfinished metadata arriving through sync after hydration can be adopted safely for recovery', async () => {
  const f = fixture(); await start(f, template('hyrox')); const saved = (await f.repo.getLocalWorkoutsOnly())[0];
  const other = f.recreate();
  await f.repo.editWorkout('w', current => { const copy = { ...current }; delete copy.circuitSession; return copy; });
  await other.activate(getAccountScope()); assert.equal(other.getSnapshot().workout, null);
  await f.repo.editWorkout('w', () => saved); f.time(25000); f.reload(); await other.recoverForView('w');
  assert.equal(other.getSnapshot().workout?.circuitSession?.status, 'paused');
  assert.equal(other.getSnapshot().workout?.circuitSession?.clockUncertain, true);
});
