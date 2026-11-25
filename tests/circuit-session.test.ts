import test from 'node:test';
import assert from 'node:assert/strict';
import type { GeneratedWorkout, WorkoutExercise } from '../lib/exercises';
import { generateWorkout } from '../lib/exercises';
import { changeCircuit, circuitElapsed, circuitFormat, circuitPrescriptionLocked, circuitRowTiming, createCircuitSession,
  currentEmomOccurrence, emomMinutes, formatCircuitTime, prepareCircuitTracking, projectCircuit, validateCircuitSession,
  circuitNotificationDelays, type CircuitClock } from '../lib/circuit-session';
import { collectHyroxTimes, hyroxWorkload } from '../lib/circuit-performance';
import { computePRs } from '../lib/personal-records';

const base = Date.parse('2026-11-25T10:00:00Z');
const clock = (seconds: number, wallShift = 0, runtime = 'process-one'): CircuitClock => ({ wall: base + seconds * 1000 + wallShift, mono: seconds * 1000, runtime });
const exercise = (id = 'hx_run', reps = '1km'): WorkoutExercise => ({ exercise: { id, name: id === 'hx_run' ? 'Run' : id, equipment: 'None', muscles: ['quads'], category: 'compound' }, reps, sets: 1, restSeconds: 0, notes: 'Station 1' });
export function circuitWorkout(format: 'hyrox' | 'emom' | 'amrap' | 'rounds_for_time' = 'hyrox', count = 3, rounds = 2): GeneratedWorkout {
  const exercises = Array.from({ length: count }, () => exercise());
  const formatName = { hyrox: 'Hyrox', emom: 'EMOM', amrap: 'AMRAP', rounds_for_time: 'Rounds for Time' }[format];
  return prepareCircuitTracking({ id: 'workout', userId: 'A', name: format, topCategory: 'circuit', subType: format, style: format,
    durationMinutes: count * rounds, createdAt: new Date(base).toISOString(), exercises,
    circuitBlocks: [{ name: formatName, format: formatName, exercises, rounds, timeCapMinutes: count * rounds }] });
}
function begin(format: 'hyrox' | 'emom' | 'amrap' = 'hyrox', count = 3, rounds = 2) {
  return projectCircuit(createCircuitSession(circuitWorkout(format, count, rounds), clock(0), 'session'), clock(5));
}
function timedWorkout(id: string, seconds: number, day: number, ex = exercise()): GeneratedWorkout {
  const w = circuitWorkout('hyrox', 1); w.id = id; w.exercises = [ex]; w.circuitBlocks![0].exercises = [ex];
  const when = (seconds: number): CircuitClock => ({ ...clock(seconds), wall: base + day * 86400000 + seconds * 1000 });
  let s = projectCircuit(createCircuitSession(w, when(0), id), when(5));
  s = changeCircuit(s, { type: 'station', id: s.occurrences[0].id }, when(5));
  s = changeCircuit(s, { type: 'station', id: s.occurrences[0].id }, when(5 + seconds));
  if (seconds > 0) s = changeCircuit(s, { type: 'confirm', id: s.occurrences[0].id }, when(5 + seconds));
  s = changeCircuit(s, { type: 'finish' }, when(5 + seconds));
  return { ...w, circuitSession: s, elapsedSeconds: s.elapsedMs / 1000 };
}

