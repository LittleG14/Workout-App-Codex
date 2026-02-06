import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeneratedWorkout } from './exercises';

const STORAGE_KEY = 'ironforge_workouts';

export async function saveWorkout(workout: GeneratedWorkout): Promise<void> {
  const existing = await getWorkouts();
  existing.unshift(workout);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export async function getWorkouts(): Promise<GeneratedWorkout[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export async function deleteWorkout(id: string): Promise<void> {
  const existing = await getWorkouts();
  const filtered = existing.filter(w => w.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
