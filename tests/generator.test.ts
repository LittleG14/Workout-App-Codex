import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDIO_RUNNING, CIRCUIT_EXERCISES, generateWorkout, rebalanceCircuit,
  type TopCategory } from '../lib/exercises';

test('hiding running prerequisites still produces defined exercises at each duration', () => {
  for (const duration of [30, 45, 60, 90]) {
    for (const hidden of CARDIO_RUNNING) {
      const w = generateWorkout('cardio', 'running', 'running', duration, false, false, [], [hidden.id]);
      assert.ok(w.exercises.every(ex => ex.exercise?.id));
    }
  }
});
test('exhausted pools fail clearly before persisting an invalid workout', () => {
  assert.throws(() => generateWorkout('circuit', 'emom', 'emom', 60, false, false, [], CIRCUIT_EXERCISES.map(e => e.id)), /No exercises/);
});
test('small circuit pools yield nonempty blocks and finite rounds', () => {
  for (const style of ['amrap', 'emom', 'rounds_for_time']) {
    const w = generateWorkout('circuit', style, style, 60, false, false, [], CIRCUIT_EXERCISES.slice(1).map(e => e.id));
    assert.ok(w.circuitBlocks!.every(b => b.exercises.length > 0 && (b.rounds === undefined || Number.isFinite(b.rounds))));
  }
});
test('rebalance does not duplicate exercises in a block or add hidden exercises', () => {
  const hidden = CIRCUIT_EXERCISES.slice(-4).map(e => e.id);
  const original = generateWorkout('circuit', 'emom', 'emom', 30, false, false, [], hidden);
  for (let i = 0; i < 40; i++) {
    const w = rebalanceCircuit(original, 'more_movements', [], hidden);
    const ids = w.exercises.map(e => e.exercise.id);
    assert.equal(ids.length, new Set(ids).size);
    assert.ok(ids.every(id => !hidden.includes(id)));
  }
});
test('baseline generator combinations preserve valid workouts', () => {
  const variants: [TopCategory, string[]][] = [
    ['weight_lifting', ['chest_triceps','back_biceps','shoulders_abs','legs','full_body','push','pull']],
    ['circuit', ['amrap','emom','rounds_for_time','hyrox']], ['yoga', ['core_strength','flexibility']],
    ['cardio', ['running','mixed_cardio']], ['mobility', ['full_body','lower_body','upper_body','hips_and_spine']],
  ];
  for (const [category, subtypes] of variants) for (const subtype of subtypes)
    for (const duration of category === 'mobility' ? [10,20,30,45] : [30,45,60,90])
      for (const supersets of [false, true]) {
        const w = generateWorkout(category, subtype, category === 'weight_lifting' ? 'hypertrophy' : subtype, duration, supersets, true);
        assert.ok(w.id && w.exercises.length && w.exercises.every(e => e.exercise?.id));
      }
});
