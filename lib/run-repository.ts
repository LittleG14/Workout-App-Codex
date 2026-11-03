import type { RunCoordinate, RunData } from './exercises';

export type RunDraft = {
  version: 1; id: string; userId: string; startedAt: number;
  status: 'running' | 'paused' | 'stopped'; mode: 'background' | 'foreground';
  unit: 'miles' | 'km'; notifInterval: number;
  accumulatedMs: number; segmentStartedAt: number | null; stoppedAt?: number;
  coordinates: RunCoordinate[]; segmentStarts: number[]; distanceMeters: number;
  lastCoordinate: RunCoordinate | null; error?: string;
};
export type RunFix = RunCoordinate & { accuracy?: number | null };
interface Dependencies {
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
  userId(): Promise<string | null>;
  start(mode: RunDraft['mode']): Promise<void>;
  stop(): Promise<void>;
  now(): number;
  id(): string;
}
const bindingKey = 'swolehouse:run-tracking:v1';
const draftKey = (owner: string) => `swolehouse:v1:${encodeURIComponent(owner)}:run-draft`;
type Binding = { userId: string; id: string };

export function elapsedRunSeconds(run: RunDraft, now: number): number {
  return Math.floor((run.accumulatedMs + (run.segmentStartedAt === null ? 0 : Math.max(0, now - run.segmentStartedAt))) / 1000);
}
export function runData(run: RunDraft, now: number): RunData {
  const durationSeconds = elapsedRunSeconds(run, now);
  const distanceMiles = run.distanceMeters / 1609.34, distanceKm = run.distanceMeters / 1000;
  return { coordinates: run.coordinates, segmentStarts: run.segmentStarts, distanceMiles, distanceKm, durationSeconds,
    paceSecsPerMile: distanceMiles ? durationSeconds / distanceMiles : 0,
    paceSecsPerKm: distanceKm ? durationSeconds / distanceKm : 0, unit: run.unit, notifInterval: run.notifInterval };
}
function distance(a: RunCoordinate, b: RunCoordinate): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** One serialized writer for foreground controls and headless GPS batches. No React state is required. */
export function createRunRepository(deps: Dependencies) {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => {}).then(fn); queue = next; return next;
  }
  async function owner(userId: string) {
    if (await deps.userId() !== userId) throw new Error('Your account changed. Please sign in again.');
  }
  async function read(userId: string): Promise<RunDraft | null> {
    const raw = await deps.storage.getItem(draftKey(userId));
    if (!raw) return null;
    let draft: RunDraft;
    try { draft = JSON.parse(raw); } catch { throw new Error('Your run could not be read. The saved data has been preserved.'); }
    if (!draft || typeof draft !== 'object' || draft.version !== 1 || draft.userId !== userId || !draft.id || !Array.isArray(draft.coordinates)
      || !Array.isArray(draft.segmentStarts) || !['running', 'paused', 'stopped'].includes(draft.status)
      || !['background', 'foreground'].includes(draft.mode) || !['miles', 'km'].includes(draft.unit)
      || !Number.isFinite(draft.accumulatedMs) || draft.accumulatedMs < 0 || !Number.isFinite(draft.distanceMeters) || draft.distanceMeters < 0
      || (draft.status === 'running' ? !Number.isFinite(draft.segmentStartedAt) : draft.segmentStartedAt !== null)
      || !Number.isFinite(draft.startedAt)) throw new Error('Your saved run is invalid. It has been preserved.');
    return draft;
  }
  async function binding(): Promise<Binding | null> {
    const raw = await deps.storage.getItem(bindingKey);
    if (!raw) return null;
    try {
      const b = JSON.parse(raw);
      if (typeof b.userId === 'string' && typeof b.id === 'string') return b;
    } catch { /* Fail closed: no route data can be assigned through an invalid binding. */ }
    await deps.stop(); await deps.storage.removeItem(bindingKey); return null;
  }
  const write = (run: RunDraft) => deps.storage.setItem(draftKey(run.userId), JSON.stringify(run));
  function freeze(run: RunDraft) {
    run.accumulatedMs += run.segmentStartedAt === null ? 0 : Math.max(0, deps.now() - run.segmentStartedAt);
    run.segmentStartedAt = null; run.lastCoordinate = null;
  }
  async function suspend(run: RunDraft, error?: string) {
    freeze(run); run.status = 'paused'; run.error = error;
    // Persist the pause before stopping native updates; late batches will be ignored.
    try { await write(run); }
    finally { try { await deps.storage.removeItem(bindingKey); } finally { await deps.stop(); } }
  }
  async function getOwned(userId: string, id?: string): Promise<RunDraft> {
    await owner(userId); const run = await read(userId);
    if (!run || (id && run.id !== id)) throw new Error('This run is no longer available for this account.');
    return run;
  }
  async function activate(run: RunDraft) {
    await owner(run.userId);
    run.status = 'running'; run.segmentStartedAt = deps.now(); run.lastCoordinate = null; delete run.error;
    await write(run); await deps.storage.setItem(bindingKey, JSON.stringify({ userId: run.userId, id: run.id }));
    try { await deps.start(run.mode); await owner(run.userId); }
    catch (error) { await suspend(run, 'Tracking stopped. Check location permissions and resume your run.'); throw error; }
    return run;
  }
  return {
    get: (userId: string) => serial(async () => { await owner(userId); const run = await read(userId); await owner(userId); return run; }),
    begin: (userId: string, unit: RunDraft['unit'], notifInterval: number, mode: RunDraft['mode']) => serial(async () => {
      await owner(userId);
      if (await read(userId)) throw new Error('Finish or discard your existing run before starting another.');
      const old = await binding();
      if (old) { const previous = await read(old.userId); if (previous) await suspend(previous); else { await deps.stop(); await deps.storage.removeItem(bindingKey); } }
      const run: RunDraft = { version: 1, id: deps.id(), userId, startedAt: deps.now(), status: 'paused', mode, unit,
        notifInterval, accumulatedMs: 0, segmentStartedAt: null, coordinates: [], segmentStarts: [], distanceMeters: 0, lastCoordinate: null };
      return activate(run);
    }),
    pause: (userId: string, id: string) => serial(async () => {
      const run = await getOwned(userId, id); if (run.status === 'running') await suspend(run); return run;
    }),
    resume: (userId: string, id: string) => serial(async () => {
      const run = await getOwned(userId, id);
      if (run.status === 'stopped') throw new Error('This run has ended. Save or discard it.');
      if (run.status === 'running') return run;
      return activate(run);
    }),
    finish: (userId: string, id: string) => serial(async () => {
      const run = await getOwned(userId, id);
      if (run.status !== 'stopped') {
        freeze(run); run.status = 'stopped'; run.stoppedAt = deps.now();
        try { await write(run); }
        finally { try { await deps.storage.removeItem(bindingKey); } finally { await deps.stop(); } }
      }
      else await deps.stop();
      return run;
    }),
    discard: (userId: string, id: string) => serial(async () => {
      const run = await getOwned(userId, id);
      if (run.status === 'running') throw new Error('Stop this run before discarding it.');
      await deps.stop();
      await deps.storage.removeItem(draftKey(userId));
    }),
    /** Auth transitions pause the previous owner, preserving a private, recoverable draft. */
    accountChanged: (nextUser: string | null) => serial(async () => {
      const b = await binding();
      if (!b) { await deps.stop(); return; }
      if (b.userId === nextUser) return;
      const run = await read(b.userId);
      if (run) await suspend(run, 'Run paused after signing out. Resume when signed in.');
      else { await deps.storage.removeItem(bindingKey); await deps.stop(); }
    }),
    locations: (fixes: RunFix[], expected?: Binding) => serial(async () => {
      const b = await binding();
      if (!b) { await deps.stop(); return; }
      if (expected && (expected.id !== b.id || expected.userId !== b.userId)) return;
      if (await deps.userId() !== b.userId) {
        const old = await read(b.userId); if (old) await suspend(old, 'Run paused because the account changed.');
        else { await deps.storage.removeItem(bindingKey); await deps.stop(); } return;
      }
      const run = await read(b.userId);
      if (!run || run.id !== b.id || run.status !== 'running' || run.segmentStartedAt === null) { await deps.stop(); return; }
      let accepted = false, poorAccuracy = false;
      for (const fix of [...fixes].sort((a, b) => a.timestamp - b.timestamp)) {
        if (fix.accuracy != null && (!Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 50)) { poorAccuracy = true; continue; }
        if (![fix.latitude, fix.longitude, fix.timestamp].every(Number.isFinite) || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180
          || fix.timestamp < run.segmentStartedAt || fix.timestamp > deps.now() + 10000
          || fix.timestamp <= (run.coordinates.at(-1)?.timestamp ?? 0)) continue;
        const coord = { latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp };
        if (run.lastCoordinate) run.distanceMeters += distance(run.lastCoordinate, coord);
        else run.segmentStarts.push(run.coordinates.length);
        run.coordinates.push(coord); run.lastCoordinate = coord; accepted = true;
      }
      if (accepted) delete run.error;
      else if (poorAccuracy) run.error = 'Waiting for accurate GPS. Move outdoors and enable precise location in Settings.';
      // Only the bound owner's key can be written, even if sign-out happens during an await.
      await write(run);
    }),
    failure: (message: string) => serial(async () => {
      const b = await binding(); if (!b) { await deps.stop(); return; }
      const run = await read(b.userId); if (run?.id === b.id) await suspend(run, message);
      else { await deps.storage.removeItem(bindingKey); await deps.stop(); }
    }),
    reconcile: (userId: string, nativeRunning: boolean) => serial(async () => {
      const run = await getOwned(userId);
      if (run.status === 'running' && !nativeRunning) {
        // An OS termination leaves no reliable elapsed/GPS record after the last fix.
        const lastKnown = run.coordinates.at(-1)?.timestamp ?? run.segmentStartedAt ?? run.startedAt;
        run.accumulatedMs += Math.max(0, lastKnown - (run.segmentStartedAt ?? lastKnown));
        run.segmentStartedAt = null;
        await suspend(run, 'Tracking was interrupted. Time is preserved through the last recorded location. Resume or end this run.');
      }
      return run;
    }),
  };
}
