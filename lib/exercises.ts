export type TopCategory = 'weight_lifting' | 'circuit' | 'yoga' | 'cardio';

export type MuscleGroup = 'chest' | 'triceps' | 'back' | 'biceps' | 'shoulders' | 'abs' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'full_body';

export type WeightLiftingType = 'chest_triceps' | 'back_biceps' | 'shoulders_abs' | 'legs' | 'full_body' | 'push' | 'pull';
export type CircuitStyle = 'amrap' | 'emom' | 'rounds_for_time' | 'hyrox';
export type YogaStyle = 'core_strength' | 'flexibility';
export type CardioStyle = 'running' | 'mixed_cardio';

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
  notes?: string;
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  userNotes?: string;
}

export interface CircuitBlock {
  name: string;
  format: string;
  timeCapMinutes?: number;
  rounds?: number;
  exercises: WorkoutExercise[];
}

export interface SupersetPair {
  exerciseA: WorkoutExercise;
  exerciseB: WorkoutExercise;
}

export type CircuitBalance = 'default' | 'more_movements' | 'more_rounds';

export interface GeneratedWorkout {
  id: string;
  name: string;
  topCategory: TopCategory;
  subType: string;
  style: string;
  durationMinutes: number;
  exercises: WorkoutExercise[];
  circuitBlocks?: CircuitBlock[];
  supersets?: SupersetPair[];
  circuitBalance?: CircuitBalance;
  createdAt: string;
}

export const TOP_CATEGORY_LABELS: Record<TopCategory, string> = {
  weight_lifting: 'Weight Lifting',
  circuit: 'Circuit Training',
  yoga: 'Yoga',
  cardio: 'Cardio',
};

export const TOP_CATEGORY_ICONS: Record<TopCategory, { name: string; set: 'ionicons' | 'mci' }> = {
  weight_lifting: { name: 'barbell', set: 'ionicons' },
  circuit: { name: 'flash', set: 'ionicons' },
  yoga: { name: 'meditation', set: 'mci' },
  cardio: { name: 'heart', set: 'ionicons' },
};

export const WEIGHT_LIFTING_LABELS: Record<WeightLiftingType, string> = {
  chest_triceps: 'Chest & Triceps',
  back_biceps: 'Back & Biceps',
  shoulders_abs: 'Shoulders & Abs',
  legs: 'Legs',
  full_body: 'Full Body',
  push: 'Push',
  pull: 'Pull',
};

export const CIRCUIT_STYLE_LABELS: Record<CircuitStyle, string> = {
  amrap: 'AMRAP',
  emom: 'EMOM',
  rounds_for_time: 'Rounds for Time',
  hyrox: 'Hyrox Style',
};

export const YOGA_STYLE_LABELS: Record<YogaStyle, string> = {
  core_strength: 'Core Strength',
  flexibility: 'Flexibility',
};

export const CARDIO_STYLE_LABELS: Record<CardioStyle, string> = {
  running: 'Running',
  mixed_cardio: 'Mixed Cardio',
};

function getExercisePool(topCategory: TopCategory, subType: string): Exercise[] {
  switch (topCategory) {
    case 'weight_lifting':
      return WEIGHT_EXERCISES;
    case 'circuit':
      return CIRCUIT_EXERCISES;
    case 'yoga':
      return subType === 'flexibility' ? YOGA_FLEX_POSES : YOGA_CORE_POSES;
    case 'cardio':
      return subType === 'running' ? CARDIO_RUNNING : CARDIO_MIXED;
    default:
      return [];
  }
}

export function findReplacementExercise(
  current: Exercise,
  topCategory: TopCategory,
  subType: string,
  usedIds: string[]
): Exercise | null {
  const pool = getExercisePool(topCategory, subType);

  const candidates = pool.filter(e =>
    e.id !== current.id &&
    !usedIds.includes(e.id) &&
    e.category === current.category &&
    e.muscles.some(m => current.muscles.includes(m))
  );

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const looseCandidates = pool.filter(e =>
    e.id !== current.id &&
    !usedIds.includes(e.id) &&
    e.category === current.category
  );

  if (looseCandidates.length > 0) {
    return looseCandidates[Math.floor(Math.random() * looseCandidates.length)];
  }

  return null;
}

