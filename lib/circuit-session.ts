import type { CircuitBlock, GeneratedWorkout, WorkoutExercise } from './exercises';

export type CircuitFormat = 'hyrox' | 'emom' | 'amrap';
export interface CircuitClock { wall: number; mono: number; runtime: string; source?: 'continuous' | 'wall' }
export type CircuitStatus = 'countdown' | 'running' | 'paused' | 'completed' | 'canceled';
export interface CircuitOccurrence {
  id: string; blockIndex: number; exerciseIndex: number; round: number; sequence: number;
  exercise: WorkoutExercise; elapsedMs: number; completed: boolean; completionOrder?: number;
}
export interface CircuitSession {
  version: 1; id: string; userId: string; format: CircuitFormat; status: CircuitStatus;
  blocks: CircuitBlock[]; occurrences: CircuitOccurrence[]; rounds: number[];
  elapsedMs: number; anchor: CircuitClock | null; startedClock: CircuitClock; countdownMs: number;
  activeId?: string; activeSinceMs?: number; chimeCursor: number;
  completionCounter: number; completedAt?: string; clockUncertain?: boolean; warning?: string;
  backgroundChimes: boolean;
}
const MINUTE = 60000, MAX_ELAPSED = 24 * 60 * MINUTE;
export function circuitFormat(workout: GeneratedWorkout): CircuitFormat | null {
  if (workout.topCategory !== 'circuit' || !Array.isArray(workout.circuitBlocks) || !workout.circuitBlocks.length) return null;
  const expected = { hyrox: 'Hyrox', emom: 'EMOM', amrap: 'AMRAP' } as const;
  const format = workout.subType as CircuitFormat;
  return expected[format] && workout.circuitBlocks.every(block => block?.format === expected[format] && Array.isArray(block.exercises)) ? format : null;
}
/** Mark only newly generated supported circuits. Never backfill old measurements. */
export function prepareCircuitTracking(workout: GeneratedWorkout): GeneratedWorkout {
  return circuitFormat(workout) ? { ...workout, circuitTrackingVersion: 1 } : workout;
}
export function circuitPrescriptionLocked(workout: GeneratedWorkout): boolean {
  return !!circuitFormat(workout) && (workout.circuitTrackingVersion !== 1 || !!workout.circuitSession || workout.elapsedSeconds !== undefined);
}
export function formatCircuitTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000), hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function difference(anchor: CircuitClock, clock: CircuitClock): number {
  return anchor.runtime === clock.runtime ? clock.mono - anchor.mono : clock.wall - anchor.wall;
}
export function circuitElapsed(session: CircuitSession, clock: CircuitClock): number {
  if (!session.anchor || !['running', 'countdown'].includes(session.status)) return session.elapsedMs;
  const delta = difference(session.anchor, clock);
  if (!Number.isFinite(delta) || delta < 0 || delta > MAX_ELAPSED) return session.elapsedMs;
  return Math.min(MAX_ELAPSED, session.elapsedMs + Math.max(0, delta - session.countdownMs));
}
export function emomMinutes(block: CircuitBlock): number {
  const count = block.exercises.length;
  if (!count) throw new Error('An EMOM block needs exercises.');
  const cap = block.timeCapMinutes;
  const rounds = block.rounds;
  if (cap !== undefined && (!Number.isInteger(cap) || cap <= 0 || cap > 240)) throw new Error('The EMOM time cap is invalid.');
  if (rounds !== undefined && (!Number.isInteger(rounds) || rounds <= 0 || rounds > 240)) throw new Error('The EMOM round count is invalid.');
  const minutes = Math.min(cap ?? Infinity, rounds === undefined ? Infinity : rounds * count);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) throw new Error('An EMOM block needs a finite duration or round count.');
  return minutes;
}
export function createCircuitSession(workout: GeneratedWorkout, clock: CircuitClock, id: string, backgroundChimes = false): CircuitSession {
  const format = circuitFormat(workout);
  if (!format) throw new Error('This circuit format uses its existing workout controls.');
  if (!workout.userId) throw new Error('Sign in to start this workout.');
  const blocks = JSON.parse(JSON.stringify(workout.circuitBlocks)) as CircuitBlock[];
  const occurrences: CircuitOccurrence[] = [];
  blocks.forEach((block, blockIndex) => {
    if (!block.exercises.length || block.exercises.length > 100) throw new Error('The circuit exercise list is invalid.');
    if (format === 'amrap') return;
    const count = format === 'emom' ? emomMinutes(block) : block.exercises.length;
    for (let i = 0; i < count; i++) {
      const exerciseIndex = i % block.exercises.length, round = Math.floor(i / block.exercises.length);
      occurrences.push({ id: `${id}:b${blockIndex}:r${round}:e${exerciseIndex}`, blockIndex, exerciseIndex, round,
        sequence: occurrences.length, exercise: block.exercises[exerciseIndex], elapsedMs: 0, completed: false });
    }
  });
  if (occurrences.length > 480 || blocks.length > 10) throw new Error('This circuit is too large to track safely.');
  return { version: 1, id, userId: workout.userId, format, status: 'countdown', blocks, occurrences,
    rounds: blocks.map(() => 0), elapsedMs: 0, anchor: clock, startedClock: clock, countdownMs: 5000,
    chimeCursor: 0, completionCounter: 0, backgroundChimes,
    ...(clock.source === 'wall' ? { clockUncertain: true, warning: 'This runtime uses device-time fallback. Recorded times remain in History and Last but cannot earn timed PRs. Update the iOS app for full timing support.' } : {}) };
}
export function validateCircuitSession(value: unknown, workout: GeneratedWorkout): CircuitSession {
  const s = value as CircuitSession;
  const validMs = (n: number) => Number.isFinite(n) && n >= 0 && n <= MAX_ELAPSED;
  if (!s || s.version !== 1 || typeof s.id !== 'string' || !s.id || s.userId !== workout.userId || s.format !== circuitFormat(workout)
    || !['countdown', 'running', 'paused', 'completed', 'canceled'].includes(s.status) || !validMs(s.elapsedMs)
    || ![0, 5000].includes(s.countdownMs) || !Array.isArray(s.blocks) || s.blocks.length !== workout.circuitBlocks?.length
    || !Array.isArray(s.occurrences) || s.occurrences.length > 480 || !Array.isArray(s.rounds) || s.rounds.length !== s.blocks.length
    || !s.rounds.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 99999)
    || !Number.isSafeInteger(s.chimeCursor) || s.chimeCursor < 0 || !Number.isSafeInteger(s.completionCounter) || s.completionCounter < 0
    || typeof s.backgroundChimes !== 'boolean') throw new Error('Circuit tracking data is invalid. The saved workout has been preserved.');
  if (s.anchor && (!Number.isFinite(s.anchor.wall) || !Number.isFinite(s.anchor.mono) || typeof s.anchor.runtime !== 'string')) throw new Error('The saved circuit clock is invalid.');
  if (!s.startedClock || !Number.isFinite(s.startedClock.wall) || !Number.isFinite(s.startedClock.mono) || typeof s.startedClock.runtime !== 'string') throw new Error('The saved circuit start clock is invalid.');
  if (['running', 'countdown'].includes(s.status) !== !!s.anchor) throw new Error('The circuit clock cannot be restored.');
  if ((s.status === 'completed' || s.status === 'canceled') && (!s.completedAt || !Number.isFinite(Date.parse(s.completedAt)))) throw new Error('The circuit completion date is invalid.');
  const ids = new Set<string>();
  if (s.blocks.some(block => !block || !Array.isArray(block.exercises) || !block.exercises.length || block.exercises.some(ex =>
    !ex || !ex.exercise || typeof ex.exercise.id !== 'string' || typeof ex.exercise.name !== 'string' || typeof ex.exercise.equipment !== 'string'
    || !Array.isArray(ex.exercise.muscles) || typeof ex.reps !== 'string' || (ex.notes !== undefined && typeof ex.notes !== 'string')))) throw new Error('Saved circuit exercises are invalid.');
  const expected = s.format === 'amrap' ? [] : s.blocks.flatMap((block, blockIndex) => Array.from({ length: s.format === 'emom' ? emomMinutes(block) : block.exercises.length }, (_, i) => ({
    blockIndex, exerciseIndex: i % block.exercises.length, round: Math.floor(i / block.exercises.length),
  })));
  if (s.occurrences.length !== expected.length) throw new Error('The saved interval schedule is incomplete.');
  for (const o of s.occurrences) {
    const ex = s.blocks[o.blockIndex]?.exercises[o.exerciseIndex];
    const position = expected[ids.size];
    if (!o.id || ids.has(o.id) || !ex || JSON.stringify(ex) !== JSON.stringify(o.exercise) || ex.exercise.id !== o.exercise?.exercise?.id || !Number.isSafeInteger(o.round) || o.round < 0
      || o.blockIndex !== position.blockIndex || o.exerciseIndex !== position.exerciseIndex || o.round !== position.round
      || o.id !== `${s.id}:b${o.blockIndex}:r${o.round}:e${o.exerciseIndex}` || typeof o.exercise.reps !== 'string' || typeof o.exercise.exercise.equipment !== 'string'
      || typeof o.exercise.exercise.name !== 'string' || !Array.isArray(o.exercise.exercise.muscles) || (o.exercise.notes !== undefined && typeof o.exercise.notes !== 'string')
      || !Number.isSafeInteger(o.sequence) || o.sequence !== ids.size || !validMs(o.elapsedMs) || typeof o.completed !== 'boolean'
      || (s.format === 'emom' && o.elapsedMs > MINUTE)
      || (o.completionOrder !== undefined && (!Number.isSafeInteger(o.completionOrder) || o.completionOrder < 1))) throw new Error('Saved circuit intervals are invalid.');
    ids.add(o.id);
  }
  if (s.activeId && (!ids.has(s.activeId) || s.format !== 'hyrox' || !validMs(s.activeSinceMs!) || s.activeSinceMs! > s.elapsedMs)) throw new Error('The active station is invalid.');
  if (s.chimeCursor > (s.format === 'emom' ? Math.floor(s.elapsedMs / MINUTE) : 0)) throw new Error('The saved chime cursor is invalid.');
  if (s.occurrences.reduce((sum, o) => sum + o.elapsedMs, 0) > s.elapsedMs + 1) throw new Error('Recorded station time exceeds the workout time.');
  if (s.format === 'emom' && s.occurrences.some(o => Math.abs(o.elapsedMs - Math.min(MINUTE, Math.max(0, s.elapsedMs - o.sequence * MINUTE))) > 1)) throw new Error('Saved interval durations do not match the workout clock.');
  return s;
}
function completionDate(s: CircuitSession, clock: CircuitClock, overrunMs = 0): string {
  // Keep record ordering stable when device wall time changes within this process.
  const elapsedWall = s.startedClock.runtime === clock.runtime ? Math.max(0, clock.mono - s.startedClock.mono) : 0;
  return new Date((s.startedClock.runtime === clock.runtime ? s.startedClock.wall + elapsedWall : clock.wall) - overrunMs).toISOString();
}
/** Pure timestamp projection. One workout clock, never an interval per station. */
export function projectCircuit(input: CircuitSession, clock: CircuitClock): CircuitSession {
  const s: CircuitSession = { ...input, occurrences: input.occurrences.map(o => ({ ...o })), rounds: [...input.rounds] };
  let delta = s.anchor ? difference(s.anchor, clock) : 0;
  if (!Number.isFinite(delta) || delta < 0 || delta > MAX_ELAPSED) {
    s.status = 'paused'; s.anchor = null; s.countdownMs = 0; s.clockUncertain = true;
    s.warning = 'The device clock could not be reconciled. Timing is paused at the last saved point; confirm your timing before continuing.';
    delta = 0;
  }
  if (s.anchor && s.anchor.runtime !== clock.runtime) {
    s.clockUncertain = true;
    s.warning = 'Timing was recovered using device time after an app restart. Times remain in History and Last, but are excluded from timed PRs.';
  }
  if (s.status === 'countdown' && delta < s.countdownMs) return s;
  const elapsed = circuitElapsed(input, clock);
  if (s.status === 'countdown') s.status = 'running';
  if (s.status === 'running') {
    s.elapsedMs = elapsed;
    if (s.format === 'hyrox' && s.activeId) {
      const o = s.occurrences.find(o => o.id === s.activeId)!;
      o.elapsedMs += Math.max(0, elapsed - (s.activeSinceMs ?? elapsed));
      s.activeSinceMs = elapsed;
    }
    if (s.format === 'emom') {
      s.elapsedMs = Math.min(elapsed, s.occurrences.length * MINUTE);
      s.occurrences.forEach(o => { o.elapsedMs = Math.min(MINUTE, Math.max(0, s.elapsedMs - o.sequence * MINUTE)); o.completed = o.elapsedMs === MINUTE; });
      if (s.elapsedMs === s.occurrences.length * MINUTE) {
        s.status = 'completed'; s.completedAt = completionDate(s, clock, Math.max(0, elapsed - s.elapsedMs));
      }
    }
    s.anchor = s.status === 'running' ? clock : null; s.countdownMs = 0;
  }
  return s;
}
export type CircuitAction = { type: 'tick' | 'pause' | 'resume' | 'finish' | 'cancel' | 'recover' }
  | { type: 'station' | 'confirm'; id: string }
  | { type: 'round'; blockIndex: number; delta: 1 | -1 };
