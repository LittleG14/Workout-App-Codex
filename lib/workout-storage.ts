import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch } from 'expo/fetch';
import { getApiUrl } from './api-url';
import { getTokenForAccount } from './auth-storage';
import { assertAccountScope } from './account-scope';
import { createWorkoutRepository } from './workout-repository';
import { withRequestTimeout } from './request-timeout';

const repository = createWorkoutRepository(AsyncStorage, async (scope, method, path, body) => {
  const token = await getTokenForAccount(scope);
  assertAccountScope(scope);
  const response = await withRequestTimeout(signal => fetch(new URL(path, getApiUrl()).toString(), {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  }));
  assertAccountScope(scope);
  if (method === 'GET' && response.ok) {
    const data = await response.json();
    assertAccountScope(scope);
    return { status: response.status, workouts: data.workouts };
  }
  return { status: response.status };
});

export const { saveWorkout, updateWorkout, deleteWorkout, getLocalWorkoutsOnly,
  getWorkouts, syncLocalWorkoutsToServer, clearAccount: clearAccountWorkouts,
  pendingCount: getPendingWorkoutCount } = repository;
