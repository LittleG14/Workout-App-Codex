import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeneratedWorkout } from './exercises';

const STORAGE_KEY = 'ironforge_workouts';

function migrateWorkout(w: any): GeneratedWorkout {
  if (!w.topCategory) {
    return {
      ...w,
      topCategory: 'weight_lifting',
      subType: w.workoutType || 'chest_triceps',
      style: w.style || 'hypertrophy',
    };
  }
  return w;
}

export async function saveWorkout(workout: GeneratedWorkout): Promise<void> {
  const existing = await getWorkouts();
  existing.unshift(workout);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export async function getWorkouts(): Promise<GeneratedWorkout[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  const parsed = JSON.parse(data);
  return parsed.map(migrateWorkout);
}

export async function deleteWorkout(id: string): Promise<void> {
  const existing = await getWorkouts();
  const filtered = existing.filter(w => w.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
