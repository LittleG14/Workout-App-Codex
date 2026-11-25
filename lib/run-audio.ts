import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { createRunAudioQueue } from './run-milestones';
import { createAudioOwnership } from './audio-ownership';
interface RunAudioModule {
  prepareAsync(): Promise<void>; playAsync(kind: string, text: string): Promise<void>; stopAsync(): Promise<void>;
  circuitClockMs?: () => number;
  requestCircuitNotificationsAsync?: () => Promise<boolean>;
  scheduleCircuitNotificationsAsync?: (sessionId: string, delays: number[]) => Promise<number>;
  cancelCircuitNotificationsAsync?: () => Promise<void>;
}
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<RunAudioModule>('SwoleRunAudio') : null;
const runKey = Symbol('run'), circuitKey = Symbol('circuit');
const audio = createAudioOwnership({ play: async (kind, text) => {
  if (!native) throw new Error('Workout audio requires the installed iOS native build. Visual timing remains available.');
  await native.playAsync(kind, text);
}, stop: async () => { if (native) await native.stopAsync(); } });
export const runAudioAvailable = !!native;
export async function prepareRunAudio() { if (native) await native.prepareAsync(); }
export const runAudio = createRunAudioQueue({
  play: async (event, text) => {
    if (!native) throw new Error('Audio milestones require the new iOS native build. Visual milestones remain available.');
    await audio.play(runKey, event.type, text);
  },
  stop: () => audio.stop(runKey),
});
export const circuitChime = { play: () => audio.play(circuitKey, 'sound', ''), stop: () => audio.stop(circuitKey) };
export function continuousCircuitMilliseconds(): number | null {
  try { const value = native?.circuitClockMs?.(); return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  catch { return null; }
}
export const circuitNotificationsAvailable = !!native?.scheduleCircuitNotificationsAsync;
export const requestCircuitNotifications = async () => {
  if (!native?.requestCircuitNotificationsAsync) throw new Error('Locked-screen chimes require the updated iOS binary. Foreground chimes still use the existing audio module.');
  return native.requestCircuitNotificationsAsync();
};
export const scheduleCircuitNotifications = async (id: string, delays: number[]) => {
  if (!native?.scheduleCircuitNotificationsAsync) throw new Error('Locked-screen chimes are unavailable in this build.');
  return native.scheduleCircuitNotificationsAsync(id, delays);
};
export const cancelCircuitNotifications = async () => { await native?.cancelCircuitNotificationsAsync?.(); };
