import test from 'node:test';
import assert from 'node:assert/strict';
import { computePRs, computeJustRunPRs } from '../lib/personal-records';
import type { Exercise, GeneratedWorkout, RunData } from '../lib/exercises';
const exercise: Exercise = { id: 'e', name: 'Test', muscles: ['chest'], category: 'compound', equipment: 'None' };
function workout(id: string, weight: number, weightUnit: 'lbs' | 'kg'): GeneratedWorkout {
  return { id, name: 'Test', topCategory: 'weight_lifting', subType: 'full_body', style: 'hypertrophy',
    durationMinutes: 30, createdAt: `2026-01-0${id}`, exercises: [{ exercise, weight, weightUnit, sets: 1, reps: '1', restSeconds: 0 }] };
}
test('weight records compare canonical units but retain the winning original units', () => {
  const records = computePRs([workout('1', 100, 'kg'), workout('2', 220, 'lbs')], [exercise], 'weight_lifting');
  assert.equal(records[0].prWeight, 100); assert.equal(records[0].prWeightUnit, 'kg');
  assert.equal(records[0].lastWeight, 220);
});
test('PR reset excludes older weights without deleting history', () => {
  const records = computePRs([workout('1', 100, 'kg'), workout('2', 220, 'lbs')], [exercise], 'weight_lifting', [], { e: '2026-01-01T23:00:00Z' });
  assert.equal(records[0].prWeight, 220);
});
test('run records compare miles and kilometers in canonical units', () => {
  const base = workout('1', 0, 'lbs');
  const runs = [
    { ...base, subType: 'just_run', runData: { unit: 'miles', distanceMiles: 5, distanceKm: 8.04672, paceSecsPerMile: 480, paceSecsPerKm: 298.26, durationSeconds: 2400 } as RunData },
    { ...base, subType: 'just_run', runData: { unit: 'km', distanceMiles: 4.3496, distanceKm: 7, paceSecsPerMile: 579.36, paceSecsPerKm: 360, durationSeconds: 2520 } as RunData },
  ];
  const records = computeJustRunPRs(runs);
  assert.equal(records.fastestPaceRun?.unit, 'miles'); assert.equal(records.farthestDistanceRun?.unit, 'miles');
});
