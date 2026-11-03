import type { Exercise, WorkoutExercise, GeneratedWorkout } from './exercises';

const weightKg = (weight: number, unit?: string) => unit === 'kg' ? weight : weight * 0.45359237;
const distanceKm = (distance: number, unit: 'miles' | 'km') => unit === 'km' ? distance : distance * 1.609344;
const pacePerKm = (pace: number, unit: 'miles' | 'km') => unit === 'km' ? pace : pace / 1.609344;

export interface ExercisePR {
  exercise: Exercise;
  prWeight?: number;
  prWeightUnit?: string;
  prReps?: string;
  prDate?: string;
  lastWeight?: number;
  lastWeightUnit?: string;
  lastReps?: string;
  lastDate?: string;
  lastNotes?: string;
}

export type PRCategory = "weight_lifting" | "circuit" | "yoga" | "cardio" | "mobility";

export function computePRs(
  workouts: GeneratedWorkout[],
  exerciseList: Exercise[],
  category: PRCategory,
  hiddenIds?: string[],
  resetTimestamps?: Record<string, string>
): ExercisePR[] {
  const prMap = new Map<string, ExercisePR>();

  exerciseList.forEach((ex) => {
    if (!hiddenIds?.includes(ex.id)) {
      prMap.set(ex.id, { exercise: ex });
    }
  });

  const sorted = [...workouts]
    .filter((w) => w.topCategory === category)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  sorted.forEach((w) => {
    const allExercises: { ex: WorkoutExercise; date: string }[] = [];

    w.exercises.forEach((ex) => allExercises.push({ ex, date: w.createdAt }));

    if (w.supersets) {
      w.supersets.forEach((ss) => {
        allExercises.push({ ex: ss.exerciseA, date: w.createdAt });
        allExercises.push({ ex: ss.exerciseB, date: w.createdAt });
      });
    }

    if (w.circuitBlocks) {
      w.circuitBlocks.forEach((block) => {
        block.exercises.forEach((ex) =>
          allExercises.push({ ex, date: w.createdAt })
        );
      });
    }

    allExercises.forEach(({ ex, date }) => {
      const exId = ex.exercise.id;
      if (hiddenIds?.includes(exId)) return;
      if (!prMap.has(exId)) {
        prMap.set(exId, { exercise: ex.exercise });
      }
      const entry = prMap.get(exId);
      if (!entry) return;

      const resetDate = resetTimestamps?.[exId];
      if (resetDate && new Date(date) <= new Date(resetDate)) return;

      if (ex.weight && Number.isFinite(ex.weight) && ex.weight > 0) {
        if (!entry.prWeight || weightKg(ex.weight, ex.weightUnit) > weightKg(entry.prWeight, entry.prWeightUnit)) {
          entry.prWeight = ex.weight;
          entry.prWeightUnit = ex.weightUnit || "lbs";
          entry.prReps = ex.reps;
          entry.prDate = date;
        }
      }

      if (!entry.lastDate) {
        entry.lastWeight = ex.weight;
        entry.lastWeightUnit = ex.weightUnit || "lbs";
        entry.lastReps = ex.reps;
        entry.lastDate = date;
        entry.lastNotes = ex.userNotes;
      }
    });
  });

  return Array.from(prMap.values());
}

export interface JustRunPRs {
  fastestPaceRun: { pace: number; distance: number; time: number; unit: 'miles' | 'km'; date: string } | null;
  farthestDistanceRun: { distance: number; pace: number; time: number; unit: 'miles' | 'km'; date: string } | null;
}

export function computeJustRunPRs(workouts: GeneratedWorkout[]): JustRunPRs {
  const runs = workouts.filter(w => w.subType === "just_run" && w.runData);

  let fastestPaceRun: JustRunPRs["fastestPaceRun"] = null;
  let farthestDistanceRun: JustRunPRs["farthestDistanceRun"] = null;

  runs.forEach(w => {
    const rd = w.runData!;
    const unit = rd.unit;
    const dist = unit === "miles" ? rd.distanceMiles : rd.distanceKm;
    const pace = unit === "miles" ? rd.paceSecsPerMile : rd.paceSecsPerKm;
    const time = rd.durationSeconds;

    if (pace > 0 && isFinite(pace)) {
      if (!fastestPaceRun || pacePerKm(pace, unit) < pacePerKm(fastestPaceRun.pace, fastestPaceRun.unit)) {
        fastestPaceRun = { pace, distance: dist, time, unit, date: w.createdAt };
      }
    }

    if (dist > 0 && Number.isFinite(dist)) {
      if (!farthestDistanceRun || distanceKm(dist, unit) > distanceKm(farthestDistanceRun.distance, farthestDistanceRun.unit)) {
        farthestDistanceRun = { distance: dist, pace, time, unit, date: w.createdAt };
      }
    }
  });

  return { fastestPaceRun, farthestDistanceRun };
}

