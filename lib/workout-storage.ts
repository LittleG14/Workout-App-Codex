import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeneratedWorkout } from './exercises';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { getToken } from '@/lib/auth-storage';
import { fetch } from 'expo/fetch';

const LOCAL_KEY = 'ironforge_workouts';

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

async function getLocalWorkouts(): Promise<GeneratedWorkout[]> {
  const data = await AsyncStorage.getItem(LOCAL_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return parsed.map(migrateWorkout);
  } catch {
    return [];
  }
}

async function setLocalWorkouts(workouts: GeneratedWorkout[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(workouts));
}

async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

async function serverFetch(method: string, path: string, body?: unknown): Promise<any> {
  try {
    const baseUrl = getApiUrl();
    const url = new URL(path, baseUrl);
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveWorkout(workout: GeneratedWorkout): Promise<void> {
  const local = await getLocalWorkouts();
  const filtered = local.filter(w => w.id !== workout.id);
  await setLocalWorkouts([workout, ...filtered]);

  if (await isLoggedIn()) {
    await serverFetch('POST', '/api/workouts', workout);
  }
}

export async function getWorkouts(): Promise<GeneratedWorkout[]> {
  if (await isLoggedIn()) {
    const result = await serverFetch('GET', '/api/workouts');
    if (result?.workouts) {
      const serverWorkouts: GeneratedWorkout[] = result.workouts.map(migrateWorkout);
      await setLocalWorkouts(serverWorkouts);
      return serverWorkouts;
    }
  }
  return getLocalWorkouts();
}

export async function updateWorkout(workout: GeneratedWorkout): Promise<void> {
  const local = await getLocalWorkouts();
  const idx = local.findIndex(w => w.id === workout.id);
  if (idx !== -1) {
    local[idx] = workout;
    await setLocalWorkouts(local);
  }

  if (await isLoggedIn()) {
    await serverFetch('PUT', `/api/workouts/${workout.id}`, workout);
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  const local = await getLocalWorkouts();
  await setLocalWorkouts(local.filter(w => w.id !== id));

  if (await isLoggedIn()) {
    await serverFetch('DELETE', `/api/workouts/${id}`);
  }
}

export async function syncLocalWorkoutsToServer(): Promise<void> {
  if (!(await isLoggedIn())) return;

  const local = await getLocalWorkouts();
  if (local.length === 0) return;

  const result = await serverFetch('GET', '/api/workouts');
  const serverIds = new Set<string>(
    (result?.workouts ?? []).map((w: GeneratedWorkout) => w.id)
  );

  const toSync = local.filter(w => !serverIds.has(w.id));
  await Promise.all(
    toSync.map(w => serverFetch('POST', '/api/workouts', w))
  );
}
