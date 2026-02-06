export type MuscleGroup = 'chest' | 'triceps' | 'back' | 'biceps' | 'shoulders' | 'abs' | 'quads' | 'hamstrings' | 'glutes' | 'calves';

export type WorkoutType = 'chest_triceps' | 'back_biceps' | 'shoulders_abs' | 'legs' | 'full_body' | 'push' | 'pull';

export type TrainingStyle = 'strength' | 'hypertrophy';

export type ExerciseCategory = 'compound' | 'isolation';

export interface Exercise {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  category: ExerciseCategory;
  equipment: string;
}

export interface WorkoutExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface GeneratedWorkout {
  id: string;
  name: string;
  workoutType: WorkoutType;
  style: TrainingStyle;
  durationMinutes: number;
  exercises: WorkoutExercise[];
  createdAt: string;
}

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  chest_triceps: 'Chest & Triceps',
  back_biceps: 'Back & Biceps',
  shoulders_abs: 'Shoulders & Abs',
  legs: 'Legs',
  full_body: 'Full Body',
  push: 'Push',
  pull: 'Pull',
};

export const WORKOUT_TYPE_MUSCLES: Record<WorkoutType, MuscleGroup[]> = {
  chest_triceps: ['chest', 'triceps'],
  back_biceps: ['back', 'biceps'],
  shoulders_abs: ['shoulders', 'abs'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  full_body: ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
};

const EXERCISES: Exercise[] = [
  { id: 'e1', name: 'Barbell Bench Press', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Barbell' },
  { id: 'e2', name: 'Incline Dumbbell Press', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Dumbbells' },
  { id: 'e3', name: 'Dumbbell Flyes', muscles: ['chest'], category: 'isolation', equipment: 'Dumbbells' },
  { id: 'e4', name: 'Cable Crossover', muscles: ['chest'], category: 'isolation', equipment: 'Cable' },
  { id: 'e5', name: 'Decline Bench Press', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Barbell' },
  { id: 'e6', name: 'Push-Ups', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'e7', name: 'Chest Dips', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'e8', name: 'Machine Chest Press', muscles: ['chest'], category: 'compound', equipment: 'Machine' },
  { id: 'e9', name: 'Pec Deck Machine', muscles: ['chest'], category: 'isolation', equipment: 'Machine' },
  { id: 'e10', name: 'Incline Cable Flyes', muscles: ['chest'], category: 'isolation', equipment: 'Cable' },

  { id: 'e11', name: 'Tricep Dips', muscles: ['triceps'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'e12', name: 'Skull Crushers', muscles: ['triceps'], category: 'isolation', equipment: 'Barbell' },
  { id: 'e13', name: 'Tricep Pushdown', muscles: ['triceps'], category: 'isolation', equipment: 'Cable' },
  { id: 'e14', name: 'Overhead Tricep Extension', muscles: ['triceps'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e15', name: 'Close-Grip Bench Press', muscles: ['triceps', 'chest'], category: 'compound', equipment: 'Barbell' },
  { id: 'e16', name: 'Diamond Push-Ups', muscles: ['triceps', 'chest'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'e17', name: 'Tricep Kickbacks', muscles: ['triceps'], category: 'isolation', equipment: 'Dumbbell' },

  { id: 'e18', name: 'Barbell Row', muscles: ['back', 'biceps'], category: 'compound', equipment: 'Barbell' },
  { id: 'e19', name: 'Pull-Ups', muscles: ['back', 'biceps'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'e20', name: 'Lat Pulldown', muscles: ['back', 'biceps'], category: 'compound', equipment: 'Cable' },
  { id: 'e21', name: 'Seated Cable Row', muscles: ['back'], category: 'compound', equipment: 'Cable' },
  { id: 'e22', name: 'Dumbbell Row', muscles: ['back'], category: 'compound', equipment: 'Dumbbell' },
  { id: 'e23', name: 'T-Bar Row', muscles: ['back'], category: 'compound', equipment: 'Barbell' },
  { id: 'e24', name: 'Deadlift', muscles: ['back', 'hamstrings', 'glutes'], category: 'compound', equipment: 'Barbell' },
  { id: 'e25', name: 'Face Pulls', muscles: ['back', 'shoulders'], category: 'isolation', equipment: 'Cable' },
  { id: 'e26', name: 'Straight-Arm Pulldown', muscles: ['back'], category: 'isolation', equipment: 'Cable' },
  { id: 'e27', name: 'Chin-Ups', muscles: ['back', 'biceps'], category: 'compound', equipment: 'Bodyweight' },

  { id: 'e28', name: 'Barbell Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Barbell' },
  { id: 'e29', name: 'Dumbbell Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e30', name: 'Hammer Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e31', name: 'Preacher Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Barbell' },
  { id: 'e32', name: 'Cable Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Cable' },
  { id: 'e33', name: 'Incline Dumbbell Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e34', name: 'Concentration Curl', muscles: ['biceps'], category: 'isolation', equipment: 'Dumbbell' },

  { id: 'e35', name: 'Overhead Press', muscles: ['shoulders'], category: 'compound', equipment: 'Barbell' },
  { id: 'e36', name: 'Dumbbell Shoulder Press', muscles: ['shoulders'], category: 'compound', equipment: 'Dumbbell' },
  { id: 'e37', name: 'Lateral Raise', muscles: ['shoulders'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e38', name: 'Front Raise', muscles: ['shoulders'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e39', name: 'Rear Delt Fly', muscles: ['shoulders'], category: 'isolation', equipment: 'Dumbbell' },
  { id: 'e40', name: 'Arnold Press', muscles: ['shoulders'], category: 'compound', equipment: 'Dumbbell' },
  { id: 'e41', name: 'Upright Row', muscles: ['shoulders'], category: 'compound', equipment: 'Barbell' },
  { id: 'e42', name: 'Cable Lateral Raise', muscles: ['shoulders'], category: 'isolation', equipment: 'Cable' },

  { id: 'e43', name: 'Hanging Leg Raise', muscles: ['abs'], category: 'isolation', equipment: 'Bodyweight' },
  { id: 'e44', name: 'Cable Crunch', muscles: ['abs'], category: 'isolation', equipment: 'Cable' },
  { id: 'e45', name: 'Ab Wheel Rollout', muscles: ['abs'], category: 'isolation', equipment: 'Ab Wheel' },
  { id: 'e46', name: 'Plank', muscles: ['abs'], category: 'isolation', equipment: 'Bodyweight' },
  { id: 'e47', name: 'Russian Twist', muscles: ['abs'], category: 'isolation', equipment: 'Bodyweight' },
  { id: 'e48', name: 'Bicycle Crunch', muscles: ['abs'], category: 'isolation', equipment: 'Bodyweight' },
  { id: 'e49', name: 'Decline Sit-Ups', muscles: ['abs'], category: 'isolation', equipment: 'Bench' },

  { id: 'e50', name: 'Barbell Squat', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Barbell' },
  { id: 'e51', name: 'Front Squat', muscles: ['quads'], category: 'compound', equipment: 'Barbell' },
  { id: 'e52', name: 'Leg Press', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Machine' },
  { id: 'e53', name: 'Leg Extension', muscles: ['quads'], category: 'isolation', equipment: 'Machine' },
  { id: 'e54', name: 'Walking Lunges', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Dumbbell' },
  { id: 'e55', name: 'Bulgarian Split Squat', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Dumbbell' },
  { id: 'e56', name: 'Hack Squat', muscles: ['quads'], category: 'compound', equipment: 'Machine' },

  { id: 'e57', name: 'Romanian Deadlift', muscles: ['hamstrings', 'glutes'], category: 'compound', equipment: 'Barbell' },
  { id: 'e58', name: 'Leg Curl', muscles: ['hamstrings'], category: 'isolation', equipment: 'Machine' },
  { id: 'e59', name: 'Stiff-Leg Deadlift', muscles: ['hamstrings', 'glutes'], category: 'compound', equipment: 'Barbell' },
  { id: 'e60', name: 'Good Mornings', muscles: ['hamstrings', 'glutes'], category: 'compound', equipment: 'Barbell' },

  { id: 'e61', name: 'Hip Thrust', muscles: ['glutes'], category: 'compound', equipment: 'Barbell' },
  { id: 'e62', name: 'Glute Bridge', muscles: ['glutes'], category: 'isolation', equipment: 'Bodyweight' },
  { id: 'e63', name: 'Cable Kickback', muscles: ['glutes'], category: 'isolation', equipment: 'Cable' },

  { id: 'e64', name: 'Standing Calf Raise', muscles: ['calves'], category: 'isolation', equipment: 'Machine' },
  { id: 'e65', name: 'Seated Calf Raise', muscles: ['calves'], category: 'isolation', equipment: 'Machine' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getExercisesForMuscles(muscles: MuscleGroup[]): Exercise[] {
  return EXERCISES.filter(e => e.muscles.some(m => muscles.includes(m)));
}

function getStyleConfig(style: TrainingStyle) {
  if (style === 'strength') {
    return {
      compoundSets: 4,
      compoundReps: '4-6',
      isolationSets: 3,
      isolationReps: '6-8',
      compoundRest: 180,
      isolationRest: 120,
      avgTimePerSet: 3.5,
    };
  }
  return {
    compoundSets: 4,
    compoundReps: '8-12',
    isolationSets: 3,
    isolationReps: '12-15',
    compoundRest: 90,
    isolationRest: 60,
    avgTimePerSet: 2.5,
  };
}

function getExerciseCount(durationMinutes: number, style: TrainingStyle): { compounds: number; isolations: number } {
  const config = getStyleConfig(style);

  if (durationMinutes <= 30) {
    return style === 'strength'
      ? { compounds: 3, isolations: 1 }
      : { compounds: 2, isolations: 2 };
  }
  if (durationMinutes <= 45) {
    return style === 'strength'
      ? { compounds: 3, isolations: 2 }
      : { compounds: 3, isolations: 3 };
  }
  if (durationMinutes <= 60) {
    return style === 'strength'
      ? { compounds: 4, isolations: 2 }
      : { compounds: 3, isolations: 4 };
  }
  return style === 'strength'
    ? { compounds: 5, isolations: 3 }
    : { compounds: 4, isolations: 5 };
}

function getWorkoutName(workoutType: WorkoutType, style: TrainingStyle): string {
  const typeLabel = WORKOUT_TYPE_LABELS[workoutType];
  const styleLabel = style === 'strength' ? 'Strength' : 'Hypertrophy';
  const adjectives = ['Iron', 'Beast', 'Forge', 'Titan', 'Power', 'Blitz', 'Grind', 'Surge'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  return `${adj} ${typeLabel}`;
}

export function generateWorkout(
  workoutType: WorkoutType,
  style: TrainingStyle,
  durationMinutes: number,
): GeneratedWorkout {
  const muscles = WORKOUT_TYPE_MUSCLES[workoutType];
  const available = getExercisesForMuscles(muscles);
  const config = getStyleConfig(style);
  const counts = getExerciseCount(durationMinutes, style);

  const compounds = shuffle(available.filter(e => e.category === 'compound'));
  const isolations = shuffle(available.filter(e => e.category === 'isolation'));

  const selectedCompounds = compounds.slice(0, counts.compounds);
  const selectedIsolations = isolations.slice(0, counts.isolations);

  const workoutExercises: WorkoutExercise[] = [
    ...selectedCompounds.map(exercise => ({
      exercise,
      sets: config.compoundSets,
      reps: config.compoundReps,
      restSeconds: config.compoundRest,
    })),
    ...selectedIsolations.map(exercise => ({
      exercise,
      sets: config.isolationSets,
      reps: config.isolationReps,
      restSeconds: config.isolationRest,
    })),
  ];

  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

  return {
    id,
    name: getWorkoutName(workoutType, style),
    workoutType,
    style,
    durationMinutes,
    exercises: workoutExercises,
    createdAt: new Date().toISOString(),
  };
}

export const DURATION_OPTIONS = [30, 45, 60, 90];
