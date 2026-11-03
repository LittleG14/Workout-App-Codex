import type { GeneratedWorkout } from './exercises';
import { accountStorageKey, assertAccountScope, getAccountScope, type AccountScope } from './account-scope';

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Mutation = { revision: number; kind: 'put' | 'delete'; workout?: GeneratedWorkout };
type State = { version: 1; revision: number; workouts: GeneratedWorkout[]; pending: Record<string, Mutation> };
export type WorkoutResponse = { status: number; workouts?: GeneratedWorkout[] };
export type WorkoutRequest = (scope: AccountScope, method: string, path: string, body?: GeneratedWorkout) => Promise<WorkoutResponse>;

function normalizeWorkout(workout: GeneratedWorkout): GeneratedWorkout {
  if (workout.topCategory) return workout;
  const legacy = workout as GeneratedWorkout & { workoutType?: string };
  return { ...workout, topCategory: 'weight_lifting', subType: legacy.workoutType || 'chest_triceps', style: legacy.style || 'hypertrophy' };
}

export function createWorkoutRepository(storage: Storage, request: WorkoutRequest) {
  const queues = new Map<string, Promise<unknown>>();
  const syncs = new Map<string, Promise<void>>();
  const key = (scope: AccountScope) => accountStorageKey(scope, 'workouts');
  const empty = (): State => ({ version: 1, revision: 0, workouts: [], pending: {} });
  async function read(scope: AccountScope): Promise<State> {
    assertAccountScope(scope);
    const raw = await storage.getItem(key(scope));
    assertAccountScope(scope);
    if (!raw) return empty();
    let state: State;
    try { state = JSON.parse(raw); } catch { throw new Error('Your saved workouts could not be read. They have been preserved.'); }
    if (state?.version !== 1 || !Array.isArray(state.workouts) || !state.pending
      || typeof state.pending !== 'object' || !Number.isSafeInteger(state.revision)) {
      throw new Error('Your saved workouts could not be read. They have been preserved.');
    }
    const owned = (workout: GeneratedWorkout): GeneratedWorkout => {
      if (workout.userId && workout.userId !== scope.userId) throw new Error('Saved workout ownership is invalid. The data has been preserved.');
      return { ...workout, userId: scope.userId };
    };
    state.workouts = state.workouts.map(owned);
    for (const mutation of Object.values(state.pending)) if (mutation.workout) mutation.workout = owned(mutation.workout);
    return state;
  }
  function serial<T>(scope: AccountScope, action: () => Promise<T>): Promise<T> {
    const name = key(scope);
    const next = (queues.get(name) ?? Promise.resolve()).catch(() => {}).then(() => { assertAccountScope(scope); return action(); });
    queues.set(name, next);
    void next.finally(() => { if (queues.get(name) === next) queues.delete(name); }).catch(() => {});
    return next;
  }
  async function write(scope: AccountScope, state: State): Promise<void> {
    assertAccountScope(scope); await storage.setItem(key(scope), JSON.stringify(state)); assertAccountScope(scope);
  }
  async function sync(scope: AccountScope): Promise<void> {
    const name = `${key(scope)}:${scope.generation}`;
    if (syncs.has(name)) return syncs.get(name)!;
    const run = (async () => {
      while (true) {
        const state = await serial(scope, () => read(scope));
        const entry = Object.entries(state.pending)[0];
        if (!entry) return;
        const [id, mutation] = entry;
        assertAccountScope(scope);
        let response: WorkoutResponse;
        try {
          const route = `/api/workouts/${encodeURIComponent(id)}`;
          response = await request(scope, mutation.kind === 'delete' ? 'DELETE' : 'PUT', route, mutation.workout);
          if (mutation.kind === 'put' && response.status === 404) {
            assertAccountScope(scope);
            response = await request(scope, 'POST', '/api/workouts', mutation.workout);
          }
        } catch { return; }
        assertAccountScope(scope);
        if (response.status < 200 || response.status >= 300) return;
        await serial(scope, async () => {
          const latest = await read(scope);
          if (latest.pending[id]?.revision === mutation.revision) {
            delete latest.pending[id]; await write(scope, latest);
          }
        });
      }
    })();
    syncs.set(name, run);
    try { await run; } finally { if (syncs.get(name) === run) syncs.delete(name); }
  }
  async function mutate(workout: GeneratedWorkout | null, id: string): Promise<void> {
    const scope = getAccountScope();
    if (workout?.userId && workout.userId !== scope.userId) throw new Error('This workout belongs to another account.');
    if (workout) workout = { ...workout, userId: scope.userId };
    await serial(scope, async () => {
      const state = await read(scope); state.revision += 1;
      state.workouts = state.workouts.filter(w => w.id !== id);
      if (workout) state.workouts.unshift(workout);
      state.pending[id] = { revision: state.revision, kind: workout ? 'put' : 'delete', ...(workout ? { workout } : {}) };
      await write(scope, state);
    });
    void sync(scope).catch(() => {});
  }
  return {
    saveWorkout: (workout: GeneratedWorkout) => mutate(workout, workout.id),
    updateWorkout: (workout: GeneratedWorkout) => mutate(workout, workout.id),
    deleteWorkout: (id: string) => mutate(null, id),
    async getLocalWorkoutsOnly(): Promise<GeneratedWorkout[]> {
      const scope = getAccountScope(); return serial(scope, async () => (await read(scope)).workouts);
    },
    async getWorkouts(): Promise<GeneratedWorkout[]> {
      const scope = getAccountScope(); await sync(scope);
      const revision = await serial(scope, async () => (await read(scope)).revision);
      let response: WorkoutResponse;
      try { response = await request(scope, 'GET', '/api/workouts'); }
      catch { return serial(scope, async () => (await read(scope)).workouts); }
      assertAccountScope(scope);
      if (response.status !== 200 || !Array.isArray(response.workouts)) {
        return serial(scope, async () => (await read(scope)).workouts);
      }
      return serial(scope, async () => {
        const state = await read(scope);
        if (state.revision !== revision) return state.workouts;
        const merged = new Map<string, GeneratedWorkout>(response.workouts!.filter(w => !w.userId || w.userId === scope.userId)
          .map(w => [w.id, { ...normalizeWorkout(w), userId: scope.userId }]));
        for (const [id, pending] of Object.entries(state.pending)) {
          if (pending.kind === 'delete') merged.delete(id);
          else if (pending.workout) merged.set(id, pending.workout);
        }
        state.workouts = [...merged.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        await write(scope, state); return state.workouts;
      });
    },
    syncLocalWorkoutsToServer: () => sync(getAccountScope()),
    async clearAccount(scope: AccountScope): Promise<void> {
      await serial(scope, () => storage.removeItem(key(scope)));
    },
    async pendingCount(): Promise<number> {
      const scope = getAccountScope(); return serial(scope, async () => Object.keys((await read(scope)).pending).length);
    },
  };
}