test('new station clocks are zero, use independent occurrence IDs, and never begin before the countdown', () => {
  const w = circuitWorkout(), s = createCircuitSession(w, clock(0), 's');
  assert.equal(projectCircuit(s, clock(4.999)).status, 'countdown');
  assert.equal(circuitElapsed(s, clock(4)), 0); assert.equal(formatCircuitTime(0), '00:00');
  assert.equal(new Set(s.occurrences.map(o => o.id)).size, 3);
  assert.equal(new Set(s.occurrences.map(o => o.exercise.exercise.id)).size, 1);
  assert.ok(s.occurrences.every(o => o.elapsedMs === 0 && !o.completed));
  assert.throws(() => changeCircuit(s, { type: 'station', id: s.occurrences[0].id }, clock(3)), /Start or resume/);
});
test('HYROX same-row tap stops, another row switches atomically, and restarting accumulates', () => {
  let s = begin(); const [a, b] = s.occurrences;
  s = changeCircuit(s, { type: 'station', id: a.id }, clock(5));
  s = changeCircuit(s, { type: 'station', id: b.id }, clock(275));
  assert.equal(s.occurrences[0].elapsedMs, 270000); assert.equal(s.activeId, b.id);
  assert.equal(circuitRowTiming(s, 0, 0).active, false); assert.equal(circuitRowTiming(s, 0, 1).active, true);
  s = changeCircuit(s, { type: 'station', id: b.id }, clock(285));
  assert.equal(s.activeId, undefined); assert.equal(s.occurrences[1].elapsedMs, 10000);
  s = changeCircuit(s, { type: 'station', id: a.id }, clock(290));
  s = projectCircuit(s, clock(350)); assert.equal(s.occurrences[0].elapsedMs, 330000);
  assert.equal(s.occurrences[1].elapsedMs, 10000);
});
test('rapid and out-of-order HYROX taps cannot create overlapping station clocks', () => {
  let s = begin(); const ids = s.occurrences.map(o => o.id);
  for (let i = 0; i < 100; i++) s = changeCircuit(s, { type: 'station', id: ids[(i * 7) % 3] }, clock(5 + i / 10));
  s = projectCircuit(s, clock(16));
  assert.ok(s.occurrences.reduce((n, o) => n + o.elapsedMs, 0) <= s.elapsedMs + 0.001);
  assert.ok(s.occurrences.filter(o => circuitRowTiming(s, o.blockIndex, o.exerciseIndex).active).length <= 1);
});
test('global pause excludes rest, resumes the active HYROX station, and leaves manually stopped stations stopped', () => {
  let s = begin(); const id = s.occurrences[0].id;
  s = changeCircuit(s, { type: 'station', id }, clock(5));
  s = changeCircuit(s, { type: 'pause' }, clock(125));
  assert.equal(s.occurrences[0].elapsedMs, 120000); assert.equal(circuitRowTiming(s, 0, 0).active, false);
  assert.equal(projectCircuit(s, clock(500)).elapsedMs, 120000);
  s = changeCircuit(s, { type: 'resume' }, clock(500)); s = projectCircuit(s, clock(560));
  assert.equal(s.occurrences[0].elapsedMs, 180000);
  s = changeCircuit(s, { type: 'station', id }, clock(560));
  s = changeCircuit(s, { type: 'pause' }, clock(561)); s = changeCircuit(s, { type: 'resume' }, clock(700));
  assert.equal(projectCircuit(s, clock(760)).occurrences[0].elapsedMs, 180000);
});
test('finishing finalizes an active station without assuming its work was completed or its total equals the workout', () => {
  let s = begin(); const id = s.occurrences[0].id;
  s = changeCircuit(s, { type: 'station', id }, clock(15)); s = changeCircuit(s, { type: 'finish' }, clock(35));
  assert.equal(s.elapsedMs, 30000); assert.equal(s.occurrences[0].elapsedMs, 20000);
  assert.equal(s.activeId, undefined); assert.equal(s.occurrences[0].completed, false);
  assert.throws(() => changeCircuit(s, { type: 'station', id }, clock(40)), /read-only/);
  assert.equal(projectCircuit(s, clock(100)).occurrences[0].elapsedMs, 20000);
});
test('only explicit positive stopped work can be confirmed, and timing that station again invalidates completion', () => {
  let s = begin(); const id = s.occurrences[0].id;
  assert.throws(() => changeCircuit(s, { type: 'confirm', id }, clock(5)));
  s = changeCircuit(s, { type: 'station', id }, clock(5));
  assert.throws(() => changeCircuit(s, { type: 'confirm', id }, clock(10)));
  s = changeCircuit(s, { type: 'station', id }, clock(15));
  s = changeCircuit(s, { type: 'confirm', id }, clock(15)); assert.equal(s.occurrences[0].completed, true);
  s = changeCircuit(s, { type: 'station', id }, clock(16)); assert.equal(s.occurrences[0].completed, false);
});
test('monotonic time and record ordering tolerate wall-clock changes; unsafe cold recovery pauses and excludes PRs', () => {
  let s = begin(); const id = s.occurrences[0].id;
  s = changeCircuit(s, { type: 'station', id }, clock(5));
  s = changeCircuit(s, { type: 'finish' }, clock(65, -3600000));
  assert.equal(s.elapsedMs, 60000); assert.equal(s.completedAt, new Date(base + 65000).toISOString());
  let restored = begin(); restored = changeCircuit(restored, { type: 'station', id: restored.occurrences[0].id }, clock(5));
  restored = changeCircuit(JSON.parse(JSON.stringify(restored)), { type: 'recover' }, clock(65, 0, 'process-two'));
  assert.equal(restored.elapsedMs, 60000); assert.equal(restored.status, 'paused'); assert.equal(restored.clockUncertain, true);
  assert.equal(projectCircuit(begin(), clock(6, -100000, 'process-two')).status, 'paused');
  assert.equal(projectCircuit(begin(), clock(90000, 0, 'process-two')).status, 'paused');
});
test('formatted timers retain hours and reject invalid values', () => {
  assert.equal(formatCircuitTime(84300), '01:24'); assert.equal(formatCircuitTime(3599000), '59:59');
  assert.equal(formatCircuitTime(3600000), '1:00:00'); assert.equal(formatCircuitTime(4325000), '1:12:05');
  assert.equal(formatCircuitTime(NaN), '—'); assert.equal(formatCircuitTime(-1), '—');
});
test('fallback clocks never qualify for timed PRs and confirming a paused station stops its pending resume', () => {
  const w = circuitWorkout(); const fallback = createCircuitSession(w, { ...clock(0), source: 'wall' }, 'fallback');
  assert.equal(fallback.clockUncertain, true); assert.match(fallback.warning!, /device-time fallback/);
  let s = begin(); const id = s.occurrences[0].id;
  s = changeCircuit(s, { type: 'station', id }, clock(5)); s = changeCircuit(s, { type: 'pause' }, clock(65));
  s = changeCircuit(s, { type: 'confirm', id }, clock(100)); s = changeCircuit(s, { type: 'resume' }, clock(110));
  assert.equal(s.activeId, undefined); assert.equal(s.occurrences[0].completed, true);
  assert.equal(projectCircuit(s, clock(200)).occurrences[0].elapsedMs, 60000);
});
test('EMOM starts its first exercise at the logical countdown end and advances at exactly 60 active seconds', () => {
  let s = begin('emom'); assert.equal(currentEmomOccurrence(s)?.sequence, 0);
  s = projectCircuit(s, clock(64.999)); assert.equal(currentEmomOccurrence(s)?.sequence, 0);
  assert.ok(Math.abs(s.occurrences[0].elapsedMs - 59999) < 0.001);
  s = projectCircuit(s, clock(65)); assert.equal(s.occurrences[0].elapsedMs, 60000);
  assert.equal(currentEmomOccurrence(s)?.sequence, 1); assert.equal(s.occurrences[1].elapsedMs, 0);
  assert.equal(circuitRowTiming(s, 0, 1).active, true); assert.equal(circuitRowTiming(s, 0, 0).active, false);
  assert.throws(() => changeCircuit(s, { type: 'station', id: s.occurrences[0].id }, clock(65)), /HYROX/);
});
test('EMOM excludes paused time, catches up delayed callbacks without drift and does not start an extra interval', () => {
  let s = begin('emom', 4, 3);
  s = changeCircuit(s, { type: 'pause' }, clock(100)); // Exercise 2 at 35 seconds.
  assert.equal(currentEmomOccurrence(s)?.sequence, 1); assert.equal(s.occurrences[1].elapsedMs, 35000);
  s = changeCircuit(s, { type: 'resume' }, clock(220));
  s = projectCircuit(s, clock(245)); assert.equal(currentEmomOccurrence(s)?.sequence, 2);
  s = projectCircuit(s, clock(845));
  assert.equal(s.status, 'completed'); assert.equal(s.elapsedMs, 720000); assert.equal(s.occurrences.length, 12);
  assert.ok(s.occurrences.every(o => o.elapsedMs === 60000)); assert.equal(currentEmomOccurrence(s), undefined);
  assert.equal(projectCircuit(s, clock(3000)).elapsedMs, 720000);
});
test('repeated EMOM occurrences retain independent rounds, and row time shows the current occurrence', () => {
  let s = begin('emom', 2, 3); s = projectCircuit(s, clock(155));
  assert.equal(currentEmomOccurrence(s)?.round, 1); assert.equal(circuitRowTiming(s, 0, 0).occurrence?.elapsedMs, 30000);
  assert.equal(s.occurrences[0].elapsedMs, 60000); assert.equal(new Set(s.occurrences.map(o => o.id)).size, 6);
  s = changeCircuit(s, { type: 'finish' }, clock(156));
  assert.equal(s.occurrences[2].elapsedMs, 31000); assert.equal(s.occurrences[2].completed, false);
  assert.equal(s.occurrences[3].elapsedMs, 0); assert.equal(s.occurrences[0].completed, true);
});
test('EMOM uses prescribed full rounds bounded by the time cap, chains blocks, and supports one exercise', () => {
  const w = circuitWorkout('emom', 4, 7); w.circuitBlocks![0].timeCapMinutes = 30;
  assert.equal(emomMinutes(w.circuitBlocks![0]), 28);
  w.circuitBlocks!.push({ ...w.circuitBlocks![0], rounds: 1, timeCapMinutes: 4 });
  let s = projectCircuit(createCircuitSession(w, clock(0), 's'), clock(5 + 28 * 60));
  assert.equal(currentEmomOccurrence(s)?.blockIndex, 1); assert.equal(s.occurrences.length, 32);
  s = begin('emom', 1, 2); s = projectCircuit(s, clock(65)); assert.equal(currentEmomOccurrence(s)?.round, 1);
  assert.throws(() => emomMinutes({ ...w.circuitBlocks![0], rounds: -1 }));
});
test('finite background notification offsets honor remaining countdown and stop at the final interval', () => {
  const w = circuitWorkout('emom', 4, 25);
  let s = createCircuitSession(w, clock(0), 's', true);
  assert.equal(circuitNotificationDelays(s, clock(2))[0], 63000);
  assert.equal(circuitNotificationDelays(s).length, 60);
  s = projectCircuit(s, clock(5 + 119)); assert.equal(circuitNotificationDelays(s)[0], 1000);
  s = changeCircuit(s, { type: 'pause' }, clock(124)); assert.deepEqual(circuitNotificationDelays(s), []);
  assert.deepEqual(circuitNotificationDelays({ ...s, status: 'completed' }), []);
});
test('AMRAP counts are per block, manual, nonnegative, and preserved through pause/recovery/end', () => {
  const w = circuitWorkout('amrap'); w.circuitBlocks!.push({ ...w.circuitBlocks![0] });
  let s = projectCircuit(createCircuitSession(w, clock(0), 's'), clock(5));
  assert.deepEqual(s.rounds, [0, 0]); assert.equal(s.occurrences.length, 0);
  s = changeCircuit(s, { type: 'round', blockIndex: 0, delta: -1 }, clock(5)); assert.equal(s.rounds[0], 0);
  for (let i = 0; i < 100; i++) s = changeCircuit(s, { type: 'round', blockIndex: 0, delta: 1 }, clock(6));
  s = changeCircuit(s, { type: 'round', blockIndex: 1, delta: 1 }, clock(7));
  s = changeCircuit(s, { type: 'pause' }, clock(8)); s = changeCircuit(s, { type: 'round', blockIndex: 0, delta: -1 }, clock(8));
  s = changeCircuit(JSON.parse(JSON.stringify(s)), { type: 'resume' }, clock(100));
  s = changeCircuit(s, { type: 'finish' }, clock(110));
  assert.deepEqual(s.rounds, [99, 1]); assert.equal(s.elapsedMs, 13000);
  assert.throws(() => changeCircuit(s, { type: 'round', blockIndex: 0, delta: 1 }, clock(111)), /read-only/);
});
test('older history has no fabricated measurements and Rounds for Time keeps its original model and controls', () => {
  const old = circuitWorkout(); delete old.circuitTrackingVersion;
  assert.equal(circuitPrescriptionLocked(old), true); assert.equal(old.circuitSession, undefined); assert.equal(old.elapsedSeconds, undefined);
  const rft = generateWorkout('circuit', 'rounds_for_time', 'rounds_for_time', 30);
  assert.equal(circuitFormat(rft), null); assert.equal(prepareCircuitTracking(rft), rft); assert.equal(circuitPrescriptionLocked(rft), false);
  const before = JSON.stringify(rft); assert.throws(() => createCircuitSession(rft, clock(0), 's'), /existing workout controls/);
  assert.equal(JSON.stringify(rft), before); assert.equal(rft.circuitSession, undefined);
  assert.equal(rft.circuitBlocks![0].format, 'Rounds for Time'); assert.equal(rft.circuitBlocks![0].rounds, 3);
});
test('corrupt occurrence durations, identities, clocks and schedules fail closed without modifying saved input', () => {
  const w = circuitWorkout(); const s = begin(); const original = JSON.stringify(s);
  assert.equal(validateCircuitSession(s, w).id, s.id);
  assert.throws(() => validateCircuitSession({ ...s, elapsedMs: NaN }, w));
  assert.throws(() => validateCircuitSession({ ...s, occurrences: s.occurrences.slice(1) }, w));
  assert.throws(() => validateCircuitSession({ ...s, occurrences: s.occurrences.map(o => ({ ...o, id: 'duplicate' })) }, w));
  assert.throws(() => validateCircuitSession({ ...s, activeId: 'no-station' }, w));
  assert.throws(() => validateCircuitSession({ ...s, userId: 'B' }, w)); assert.equal(JSON.stringify(s), original);
});
test('time PR examples use the minimum while Last uses the latest comparable completion', () => {
  for (const [previous, next, expected] of [[270, 255, 255], [255, 280, 255], [255, 235, 235], [0, 300, 300]]) {
    const workouts = [...(previous ? [timedWorkout('old', previous, 0)] : []), timedWorkout('new', next, 1)];
    const record = computePRs(workouts, [], 'circuit')[0].timedPerformances![0];
    assert.equal(record.prElapsedMs, expected * 1000); assert.equal(record.lastElapsedMs, next * 1000);
  }
});
test('incomplete, canceled, zero, corrupt and unstarted station attempts cannot produce time PRs', () => {
  const valid = timedWorkout('good', 300, 0), incomplete = timedWorkout('partial', 200, 1), canceled = timedWorkout('canceled', 100, 2), zero = timedWorkout('zero', 0, 3), corrupt = timedWorkout('corrupt', 50, 4);
  incomplete.circuitSession!.occurrences[0].completed = false; canceled.circuitSession!.status = 'canceled'; corrupt.circuitSession!.occurrences[0].elapsedMs = Infinity;
  const record = collectHyroxTimes([valid, incomplete, canceled, zero, corrupt]).get('hx_run')!.times[0];
  assert.equal(record.prElapsedMs, 300000); assert.equal(record.lastElapsedMs, 300000);
  assert.equal(collectHyroxTimes([circuitWorkout()]).size, 0);
});
test('different distances, loads and equipment do not share time PR groups; equivalent units do', () => {
  const run = exercise(), half = exercise('hx_run', '500m'), same = exercise('hx_run', '1000 meters');
  assert.equal(hyroxWorkload(run).key, hyroxWorkload(same).key); assert.notEqual(hyroxWorkload(run).key, hyroxWorkload(half).key);
  assert.equal(hyroxWorkload(run).key, hyroxWorkload(exercise('hx_run', '0.621371192237 miles')).key);
  const loaded = { ...exercise('sled', '50m'), exercise: { ...exercise().exercise, id: 'sled', name: 'Sled Push', equipment: 'Sled' }, weight: 100, weightUnit: 'kg' as const };
  assert.equal(hyroxWorkload(loaded).key, hyroxWorkload({ ...loaded, weight: 220.462262, weightUnit: 'lbs' }).key);
  assert.notEqual(hyroxWorkload(loaded).key, hyroxWorkload({ ...loaded, weight: 75 }).key);
  const times = collectHyroxTimes([timedWorkout('one', 300, 0, run), timedWorkout('two', 150, 1, half), timedWorkout('three', 320, 2, same)]).get('hx_run')!.times;
  assert.equal(times.length, 2); assert.equal(times.find(t => t.key === hyroxWorkload(run).key)?.prElapsedMs, 300000);
});
test('repeated HYROX runs in one workout keep the fastest PR and the last explicitly completed occurrence', () => {
  const w = circuitWorkout('hyrox', 2); let s = projectCircuit(createCircuitSession(w, clock(0), 's'), clock(5));
  const [a, b] = s.occurrences;
  s = changeCircuit(s, { type: 'station', id: a.id }, clock(5));
  s = changeCircuit(s, { type: 'station', id: b.id }, clock(305));
  s = changeCircuit(s, { type: 'confirm', id: a.id }, clock(305));
  s = changeCircuit(s, { type: 'station', id: b.id }, clock(665));
  s = changeCircuit(s, { type: 'confirm', id: b.id }, clock(665));
  w.circuitSession = changeCircuit(s, { type: 'finish' }, clock(670));
  const record = collectHyroxTimes([w]).get('hx_run')!.times[0];
  assert.equal(record.prElapsedMs, 300000); assert.equal(record.lastElapsedMs, 360000);
});
test('unspecified workloads/loads and recovered clocks retain Last and history without misleading PRs', () => {
  const sled = { ...exercise('sled', '50m'), exercise: { ...exercise().exercise, id: 'sled', name: 'Sled Push', equipment: 'Sled' } };
  const w = timedWorkout('missing', 300, 0, sled), uncertain = timedWorkout('restored', 200, 1); uncertain.circuitSession!.clockUncertain = true;
  const records = collectHyroxTimes([w, uncertain]);
  assert.equal(records.get('sled')!.times[0].prElapsedMs, undefined); assert.equal(records.get('sled')!.times[0].lastElapsedMs, 300000);
  assert.equal(records.get('hx_run')!.times[0].prElapsedMs, undefined);
  assert.equal(hyroxWorkload(exercise('pushup', '10-15')).comparable, false);
  assert.equal(hyroxWorkload({ ...exercise('ski', '50'), exercise: { ...exercise().exercise, id: 'ski', name: 'Ski Erg', equipment: 'Ski Erg' } }).comparable, false);
});
test('repeated station attempts, duplicate sync results, hidden/reset records and EMOM remain correctly separated', () => {
  const w = timedWorkout('one', 300, 0), newer = timedWorkout('two', 320, 1);
  assert.deepEqual(collectHyroxTimes([w, w, newer]), collectHyroxTimes([w, newer]));
  assert.equal(collectHyroxTimes([w], ['hx_run']).size, 0);
  const reset = collectHyroxTimes([w, newer], [], { hx_run: new Date(base + 86400000).toISOString() });
  assert.equal(reset.get('hx_run')!.times[0].prElapsedMs, 320000);
  const emom = circuitWorkout('emom', 1, 1); emom.circuitSession = projectCircuit(createCircuitSession(emom, clock(0), 'e'), clock(65));
  assert.equal(collectHyroxTimes([emom]).size, 0);
});
