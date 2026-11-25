import type { Exercise, GeneratedWorkout, WorkoutExercise } from './exercises';
import { validateCircuitSession } from './circuit-session';
export interface TimedPerformance {
  key: string; label: string; prElapsedMs?: number; prDate?: string;
  lastElapsedMs: number; lastDate: string; comparable: boolean; reason?: string;
}
export function hyroxWorkload(ex: WorkoutExercise): { key: string; label: string; comparable: boolean; reason?: string } {
  const prescription = (typeof ex.reps === 'string' ? ex.reps : '').trim().toLowerCase().replace(/,/g, '');
  const distance = prescription.match(/^(\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|m|meters?|metres?|mi|miles?)$/);
  const reps = prescription.match(/^(\d+)\s*(?:reps?)?$/);
  const amount = distance ? Number(distance[1]) : reps ? Number(reps[1]) : NaN;
  const unit = distance?.[2], meters = distance ? amount * (unit!.startsWith('k') ? 1000 : /^(mi|mile)/.test(unit!) ? 1609.344 : 1) : undefined;
  const canonicalQuantity = distance ? `meters:${Math.round(meters! * 1000)}` : reps ? `reps:${amount}` : `unspecified:${prescription}`;
  const load = ex.weight;
  const validLoad = load !== undefined && Number.isFinite(load) && load > 0 && (!ex.weightUnit || ['kg', 'lbs'].includes(ex.weightUnit));
  const equipment = ex.exercise.equipment.trim().toLowerCase().replace(/\s+/g, ' ');
  const knownUnloaded = /^(none|bodyweight|pull.?up bar|rings|ski erg|rowing machine|rower|rope|box|treadmill|assault bike|bike)$/.test(equipment);
  const requiresLoad = !knownUnloaded || /sled|dumbbell|kettlebell|barbell|sandbag|medicine.?ball|wall.?ball/.test(`${equipment} ${ex.exercise.name.toLowerCase()}`)
    || /farmers? carry/.test(ex.exercise.name.toLowerCase());
  const grams = validLoad ? Math.round(load * (ex.weightUnit === 'kg' ? 1000 : 453.59237)) : null;
  const note = (ex.notes ?? '').trim().toLowerCase();
  const genericNote = !note || /^station \d+$/.test(note) || /^run before station \d+$/.test(note);
  const needsDistance = /ski.?erg|rowing machine|rower/.test(`${equipment} ${ex.exercise.name.toLowerCase()}`);
  const comparable = Number.isFinite(amount) && amount > 0 && Number.isInteger(ex.sets) && ex.sets > 0
    && (!requiresLoad || validLoad) && !(needsDistance && !distance) && (load === undefined || validLoad);
  const reason = !Number.isFinite(amount) || amount <= 0 || (needsDistance && !distance) ? 'Exact workload is not specified.'
    : requiresLoad && !validLoad ? 'Load is not specified.' : !comparable ? 'Workload cannot be compared safely.' : undefined;
  return { key: JSON.stringify([ex.exercise.id, canonicalQuantity, ex.sets, grams, equipment, genericNote ? '' : note]),
    label: `${ex.reps}${ex.sets > 1 ? ` × ${ex.sets} sets` : ''}${validLoad ? ` · ${load} ${ex.weightUnit ?? 'lbs'}` : requiresLoad ? ' · load unspecified' : ''} · ${ex.exercise.equipment}`,
    comparable, reason };
}
export function collectHyroxTimes(workouts: GeneratedWorkout[], hiddenIds?: string[], resetTimestamps?: Record<string, string>): Map<string, { exercise: Exercise; times: TimedPerformance[] }> {
  const entries = new Map<string, { exercise: Exercise; times: TimedPerformance[] }>();
  const seen = new Set<string>();
  const sorted = [...workouts].sort((a, b) => Date.parse(b.circuitSession?.completedAt ?? b.createdAt) - Date.parse(a.circuitSession?.completedAt ?? a.createdAt));
  for (const w of sorted) {
    if (w.topCategory !== 'circuit' || w.subType !== 'hyrox' || w.circuitSession?.status !== 'completed') continue;
    let session;
    try { session = validateCircuitSession(w.circuitSession, w); } catch { continue; }
    if (session.format !== 'hyrox') continue;
    for (const occurrence of [...session.occurrences].sort((a, b) => (b.completionOrder ?? 0) - (a.completionOrder ?? 0))) {
      const id = `${w.userId}:${w.id}:${session.id}:${occurrence.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const ex = occurrence.exercise, exId = ex.exercise.id, date = session.completedAt!;
      if (hiddenIds?.includes(exId) || !occurrence.completed || !occurrence.completionOrder || !Number.isFinite(occurrence.elapsedMs) || occurrence.elapsedMs < 1000
        || occurrence.elapsedMs > session.elapsedMs || (resetTimestamps?.[exId] && Date.parse(date) <= Date.parse(resetTimestamps[exId]))) continue;
      const workload = hyroxWorkload(ex);
      if (!entries.has(exId)) entries.set(exId, { exercise: ex.exercise, times: [] });
      const list = entries.get(exId)!.times;
      let item = list.find(t => t.key === workload.key);
      if (!item) {
        item = { ...workload, lastElapsedMs: occurrence.elapsedMs, lastDate: date };
        list.push(item);
      }
      if (workload.comparable && !session.clockUncertain && (!item.prElapsedMs || occurrence.elapsedMs < item.prElapsedMs)) {
        item.prElapsedMs = occurrence.elapsedMs; item.prDate = date;
      }
      if (session.clockUncertain && !item.reason) item.reason = 'Recovered device-clock timing is excluded from PRs.';
    }
  }
  return entries;
}
