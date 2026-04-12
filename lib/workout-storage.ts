import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeneratedWorkout } from './exercises';
import { getApiUrl } from '@/lib/query-client';
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

async function readLocalWorkouts(): Promise<GeneratedWorkout[]> {
  const data = await AsyncStorage.getItem(LOCAL_KEY);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return parsed.map(migrateWorkout);
  } catch {
    return [];
  }
}

async function writeLocalWorkouts(workouts: GeneratedWorkout[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(workouts));
}

async function getAuthToken(): Promise<string | null> {
  return getToken();
}

async function isLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

async function serverFetch(method: string, path: string, body?: unknown): Promise<any> {
  try {
    const baseUrl = getApiUrl();
    const url = new URL(path, baseUrl);
    const token = await getAuthToken();
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

/**
 * Read workouts directly from local storage — no network call.
 * Use this for screens that need immediate access (e.g. workout detail
 * right after generating).
 */
export async function getLocalWorkoutsOnly(): Promise<GeneratedWorkout[]> {
  return readLocalWorkouts();
}

export async function saveWorkout(workout: GeneratedWorkout): Promise<void> {
  const local = await readLocalWorkouts();
  const filtered = local.filter(w => w.id !== workout.id);
  await writeLocalWorkouts([workout, ...filtered]);

  if (await isLoggedIn()) {
    serverFetch('POST', '/api/workouts', workout).catch(() => {});
  }
}

/**
 * Get workouts, preferring server data when available.
 * Falls back to local cache if the server is unreachable or returns empty
 * but local has data (protects against false-empty responses).
 */
export async function getWorkouts(): Promise<GeneratedWorkout[]> {
  const local = await readLocalWorkouts();

  if (!(await isLoggedIn())) {
    return local;
  }

  const result = await serverFetch('GET', '/api/workouts');

  if (!result?.workouts) {
    return local;
  }

  const serverWorkouts: GeneratedWorkout[] = result.workouts.map(migrateWorkout);

  if (serverWorkouts.length > 0) {
    await writeLocalWorkouts(serverWorkouts);
    return serverWorkouts;
  }

  // Server returned empty — keep local data to avoid wiping workouts
  // that failed to sync (e.g. FK errors, temporary network issues).
  return local;
}

export async function updateWorkout(workout: GeneratedWorkout): Promise<void> {
  const local = await readLocalWorkouts();
  const idx = local.findIndex(w => w.id === workout.id);
  if (idx !== -1) {
    local[idx] = workout;
    await writeLocalWorkouts(local);
  }

  if (await isLoggedIn()) {
    serverFetch('PUT', `/api/workouts/${workout.id}`, workout).catch(() => {});
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  const local = await readLocalWorkouts();
  await writeLocalWorkouts(local.filter(w => w.id !== id));

  if (await isLoggedIn()) {
    serverFetch('DELETE', `/api/workouts/${id}`).catch(() => {});
  }
}

export async function syncLocalWorkoutsToServer(): Promise<void> {
  if (!(await isLoggedIn())) return;

  const local = await readLocalWorkouts();
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
