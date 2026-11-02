import type { GeneratedWorkout, SupersetPair } from './exercises';

type OrderEntry = { kind: 'exercise' | 'superset'; index: number };

export function getWorkoutOrder(workout: GeneratedWorkout): OrderEntry[] {
  if (workout.itemOrder) {
    let exercise = 0; let superset = 0;
    const order = workout.itemOrder.map(({ kind }) => ({ kind, index: kind === 'exercise' ? exercise++ : superset++ }));
    if (exercise === workout.exercises.length && superset === (workout.supersets?.length ?? 0)) return order;
    // Recover older inconsistent order metadata without dropping persisted exercises.
  }
  const exercises = workout.exercises.map((ex, index) => ({ kind: 'exercise' as const, index, compound: ex.exercise.category === 'compound' }));
  if (!workout.supersets?.length) return exercises.map(({ kind, index }) => ({ kind, index }));
  return [
    ...exercises.filter(e => e.compound).map(({ kind, index }) => ({ kind, index })),
    ...workout.supersets.map((_, index) => ({ kind: 'superset' as const, index })),
    ...exercises.filter(e => !e.compound).map(({ kind, index }) => ({ kind, index })),
  ];
}

export function convertExerciseToSuperset(workout: GeneratedWorkout, target: number, pair: SupersetPair): GeneratedWorkout {
  if (!workout.exercises[target]) throw new Error('This exercise is no longer available.');
  const exercises: GeneratedWorkout['exercises'] = [];
  const supersets: SupersetPair[] = [];
  const itemOrder: NonNullable<GeneratedWorkout['itemOrder']> = [];
  for (const item of getWorkoutOrder(workout)) {
    if (item.kind === 'exercise' && item.index !== target) {
      exercises.push(workout.exercises[item.index]); itemOrder.push({ kind: 'exercise' });
    } else {
      supersets.push(item.kind === 'superset' ? workout.supersets![item.index] : pair);
      itemOrder.push({ kind: 'superset' });
    }
  }
  return { ...workout, exercises, supersets, itemOrder };
}
