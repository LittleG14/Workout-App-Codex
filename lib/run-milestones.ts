import { METERS_PER_MILE } from './run-geometry';
export type RunNotificationType = 'sound' | 'update';
export interface RunMilestone { index: number; distance: number; unit: 'miles' | 'km'; elapsedSeconds: number; distanceMeters: number; at: number }
export function milestoneIndex(meters: number, unit: 'miles' | 'km', interval: number): number {
  if (![0.5, 1].includes(interval) || !Number.isFinite(meters) || meters < 0) return 0;
  return Math.floor((meters + 0.000001) / ((unit === 'miles' ? METERS_PER_MILE : 1000) * interval));
}
export function nextRunMilestone(input: { distanceMeters: number; unit: 'miles' | 'km'; notifInterval: number; notificationIndex?: number; status: string }, elapsedSeconds: number, at: number): RunMilestone | null {
  if (input.status !== 'running') return null;
  const index = milestoneIndex(input.distanceMeters, input.unit, input.notifInterval);
  if (index <= (input.notificationIndex ?? 0)) return null;
  // One latest update consumes a whole batch's thresholds; never burst old messages.
  return { index, distance: index * input.notifInterval, unit: input.unit, elapsedSeconds, distanceMeters: input.distanceMeters, at };
}
export function spokenDuration(seconds: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  const parts = [[h, 'hour'], [m, 'minute'], [s, 'second']] as const;
  const words = parts.filter(([value]) => value > 0).map(([value, label]) => `${value} ${label}${value === 1 ? '' : 's'}`);
  if (!words.length) return '0 seconds';
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
export function spokenRunUpdate(event: RunMilestone): string {
  const distance = event.distanceMeters / (event.unit === 'miles' ? METERS_PER_MILE : 1000);
  const singular = event.unit === 'miles' ? 'mile' : 'kilometer';
  const rounded = Math.round(distance * 100) / 100;
  const prefix = `Distance: ${rounded} ${singular}${rounded === 1 ? '' : 's'}. Total time: ${spokenDuration(event.elapsedSeconds)}.`;
  const pace = event.elapsedSeconds / distance;
  return distance >= 0.05 && Number.isFinite(pace) && pace > 0 && pace <= 3600
    ? `${prefix} Average pace: ${spokenDuration(pace)} per ${singular}.` : `${prefix} Average pace is not available yet.`;
}
export interface RunAudioEvent { runId: string; userId: string; type: RunNotificationType; milestone: RunMilestone }
export function createRunAudioQueue(adapter: { play(event: RunAudioEvent, text: string): Promise<void>; stop(): void }) {
  let generation = 0, playing = false, pending: RunAudioEvent | null = null;
  const report = (event: RunAudioEvent, error: unknown) => onError?.(event, error);
  let onError: ((event: RunAudioEvent, error: unknown) => void) | undefined;
  async function drain(event: RunAudioEvent, captured: number) {
    playing = true;
    try { await adapter.play(event, spokenRunUpdate(event.milestone)); }
    catch (error) { if (captured === generation) report(event, error); }
    finally {
      if (captured !== generation) return;
      playing = false;
      const next = pending; pending = null;
      if (next) void drain(next, generation);
    }
  }
  return {
    onError(callback: typeof onError) { onError = callback; },
    enqueue(event: RunAudioEvent) { if (playing) pending = event; else void drain(event, generation); },
    cancel() { generation++; pending = null; playing = false; adapter.stop(); },
  };
}