export function changeCircuit(input: CircuitSession, action: CircuitAction, clock: CircuitClock): CircuitSession {
  if (['completed', 'canceled'].includes(input.status)) {
    if (action.type === 'tick') return input;
    throw new Error('This recorded workout is read-only. Generate a new workout for another attempt.');
  }
  const s = projectCircuit(input, clock);
  if (s.status === 'completed') return s;
  switch (action.type) {
    case 'recover':
      if (s.status === 'countdown') {
        s.status = 'canceled'; s.completedAt = completionDate(s, clock); s.countdownMs = 0;
      } else s.status = 'paused';
      s.anchor = null; s.clockUncertain = true;
      s.warning = 'Recovered attempt paused for review. Recovered times remain in History and Last, but are excluded from timed PRs.';
      break;
    case 'pause':
      if (s.status !== 'running') throw new Error('Only a running workout can be paused.');
      s.status = 'paused'; s.anchor = null; break;
    case 'resume':
      if (s.status !== 'paused') throw new Error('This workout is not paused.');
      s.status = 'running'; s.anchor = clock; break;
    case 'finish': case 'cancel':
      s.status = action.type === 'finish' ? 'completed' : 'canceled'; s.anchor = null; s.countdownMs = 0;
      s.activeId = undefined; s.activeSinceMs = undefined; s.completedAt = completionDate(s, clock); break;
    case 'station': {
      if (s.format !== 'hyrox' || s.status !== 'running') throw new Error('Start or resume HYROX before timing a station.');
      const o = s.occurrences.find(o => o.id === action.id); if (!o) throw new Error('Station not found.');
      if (s.activeId === o.id) { s.activeId = undefined; s.activeSinceMs = undefined; }
      else { s.activeId = o.id; s.activeSinceMs = s.elapsedMs; o.completed = false; o.completionOrder = undefined; }
      break;
    }
    case 'confirm': {
      if (s.format !== 'hyrox' || !['running', 'paused'].includes(s.status)) throw new Error('This station cannot be confirmed.');
      const o = s.occurrences.find(o => o.id === action.id);
      if (!o || o.elapsedMs <= 0 || (s.activeId === o.id && s.status !== 'paused')) throw new Error('Stop a timed station before confirming the prescribed work was completed.');
      if (s.activeId === o.id) { s.activeId = undefined; s.activeSinceMs = undefined; }
      o.completed = !o.completed;
      o.completionOrder = o.completed ? ++s.completionCounter : undefined;
      break;
    }
    case 'round':
      if (s.format !== 'amrap' || !['running', 'paused'].includes(s.status) || !Number.isInteger(action.blockIndex) || s.rounds[action.blockIndex] === undefined || ![1, -1].includes(action.delta)) throw new Error('Start the AMRAP workout before counting rounds.');
      s.rounds[action.blockIndex] = Math.min(99999, Math.max(0, s.rounds[action.blockIndex] + action.delta)); break;
  }
  return s;
}
export function emomCompletedIntervals(s: CircuitSession): number { return s.format === 'emom' ? Math.floor(s.elapsedMs / MINUTE) : 0; }
export function currentEmomOccurrence(s: CircuitSession): CircuitOccurrence | undefined {
  return s.format === 'emom' && ['running', 'paused'].includes(s.status) ? s.occurrences[Math.floor(s.elapsedMs / MINUTE)] : undefined;
}
export function circuitRowTiming(s: CircuitSession | undefined, blockIndex: number, exerciseIndex: number) {
  const records = s?.occurrences.filter(o => o.blockIndex === blockIndex && o.exerciseIndex === exerciseIndex) ?? [];
  const current = s && currentEmomOccurrence(s);
  const occurrence = s?.format === 'hyrox' ? records[0] : records.find(o => o.id === current?.id) ?? [...records].reverse().find(o => o.elapsedMs > 0);
  const active = s?.status === 'running' && !!occurrence && (s.format === 'hyrox' ? s.activeId === occurrence.id : current?.id === occurrence.id);
  return { occurrence, active };
}
export function circuitCountdownRemaining(s: CircuitSession, clock: CircuitClock): number {
  return s.status === 'countdown' && s.anchor ? Math.max(0, s.countdownMs - Math.max(0, difference(s.anchor, clock))) : 0;
}
export function circuitNotificationDelays(s: CircuitSession, clock?: CircuitClock): number[] {
  if (clock) s = projectCircuit(s, clock);
  if (!s.backgroundChimes || !['running', 'countdown'].includes(s.status) || s.format !== 'emom') return [];
  const beforeStart = clock ? circuitCountdownRemaining(s, clock) : s.status === 'countdown' ? s.countdownMs : 0;
  return s.occurrences.map(o => beforeStart + (o.sequence + 1) * MINUTE - s.elapsedMs).filter(delay => delay > 0).slice(0, 60);
}