export const WORKOUT_TYPE_MUSCLES: Record<WeightLiftingType, MuscleGroup[]> = {
  chest_triceps: ['chest', 'triceps'],
  back_biceps: ['back', 'biceps'],
  shoulders_abs: ['shoulders', 'abs'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  full_body: ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
};

export const WEIGHT_EXERCISES: Exercise[] = [
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
  { id: 'e66', name: 'Lineman Press', muscles: ['chest', 'triceps'], category: 'isolation', equipment: 'Dumbbells' },
  { id: 'e67', name: 'Dead Bench Press', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Barbell' },
  { id: 'e68', name: 'Wide Grip Bench Press', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Barbell' },
];

export const CIRCUIT_EXERCISES: Exercise[] = [
  { id: 'c1', name: 'Wall Balls', muscles: ['quads', 'shoulders'], category: 'compound', equipment: 'Medicine Ball' },
  { id: 'c2', name: 'Box Jumps', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Plyo Box' },
  { id: 'c3', name: 'Burpees', muscles: ['full_body'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'c4', name: 'Kettlebell Swings', muscles: ['hamstrings', 'glutes'], category: 'compound', equipment: 'Kettlebell' },
  { id: 'c5', name: 'Thrusters', muscles: ['quads', 'shoulders'], category: 'compound', equipment: 'Barbell' },
  { id: 'c6', name: 'Power Clean', muscles: ['full_body'], category: 'compound', equipment: 'Barbell' },
  { id: 'c7', name: 'Rowing Machine', muscles: ['back', 'quads'], category: 'compound', equipment: 'Rower' },
  { id: 'c8', name: 'Assault Bike', muscles: ['full_body'], category: 'compound', equipment: 'Bike' },
  { id: 'c9', name: 'Double Unders', muscles: ['calves'], category: 'isolation', equipment: 'Jump Rope' },
  { id: 'c10', name: 'Toes-to-Bar', muscles: ['abs'], category: 'isolation', equipment: 'Pull-Up Bar' },
  { id: 'c11', name: 'Sled Push', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Sled' },
  { id: 'c12', name: 'Sled Pull', muscles: ['back', 'hamstrings'], category: 'compound', equipment: 'Sled' },
  { id: 'c13', name: 'Farmers Carry', muscles: ['full_body'], category: 'compound', equipment: 'Dumbbells' },
  { id: 'c14', name: 'Ski Erg', muscles: ['back', 'shoulders'], category: 'compound', equipment: 'Ski Erg' },
  { id: 'c15', name: 'Sandbag Lunges', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Sandbag' },
  { id: 'c16', name: 'Battle Ropes', muscles: ['shoulders', 'abs'], category: 'compound', equipment: 'Ropes' },
  { id: 'c17', name: 'Medicine Ball Slams', muscles: ['full_body'], category: 'compound', equipment: 'Medicine Ball' },
  { id: 'c18', name: 'Muscle-Ups', muscles: ['back', 'triceps'], category: 'compound', equipment: 'Rings' },
  { id: 'c19', name: 'Handstand Push-Ups', muscles: ['shoulders', 'triceps'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'c20', name: 'Rope Climb', muscles: ['back', 'biceps'], category: 'compound', equipment: 'Rope' },
  { id: 'c21', name: 'Dumbbell Snatches', muscles: ['full_body'], category: 'compound', equipment: 'Dumbbell' },
  { id: 'c22', name: 'Deadball Over Shoulder', muscles: ['full_body'], category: 'compound', equipment: 'Deadball' },
  { id: 'c23', name: 'Bar Facing Burpees', muscles: ['full_body'], category: 'compound', equipment: 'Barbell' },
  { id: 'c24', name: 'Clean & Jerk', muscles: ['full_body'], category: 'compound', equipment: 'Barbell' },
];

export const YOGA_CORE_POSES: Exercise[] = [
  { id: 'y1', name: 'Boat Pose (Navasana)', muscles: ['abs'], category: 'isolation', equipment: 'Mat' },
  { id: 'y2', name: 'Plank Pose', muscles: ['abs', 'shoulders'], category: 'compound', equipment: 'Mat' },
  { id: 'y3', name: 'Side Plank (Vasisthasana)', muscles: ['abs', 'shoulders'], category: 'compound', equipment: 'Mat' },
  { id: 'y4', name: 'Crow Pose (Bakasana)', muscles: ['abs', 'shoulders'], category: 'compound', equipment: 'Mat' },
  { id: 'y5', name: 'Dolphin Pose', muscles: ['shoulders', 'abs'], category: 'compound', equipment: 'Mat' },
  { id: 'y6', name: 'Chair Pose (Utkatasana)', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Mat' },
  { id: 'y7', name: 'Warrior III (Virabhadrasana III)', muscles: ['glutes', 'abs'], category: 'compound', equipment: 'Mat' },
  { id: 'y8', name: 'Chaturanga Dandasana', muscles: ['chest', 'triceps'], category: 'compound', equipment: 'Mat' },
  { id: 'y9', name: 'Forearm Plank', muscles: ['abs'], category: 'isolation', equipment: 'Mat' },
  { id: 'y10', name: 'Bridge Pose (Setu Bandhasana)', muscles: ['glutes', 'abs'], category: 'compound', equipment: 'Mat' },
  { id: 'y11', name: 'Locust Pose (Salabhasana)', muscles: ['back', 'glutes'], category: 'compound', equipment: 'Mat' },
  { id: 'y12', name: 'Half Moon Pose', muscles: ['abs', 'glutes'], category: 'compound', equipment: 'Mat' },
  { id: 'y13', name: 'Bicycle Crunches', muscles: ['abs'], category: 'isolation', equipment: 'Mat' },
  { id: 'y14', name: 'Leg Lifts', muscles: ['abs'], category: 'isolation', equipment: 'Mat' },
];

export const YOGA_FLEX_POSES: Exercise[] = [
  { id: 'yf1', name: 'Downward Dog (Adho Mukha Svanasana)', muscles: ['hamstrings', 'shoulders'], category: 'compound', equipment: 'Mat' },
  { id: 'yf2', name: 'Pigeon Pose (Eka Pada Rajakapotasana)', muscles: ['glutes', 'hamstrings'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf3', name: 'Forward Fold (Uttanasana)', muscles: ['hamstrings'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf4', name: 'Seated Forward Bend (Paschimottanasana)', muscles: ['hamstrings', 'back'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf5', name: 'Low Lunge (Anjaneyasana)', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'Mat' },
  { id: 'yf6', name: 'Lizard Pose (Utthan Pristhasana)', muscles: ['hamstrings', 'quads'], category: 'compound', equipment: 'Mat' },
  { id: 'yf7', name: 'Reclined Spinal Twist', muscles: ['back', 'abs'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf8', name: 'Butterfly Pose (Baddha Konasana)', muscles: ['glutes'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf9', name: 'Cat-Cow Stretch', muscles: ['back', 'abs'], category: 'compound', equipment: 'Mat' },
  { id: 'yf10', name: 'Cobra Pose (Bhujangasana)', muscles: ['back', 'abs'], category: 'compound', equipment: 'Mat' },
  { id: 'yf11', name: 'Triangle Pose (Trikonasana)', muscles: ['hamstrings', 'abs'], category: 'compound', equipment: 'Mat' },
  { id: 'yf12', name: 'Wide-Leg Forward Fold', muscles: ['hamstrings'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf13', name: "Child's Pose (Balasana)", muscles: ['back'], category: 'isolation', equipment: 'Mat' },
  { id: 'yf14', name: 'Warrior I (Virabhadrasana I)', muscles: ['quads', 'shoulders'], category: 'compound', equipment: 'Mat' },
  { id: 'yf15', name: 'Warrior II (Virabhadrasana II)', muscles: ['quads', 'shoulders'], category: 'compound', equipment: 'Mat' },
  { id: 'yf16', name: 'Happy Baby Pose', muscles: ['glutes', 'hamstrings'], category: 'isolation', equipment: 'Mat' },
];

export const CARDIO_RUNNING: Exercise[] = [
  { id: 'r1', name: 'Easy Pace Run', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'None' },
  { id: 'r2', name: 'Tempo Run', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'None' },
  { id: 'r3', name: '400m Intervals', muscles: ['quads'], category: 'compound', equipment: 'Track' },
  { id: 'r4', name: '800m Intervals', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'Track' },
  { id: 'r5', name: 'Hill Sprints', muscles: ['quads', 'glutes', 'calves'], category: 'compound', equipment: 'Hill' },
  { id: 'r6', name: 'Fartlek Run', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'None' },
  { id: 'r7', name: 'Long Slow Distance', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'None' },
  { id: 'r8', name: 'Sprint Intervals', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'None' },
  { id: 'r9', name: 'Recovery Jog', muscles: ['quads'], category: 'compound', equipment: 'None' },
  { id: 'r10', name: 'Strides', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'None' },
];

export const CARDIO_MIXED: Exercise[] = [
  { id: 'cm1', name: 'Rowing Machine', muscles: ['back', 'quads'], category: 'compound', equipment: 'Rower' },
  { id: 'cm2', name: 'Cycling / Spin Bike', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'Bike' },
  { id: 'cm3', name: 'Stairmaster', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Machine' },
  { id: 'cm4', name: 'Jump Rope', muscles: ['calves', 'shoulders'], category: 'compound', equipment: 'Jump Rope' },
  { id: 'cm5', name: 'Elliptical Trainer', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'Machine' },
  { id: 'cm6', name: 'Swimming', muscles: ['full_body'], category: 'compound', equipment: 'Pool' },
  { id: 'cm7', name: 'Assault Bike Intervals', muscles: ['full_body'], category: 'compound', equipment: 'Bike' },
  { id: 'cm8', name: 'Ski Erg', muscles: ['back', 'shoulders'], category: 'compound', equipment: 'Ski Erg' },
  { id: 'cm9', name: 'High Knees', muscles: ['quads', 'abs'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'cm10', name: 'Mountain Climbers', muscles: ['abs', 'shoulders'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'cm11', name: 'Jumping Jacks', muscles: ['full_body'], category: 'compound', equipment: 'Bodyweight' },
  { id: 'cm12', name: 'Box Step-Ups', muscles: ['quads', 'glutes'], category: 'compound', equipment: 'Plyo Box' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getStyleConfig(style: TrainingStyle) {
  if (style === 'strength') {
    return { compoundSets: 4, compoundReps: '4-6', isolationSets: 3, isolationReps: '6-8', compoundRest: 180, isolationRest: 120 };
  }
  return { compoundSets: 4, compoundReps: '8-12', isolationSets: 3, isolationReps: '12-15', compoundRest: 90, isolationRest: 60 };
}

function getExerciseCount(durationMinutes: number, style: TrainingStyle): { compounds: number; isolations: number } {
  if (durationMinutes <= 30) return style === 'strength' ? { compounds: 3, isolations: 1 } : { compounds: 2, isolations: 2 };
  if (durationMinutes <= 45) return style === 'strength' ? { compounds: 3, isolations: 2 } : { compounds: 3, isolations: 3 };
  if (durationMinutes <= 60) return style === 'strength' ? { compounds: 4, isolations: 2 } : { compounds: 3, isolations: 4 };
  return style === 'strength' ? { compounds: 5, isolations: 3 } : { compounds: 4, isolations: 5 };
}

function randomAdj(): string {
  const a = ['Iron', 'Beast', 'Forge', 'Titan', 'Power', 'Blitz', 'Grind', 'Surge', 'Fire', 'Storm'];
  return a[Math.floor(Math.random() * a.length)];
}

function generateWeightLifting(subType: WeightLiftingType, style: TrainingStyle, duration: number, includeSupersets: boolean = false): GeneratedWorkout {
  const muscles = WORKOUT_TYPE_MUSCLES[subType];
  const available = WEIGHT_EXERCISES.filter(e => e.muscles.some(m => muscles.includes(m)));
  const config = getStyleConfig(style);
  const counts = getExerciseCount(duration, style);

  const compounds = shuffle(available.filter(e => e.category === 'compound')).slice(0, counts.compounds);
  const isolations = shuffle(available.filter(e => e.category === 'isolation')).slice(0, counts.isolations);

  const exercises: WorkoutExercise[] = [
    ...compounds.map(exercise => ({ exercise, sets: config.compoundSets, reps: config.compoundReps, restSeconds: config.compoundRest })),
    ...isolations.map(exercise => ({ exercise, sets: config.isolationSets, reps: config.isolationReps, restSeconds: config.isolationRest })),
  ];

  let supersets: SupersetPair[] | undefined;

  if (includeSupersets && exercises.length >= 4) {
    const supersetCount = duration >= 60 ? 2 : 1;
    supersets = [];

    const usedIndices = new Set<number>();

    for (let s = 0; s < supersetCount && usedIndices.size < exercises.length - 1; s++) {
      let aIdx = -1;
      let bIdx = -1;

      for (let i = 0; i < exercises.length; i++) {
        if (usedIndices.has(i)) continue;
        for (let j = i + 1; j < exercises.length; j++) {
          if (usedIndices.has(j)) continue;
          const aMuscles = exercises[i].exercise.muscles;
          const bMuscles = exercises[j].exercise.muscles;
          const overlaps = aMuscles.some(m => bMuscles.includes(m));
          if (!overlaps) {
            aIdx = i;
            bIdx = j;
            break;
          }
        }
        if (aIdx >= 0) break;
      }

      if (aIdx < 0) {
        for (let i = 0; i < exercises.length; i++) {
          if (usedIndices.has(i)) continue;
          for (let j = i + 1; j < exercises.length; j++) {
            if (usedIndices.has(j)) continue;
            aIdx = i;
            bIdx = j;
            break;
          }
          if (aIdx >= 0) break;
        }
      }

      if (aIdx >= 0 && bIdx >= 0) {
        usedIndices.add(aIdx);
        usedIndices.add(bIdx);

        const ssRest = style === 'strength' ? 120 : 60;
        supersets.push({
          exerciseA: { ...exercises[aIdx], restSeconds: 0, notes: 'Superset - go straight to next exercise' },
          exerciseB: { ...exercises[bIdx], restSeconds: ssRest, notes: `Superset - rest ${ssRest}s after both exercises` },
        });

        exercises.splice(Math.max(aIdx, bIdx), 1);
        exercises.splice(Math.min(aIdx, bIdx), 1);
      }
    }

    if (supersets.length === 0) supersets = undefined;
  }

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: `${randomAdj()} ${WEIGHT_LIFTING_LABELS[subType]}`,
    topCategory: 'weight_lifting',
    subType,
    style,
    durationMinutes: duration,
    exercises,
    supersets,
    createdAt: new Date().toISOString(),
  };
}

function generateCircuit(circuitStyle: CircuitStyle, duration: number): GeneratedWorkout {
  const allExercises = shuffle(CIRCUIT_EXERCISES);
  let circuitBlocks: CircuitBlock[] = [];
  let flatExercises: WorkoutExercise[] = [];

  if (circuitStyle === 'amrap') {
    const exCount = duration <= 30 ? 5 : duration <= 45 ? 6 : 8;
    const selected = allExercises.slice(0, exCount);
    const blockExercises = selected.map(e => ({
      exercise: e,
      sets: 1,
      reps: e.category === 'compound' ? '10-15' : '15-20',
      restSeconds: 0,
      notes: 'As many rounds as possible',
    }));
    circuitBlocks = [{
      name: `${duration}-Minute AMRAP`,
      format: 'AMRAP',
      timeCapMinutes: duration,
      exercises: blockExercises,
    }];
    flatExercises = blockExercises;
  } else if (circuitStyle === 'emom') {
    const minutes = duration;
    const exCount = duration <= 30 ? 4 : duration <= 45 ? 5 : 6;
    const selected = allExercises.slice(0, exCount);
    const blockExercises = selected.map((e, i) => ({
      exercise: e,
      sets: 1,
      reps: e.category === 'compound' ? '8-10' : '12-15',
      restSeconds: 0,
      notes: `Minute ${i + 1} of each round`,
    }));
    const rounds = Math.floor(minutes / exCount);
    circuitBlocks = [{
      name: `EMOM ${minutes} min`,
      format: 'EMOM',
      timeCapMinutes: minutes,
      rounds,
      exercises: blockExercises,
    }];
    flatExercises = blockExercises;
  } else if (circuitStyle === 'rounds_for_time') {
    const exCount = duration <= 30 ? 5 : 6;
    const rounds = duration <= 30 ? 3 : duration <= 45 ? 4 : 5;
    const selected = allExercises.slice(0, exCount);
    const blockExercises = selected.map(e => ({
      exercise: e,
      sets: 1,
      reps: e.category === 'compound' ? '12' : '15',
      restSeconds: 0,
      notes: `Complete all rounds for time`,
    }));
    circuitBlocks = [{
      name: `${rounds} Rounds for Time`,
      format: 'Rounds for Time',
      rounds,
      timeCapMinutes: duration,
      exercises: blockExercises,
    }];
    flatExercises = blockExercises;
  } else {
    const hyroxStations: Exercise[] = shuffle([
      ...allExercises.filter(e => ['Sled Push', 'Sled Pull', 'Rowing Machine', 'Farmers Carry', 'Ski Erg', 'Sandbag Lunges', 'Wall Balls', 'Burpees'].includes(e.name)),
    ]);
    const stationCount = duration <= 30 ? 4 : duration <= 45 ? 6 : 8;
    const selected = hyroxStations.slice(0, stationCount);
    const runBetween: Exercise = { id: 'hx_run', name: '1km Run', muscles: ['quads', 'hamstrings'], category: 'compound', equipment: 'None' };

    const blockExercises: WorkoutExercise[] = [];
    selected.forEach((e, i) => {
      blockExercises.push({
        exercise: runBetween,
        sets: 1,
        reps: '1km',
        restSeconds: 0,
        notes: `Run before station ${i + 1}`,
      });
      blockExercises.push({
        exercise: e,
        sets: 1,
        reps: e.name === 'Sled Push' || e.name === 'Sled Pull' ? '50m' : e.name === 'Farmers Carry' ? '200m' : '50',
        restSeconds: 0,
        notes: `Station ${i + 1}`,
      });
    });

    circuitBlocks = [{
      name: 'Hyrox Simulation',
      format: 'Hyrox',
      timeCapMinutes: duration,
      exercises: blockExercises,
    }];
    flatExercises = blockExercises;
  }

  const styleNames: Record<CircuitStyle, string> = { amrap: 'AMRAP', emom: 'EMOM', rounds_for_time: 'RFT', hyrox: 'Hyrox' };
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: `${randomAdj()} ${styleNames[circuitStyle]}`,
    topCategory: 'circuit',
    subType: circuitStyle,
    style: circuitStyle,
    durationMinutes: duration,
    exercises: flatExercises,
    circuitBlocks,
    createdAt: new Date().toISOString(),
  };
}

function generateYoga(yogaStyle: YogaStyle, duration: number): GeneratedWorkout {
  const pool = yogaStyle === 'core_strength' ? YOGA_CORE_POSES : YOGA_FLEX_POSES;
  const selected = shuffle(pool);

  const poseCount = duration <= 30 ? 8 : duration <= 45 ? 10 : duration <= 60 ? 14 : 18;
  const holdTime = yogaStyle === 'core_strength' ? '30-45s' : '45-60s';
  const sets = yogaStyle === 'core_strength' ? 3 : 2;

  const poses = selected.slice(0, poseCount);
  const exercises: WorkoutExercise[] = poses.map(exercise => ({
    exercise,
    sets,
    reps: holdTime,
    restSeconds: yogaStyle === 'core_strength' ? 15 : 10,
    notes: yogaStyle === 'core_strength' ? 'Hold with engagement' : 'Breathe and relax into pose',
  }));

  const label = yogaStyle === 'core_strength' ? 'Core Power' : 'Deep Stretch';
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: `${randomAdj()} ${label}`,
    topCategory: 'yoga',
    subType: yogaStyle,
    style: yogaStyle,
    durationMinutes: duration,
    exercises,
    createdAt: new Date().toISOString(),
  };
}

function generateCardio(cardioStyle: CardioStyle, duration: number): GeneratedWorkout {
  if (cardioStyle === 'running') {
    const pool = shuffle(CARDIO_RUNNING);
    let exercises: WorkoutExercise[] = [];

    if (duration <= 30) {
      const main = pool.filter(e => ['Tempo Run', 'Fartlek Run', '400m Intervals', 'Sprint Intervals'].includes(e.name));
      const warmup = pool.find(e => e.name === 'Easy Pace Run')!;
      exercises = [
        { exercise: warmup, sets: 1, reps: '5 min', restSeconds: 0, notes: 'Warm-up' },
        { exercise: main[0] || pool[0], sets: 1, reps: '20 min', restSeconds: 0, notes: 'Main block' },
        { exercise: warmup, sets: 1, reps: '5 min', restSeconds: 0, notes: 'Cool-down' },
      ];
    } else if (duration <= 45) {
      const warmup = pool.find(e => e.name === 'Easy Pace Run')!;
      const intervals = pool.find(e => e.name === '800m Intervals' || e.name === '400m Intervals')!;
      const strides = pool.find(e => e.name === 'Strides')!;
      exercises = [
        { exercise: warmup, sets: 1, reps: '10 min', restSeconds: 0, notes: 'Warm-up' },
        { exercise: intervals, sets: 6, reps: '1 rep', restSeconds: 90, notes: '90s recovery between reps' },
        { exercise: strides || warmup, sets: 4, reps: '100m', restSeconds: 60, notes: 'Build to 90% effort' },
        { exercise: warmup, sets: 1, reps: '5 min', restSeconds: 0, notes: 'Cool-down' },
      ];
    } else {
      const warmup = pool.find(e => e.name === 'Easy Pace Run')!;
      const tempo = pool.find(e => e.name === 'Tempo Run')!;
      const hills = pool.find(e => e.name === 'Hill Sprints')!;
      const fartlek = pool.find(e => e.name === 'Fartlek Run')!;
      exercises = [
        { exercise: warmup, sets: 1, reps: '10 min', restSeconds: 0, notes: 'Easy warm-up' },
        { exercise: tempo || fartlek, sets: 1, reps: `${Math.floor(duration * 0.4)} min`, restSeconds: 0, notes: 'Comfortably hard pace' },
        { exercise: hills || pool[2], sets: 5, reps: '30s', restSeconds: 90, notes: 'Hard uphill effort' },
        { exercise: warmup, sets: 1, reps: '10 min', restSeconds: 0, notes: 'Cool-down jog' },
      ];
    }

    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: `${randomAdj()} Run`,
      topCategory: 'cardio',
      subType: 'running',
      style: 'running',
      durationMinutes: duration,
      exercises,
      createdAt: new Date().toISOString(),
    };
  }

  const pool = shuffle(CARDIO_MIXED);
  const exCount = duration <= 30 ? 3 : duration <= 45 ? 4 : duration <= 60 ? 5 : 6;
  const selected = pool.slice(0, exCount);
  const blockTime = Math.floor(duration / exCount);

  const exercises: WorkoutExercise[] = selected.map(exercise => ({
    exercise,
    sets: 1,
    reps: `${blockTime} min`,
    restSeconds: 60,
    notes: 'Moderate-high intensity',
  }));

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: `${randomAdj()} Cardio Mix`,
    topCategory: 'cardio',
    subType: 'mixed_cardio',
    style: 'mixed_cardio',
    durationMinutes: duration,
    exercises,
    createdAt: new Date().toISOString(),
  };
}

export function generateWorkout(
  topCategory: TopCategory,
  subType: string,
  style: string,
  durationMinutes: number,
  includeSupersets: boolean = false,
): GeneratedWorkout {
  switch (topCategory) {
    case 'weight_lifting':
      return generateWeightLifting(subType as WeightLiftingType, style as TrainingStyle, durationMinutes, includeSupersets);
    case 'circuit':
      return generateCircuit(subType as CircuitStyle, durationMinutes);
    case 'yoga':
      return generateYoga(subType as YogaStyle, durationMinutes);
    case 'cardio':
      return generateCardio(subType as CardioStyle, durationMinutes);
  }
}

export function getSubTypeLabel(topCategory: TopCategory, subType: string): string {
  switch (topCategory) {
    case 'weight_lifting': return WEIGHT_LIFTING_LABELS[subType as WeightLiftingType] || subType;
    case 'circuit': return CIRCUIT_STYLE_LABELS[subType as CircuitStyle] || subType;
    case 'yoga': return YOGA_STYLE_LABELS[subType as YogaStyle] || subType;
    case 'cardio': return CARDIO_STYLE_LABELS[subType as CardioStyle] || subType;
    default: return subType;
  }
}

export const DURATION_OPTIONS = [30, 45, 60, 90];

function getEmomConfig(duration: number, balance: CircuitBalance): { exCount: number; rounds: number } {
  if (balance === 'more_movements') {
    const exCount = duration <= 30 ? 6 : duration <= 45 ? 7 : duration <= 60 ? 8 : 9;
    return { exCount, rounds: Math.floor(duration / exCount) };
  }
  if (balance === 'more_rounds') {
    const exCount = duration <= 30 ? 3 : duration <= 45 ? 3 : duration <= 60 ? 4 : 5;
    return { exCount, rounds: Math.floor(duration / exCount) };
  }
  const exCount = duration <= 30 ? 4 : duration <= 45 ? 5 : 6;
  return { exCount, rounds: Math.floor(duration / exCount) };
}

function getRftConfig(duration: number, balance: CircuitBalance): { exCount: number; rounds: number } {
  if (balance === 'more_movements') {
    return duration <= 30 ? { exCount: 7, rounds: 2 }
      : duration <= 45 ? { exCount: 8, rounds: 3 }
      : duration <= 60 ? { exCount: 8, rounds: 3 }
      : { exCount: 9, rounds: 4 };
  }
  if (balance === 'more_rounds') {
    return duration <= 30 ? { exCount: 3, rounds: 5 }
      : duration <= 45 ? { exCount: 4, rounds: 6 }
      : duration <= 60 ? { exCount: 4, rounds: 7 }
      : { exCount: 5, rounds: 8 };
  }
  return duration <= 30 ? { exCount: 5, rounds: 3 }
    : duration <= 45 ? { exCount: 6, rounds: 4 }
    : duration <= 60 ? { exCount: 6, rounds: 5 }
    : { exCount: 6, rounds: 5 };
}

export function rebalanceCircuit(workout: GeneratedWorkout, balance: CircuitBalance): GeneratedWorkout {
  if (!workout.circuitBlocks || workout.circuitBlocks.length === 0) return workout;

  const block = workout.circuitBlocks[0];
  const format = block.format;
  if (format !== 'EMOM' && format !== 'Rounds for Time') return workout;

  const duration = workout.durationMinutes;
  const config = format === 'EMOM'
    ? getEmomConfig(duration, balance)
    : getRftConfig(duration, balance);

  const currentExercises = block.exercises;
  let newExercises: WorkoutExercise[];

  if (config.exCount <= currentExercises.length) {
    newExercises = currentExercises.slice(0, config.exCount);
  } else {
    const pool = shuffle([...CIRCUIT_EXERCISES]);
    const usedIds = new Set(currentExercises.map(e => e.exercise.id));
    const extras = pool.filter(e => !usedIds.has(e.id));
    newExercises = [...currentExercises];
    for (let i = 0; newExercises.length < config.exCount && i < extras.length; i++) {
      const e = extras[i];
      newExercises.push({
        exercise: e,
        sets: 1,
        reps: format === 'EMOM'
          ? (e.category === 'compound' ? '8-10' : '12-15')
          : (e.category === 'compound' ? '12' : '15'),
        restSeconds: 0,
        notes: format === 'EMOM'
          ? `Minute ${newExercises.length + 1} of each round`
          : 'Complete all rounds for time',
      });
    }
  }

  if (format === 'EMOM') {
    newExercises = newExercises.map((ex, i) => ({
      ...ex,
      notes: `Minute ${i + 1} of each round`,
    }));
  }

  const newBlock: CircuitBlock = {
    ...block,
    rounds: config.rounds,
    exercises: newExercises,
    name: format === 'EMOM'
      ? `EMOM ${duration} min`
      : `${config.rounds} Rounds for Time`,
  };

  return {
    ...workout,
    circuitBlocks: [newBlock],
    exercises: newExercises,
    circuitBalance: balance,
  };
}
