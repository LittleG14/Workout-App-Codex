import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { assertAccountScope, getAccountScope } from './account-scope';
import { createRunRepository, type RunDraft } from './run-repository';
import { supabase } from './supabase';

export const RUN_LOCATION_TASK = 'swolehouse-run-location-v1';
let watch: Location.LocationSubscription | null = null;
// Undefined means headless startup: resolve the owner from the persisted secure session.
let currentOwner: string | null | undefined;
const options: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000,
  activityType: Location.ActivityType.Fitness, pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: { notificationTitle: 'Swole House run in progress', notificationBody: 'Recording your route and distance. Open Swole House to pause or stop.', killServiceOnDestroy: true },
};
async function stopNative() {
  watch?.remove(); watch = null;
  if (Platform.OS !== 'web' && await TaskManager.isAvailableAsync() && await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
  }
}
async function startNative(mode: RunDraft['mode']) {
  await stopNative();
  if (mode === 'background') {
    if (Platform.OS === 'web' || !await TaskManager.isAvailableAsync()) throw new Error('Background tracking requires an installed development or production build.');
    if (!(await Location.getBackgroundPermissionsAsync()).granted) throw new Error('Allow background location in Settings to resume locked-screen tracking.');
    await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, options);
  } else {
    watch = await Location.watchPositionAsync(options, location => {
      void runs.locations([{ ...location.coords, timestamp: location.timestamp }]).catch(() => {
        void stopNative().catch(() => {});
      });
    }, () => { void runs.failure('Location tracking failed. Check permissions and resume.').catch(() => { void stopNative().catch(() => {}); }); });
  }
}
export const runs = createRunRepository({ storage: AsyncStorage,
  userId: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const owner = session?.user.id ?? null;
    return currentOwner === undefined || currentOwner === owner ? owner : null;
  }, now: Date.now, id: Crypto.randomUUID, start: startNative, stop: stopNative,
});

// Must be evaluated at module scope, including when iOS starts a headless task.
if (!TaskManager.isTaskDefined(RUN_LOCATION_TASK)) TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(RUN_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) { await runs.failure('Background location was interrupted. Check location access and resume.'); return; }
    await runs.locations((data?.locations ?? []).map(location => ({ ...location.coords, timestamp: location.timestamp })));
  } catch {
    // Storage/auth failure must never leave an unowned GPS service running.
    await stopNative().catch(() => {});
  }
});

export function runAccountChanged(userId: string | null) {
  setRunOwner(userId);
  return runs.accountChanged(userId);
}
export function setRunOwner(userId: string | null) { currentOwner = userId; }
export function settleRunAccount() { return runs.accountChanged(currentOwner ?? null); }
export async function ownRun() {
  const scope = getAccountScope(); const run = await runs.get(scope.userId); assertAccountScope(scope);
  if (!run) return null;
  const running = run.mode === 'background' && Platform.OS !== 'web'
    ? await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK) : !!watch;
  assertAccountScope(scope);
  const recovered = await runs.reconcile(scope.userId, running); assertAccountScope(scope); return recovered;
}
/** Keeps logout and late native callbacks on the same serialized writer. */
export async function pauseRunBeforeLogout() {
  await runAccountChanged(null);
}
export async function pauseForegroundRun() {
  if (!currentOwner) return;
  const run = await runs.get(currentOwner);
  if (run?.mode === 'foreground' && run.status === 'running') await runs.pause(run.userId, run.id);
}
export async function requestRunMode(): Promise<RunDraft['mode']> {
  if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error('Location access is required to record your route. Enable it in Settings.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Turn on Location Services to record a run.');
  if (Platform.OS === 'web' || !await TaskManager.isAvailableAsync()) return 'foreground';
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted ? 'background' : 'foreground';
}
