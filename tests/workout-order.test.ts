import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorkout } from '../lib/exercises';
import { convertExerciseToSuperset, getWorkoutOrder } from '../lib/workout-order';

test('conversion preserves every existing superset and the selected display position', () => {
  const w = generateWorkout('weight_lifting', 'full_body', 'hypertrophy', 60, true);
  const before = getWorkoutOrder(w);
  const pair = { exerciseA: w.exercises[0], exerciseB: { ...w.exercises[0], weight: 123 } };
  const result = convertExerciseToSuperset(w, 0, pair);
  assert.equal(result.supersets!.length, w.supersets!.length + 1);
  assert.equal(result.itemOrder!.filter(i => i.kind === 'superset').length, result.supersets!.length);
  assert.equal(result.exercises.length, w.exercises.length - 1);
  for (const old of w.supersets!) assert.ok(result.supersets!.includes(old));
  const position = before.findIndex(e => e.kind === 'exercise' && e.index === 0);
  const after = getWorkoutOrder(result)[position];
  assert.equal(after.kind, 'superset'); assert.equal(result.supersets![after.index], pair);
});
test('inconsistent saved order recovers all persisted items', () => {
  const w = generateWorkout('weight_lifting', 'full_body', 'hypertrophy', 45, true);
  w.itemOrder = [{ kind: 'superset' }];
  assert.equal(getWorkoutOrder(w).length, w.exercises.length + w.supersets!.length);
});
test('repeated conversions preserve order metadata and logged values', () => {
  let w = generateWorkout('weight_lifting', 'full_body', 'hypertrophy', 90, true);
  const originalCount = w.exercises.length;
  const originalPairs = w.supersets!.length;
  for (let i = 0; i < originalCount; i++) {
    w = convertExerciseToSuperset(w, 0, { exerciseA: w.exercises[0], exerciseB: { ...w.exercises[0], userNotes: 'retained' } });
    assert.equal(getWorkoutOrder(w).length, originalCount + originalPairs);
  }
  assert.ok(w.supersets!.slice(-1).some(pair => pair.exerciseB.userNotes === 'retained'));
});
