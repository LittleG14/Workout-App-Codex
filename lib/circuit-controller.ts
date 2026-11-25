import type { GeneratedWorkout } from './exercises';
import { assertAccountScope, getAccountScope, type AccountScope } from './account-scope';
import { changeCircuit, createCircuitSession, circuitFormat, projectCircuit, validateCircuitSession, emomCompletedIntervals,
  circuitNotificationDelays, type CircuitAction, type CircuitClock, type CircuitSession } from './circuit-session';

export interface CircuitSnapshot { workout: GeneratedWorkout | null; clock: CircuitClock; ready: boolean; error: string; notificationInfo: string }
interface Dependencies {
  load(): Promise<GeneratedWorkout[]>;
  edit(id: string, update: (workout: GeneratedWorkout) => GeneratedWorkout): Promise<GeneratedWorkout>;
  clock(): CircuitClock; id(): string;
  chime(): Promise<void>; stopChime(): void;
  schedule(sessionId: string, delays: number[]): Promise<number>; cancelScheduled(): Promise<void>;
}
export function createCircuitController(deps: Dependencies) {
  let snapshot: CircuitSnapshot = { workout: null, clock: deps.clock(), ready: false, error: '', notificationInfo: '' };
  let generation = 0, owner: AccountScope | null = null, foreground = true, ticking = false;
  let retryWriteAt = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<CircuitSnapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()); };
  function serial<T>(scope: AccountScope, action: () => Promise<T>) {
    const captured = generation;
    const result = queue.catch(() => {}).then(async () => {
      assertAccountScope(scope); if (owner !== scope || captured !== generation) throw new Error('Your account changed.');
      const value = await action(); assertAccountScope(scope);
      if (captured !== generation) throw new Error('Your account changed.');
      return value;
    }); queue = result; return result;
  }
  const message = (error: unknown) => error instanceof Error ? error.message : 'Circuit tracking needs attention. Retry without discarding your workout.';
  function report(error: unknown, scope: AccountScope) { if (owner === scope) { try { assertAccountScope(scope); emit({ error: message(error) }); } catch {} } }
  function apply(workout: GeneratedWorkout, s: CircuitSession): GeneratedWorkout {
    return { ...workout, circuitSession: s, ...(['completed', 'canceled'].includes(s.status) ? { elapsedSeconds: Math.floor(s.elapsedMs / 1000) } : {}) };
  }
  async function notifications(s: CircuitSession, scope: AccountScope) {
    assertAccountScope(scope);
    if (owner !== scope) throw new Error('Your account changed.');
    if (foreground || !s.backgroundChimes) { await deps.cancelScheduled(); return; }
    const delays = circuitNotificationDelays(s, deps.clock());
    if (!delays.length) { await deps.cancelScheduled(); emit({ notificationInfo: '' }); return; }
    const count = await deps.schedule(s.id, delays);
    assertAccountScope(scope);
    if (owner !== scope) throw new Error('Your account changed.');
    const remaining = s.occurrences.length - emomCompletedIntervals(s);
    emit({ notificationInfo: remaining > count ? `Locked-screen chimes scheduled for the next ${count} minutes. Reopen the app to refresh the window for longer workouts.` : '' });
  }
  async function commit(id: string, action: CircuitAction, scope: AccountScope, suppressSound = false, clock = deps.clock()) {
    assertAccountScope(scope);
    let sound = false;
    const workout = await deps.edit(id, current => {
      assertAccountScope(scope);
      if (current.userId !== scope.userId) throw new Error('This workout belongs to another account.');
      if (!current.circuitSession) throw new Error('Start this workout first.');
      const old = validateCircuitSession(current.circuitSession, current);
      const next = changeCircuit(old, action, clock);
      const completed = emomCompletedIntervals(next);
      sound = action.type === 'tick' && foreground && !suppressSound && completed > old.chimeCursor;
      next.chimeCursor = Math.max(old.chimeCursor, completed);
      return apply(current, next);
    });
    assertAccountScope(scope); emit({ workout, clock: deps.clock(), error: '', ...(['completed', 'canceled'].includes(workout.circuitSession!.status) ? { notificationInfo: '' } : {}) });
    if (!['running', 'countdown'].includes(workout.circuitSession!.status)) {
      if (action.type !== 'tick') deps.stopChime();
      await deps.cancelScheduled();
    }
    if (sound) void deps.chime().catch(error => report(error, scope));
    return workout;
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    async activate(scope: AccountScope | null) {
      generation++; owner = scope; retryWriteAt = 0; deps.stopChime();
      emit({ workout: null, clock: deps.clock(), ready: false, error: '', notificationInfo: '' });
      await deps.cancelScheduled().catch(() => { if (owner === scope) emit({ error: 'Could not cancel prior circuit notifications. Open the app and retry before starting.' }); });
      if (!scope || owner !== scope) return;
      try {
        await serial(scope, async () => {
          const all = await deps.load(); assertAccountScope(scope);
          const active = all.filter(w => w.circuitSession && !['completed', 'canceled'].includes(w.circuitSession.status));
          if (active.length > 1) throw new Error('Multiple unfinished circuits were found. Your saved data is preserved; resolve them before starting another.');
          let workout = active[0] ?? null;
          if (workout) {
            const s = validateCircuitSession(workout.circuitSession, workout);
            if (s.status === 'running' || s.status === 'countdown') workout = await commit(workout.id, { type: 'recover' }, scope, true);
          }
          emit({ workout, clock: deps.clock(), ready: true });
        });
      } catch (error) { report(error, scope); }
    },
    async start(id: string, backgroundChimes = false) {
      const scope = getAccountScope();
      try {
        return await serial(scope, async () => {
          if (!snapshot.ready) throw new Error(snapshot.error || 'Circuit recovery is still loading. Retry shortly.');
          const all = await deps.load(); assertAccountScope(scope);
          const active = all.find(w => w.circuitSession && !['completed', 'canceled'].includes(w.circuitSession.status));
          if (active) throw new Error(`Finish or cancel the unfinished circuit “${active.name}” from History before starting another.`);
          const workout = await deps.edit(id, current => {
            if (current.circuitTrackingVersion !== 1 || current.circuitSession || current.elapsedSeconds !== undefined) throw new Error('This recorded workout is read-only. Generate a new workout for another attempt.');
            return apply(current, createCircuitSession(current, deps.clock(), deps.id(), backgroundChimes));
          });
          assertAccountScope(scope); emit({ workout, clock: deps.clock(), error: '', notificationInfo: '' }); return workout;
        });
      } catch (error) { report(error, scope); throw error; }
    },
    async action(id: string, action: CircuitAction) {
      const scope = getAccountScope();
      const clock = deps.clock();
      const selected = snapshot.workout;
      if (selected?.circuitSession && !['completed', 'canceled'].includes(selected.circuitSession.status) && selected.id !== id) throw new Error('Finish or cancel the current circuit before controlling another attempt.');
      if (['pause', 'finish', 'cancel'].includes(action.type)) deps.stopChime();
      try {
        return await serial(scope, async () => {
          // Cancel finite native notifications before applying a pause/stop.
          if (['pause', 'finish', 'cancel'].includes(action.type)) await deps.cancelScheduled();
          const workout = await commit(id, action, scope, false, clock);
          if (!foreground) await notifications(workout.circuitSession!, scope);
          return workout;
        });
      } catch (error) { report(error, scope); throw error; }
    },
    /** A synced unfinished record can arrive after initial account hydration. */
    async recoverForView(id: string) {
      const scope = getAccountScope();
      return serial(scope, async () => {
        if (snapshot.workout?.id === id) return;
        if (snapshot.workout?.circuitSession && !['completed', 'canceled'].includes(snapshot.workout.circuitSession.status)) throw new Error('Another circuit is still in progress. Finish or cancel it before restoring this attempt.');
        const all = await deps.load(); assertAccountScope(scope);
        const workout = all.find(w => w.id === id);
        if (!workout?.circuitSession || ['completed', 'canceled'].includes(workout.circuitSession.status)) return;
        validateCircuitSession(workout.circuitSession, workout);
        const restored = ['running', 'countdown'].includes(workout.circuitSession.status) ? await commit(id, { type: 'recover' }, scope, true) : workout;
        emit({ workout: restored, ready: true, clock: deps.clock() });
      });
    },
    async tick() {
      if (!foreground || !owner || ticking || !snapshot.ready) return;
      ticking = true; const scope = owner;
      try {
        const workout = snapshot.workout, s = workout?.circuitSession;
        if (!s || !['running', 'countdown'].includes(s.status)) return;
        const clock = deps.clock();
        emit({ clock });
        const next = projectCircuit(s, clock);
        if (clock.mono >= retryWriteAt && (next.status !== s.status || emomCompletedIntervals(next) > s.chimeCursor)) await serial(scope, () => commit(workout!.id, { type: 'tick' }, scope, false, clock));
      } catch (error) { retryWriteAt = deps.clock().mono + 5000; report(error, scope); }
      finally { ticking = false; }
    },
    async setForeground(active: boolean) {
      const clock = deps.clock();
      foreground = false;
      if (!active) deps.stopChime();
      if (!owner) { foreground = active; return; }
      const scope = owner;
      try {
        await serial(scope, async () => {
          await deps.cancelScheduled();
          const workout = snapshot.workout, s = workout?.circuitSession;
          if (s && ['running', 'countdown'].includes(s.status)) {
            const updated = await commit(workout!.id, { type: 'tick' }, scope, true, clock);
            if (!active) await notifications(updated.circuitSession!, scope);
          }
          foreground = active; emit({ clock: deps.clock() });
        });
      } catch (error) { report(error, scope); foreground = active; }
    },
    async beforeLogout() {
      const clock = deps.clock();
      const scope = owner, w = snapshot.workout;
      deps.stopChime(); await deps.cancelScheduled();
      if (scope && w?.circuitSession && ['running', 'countdown'].includes(w.circuitSession.status)) {
        await serial(scope, () => commit(w.id, { type: w.circuitSession!.status === 'countdown' ? 'cancel' : 'pause' }, scope, true, clock));
      }
    },
    supports: circuitFormat,
  };
}
