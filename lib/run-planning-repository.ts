import { accountStorageKey, assertAccountScope, getAccountScope, type AccountScope } from './account-scope';
import { validGeoPoint, MAX_ROUTE_POINTS, validatePlannedRoute, type GeoPoint, type PlannedRoute } from './run-geometry';
import type { RunNotificationType } from './run-milestones';
export interface RunSettings { unit: 'miles' | 'km'; notifInterval: 0 | 0.5 | 1; notificationType: RunNotificationType }
interface Planning { version: 1; settings: RunSettings; route?: PlannedRoute; editor?: GeoPoint[] }
const defaults: RunSettings = { unit: 'miles', notifInterval: 1, notificationType: 'sound' };
export function createRunPlanningRepository(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }) {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(scope: AccountScope, fn: () => Promise<T>): Promise<T> {
    const next = queue.catch(() => {}).then(async () => { assertAccountScope(scope); const value = await fn(); assertAccountScope(scope); return value; }); queue = next; return next;
  }
  async function read(scope: AccountScope): Promise<Planning> {
    const raw = await storage.getItem(accountStorageKey(scope, 'run-planning-v1')); assertAccountScope(scope);
    if (!raw) return { version: 1, settings: { ...defaults } };
    let data: Planning;
    try {
      data = JSON.parse(raw);
      if (data.version !== 1 || !['miles', 'km'].includes(data.settings.unit) || ![0, 0.5, 1].includes(data.settings.notifInterval)
        || !['sound', 'update'].includes(data.settings.notificationType)) throw new Error();
      if (data.route) data.route = validatePlannedRoute(data.route);
      if (data.editor !== undefined && (!Array.isArray(data.editor) || data.editor.length > MAX_ROUTE_POINTS || !data.editor.every(validGeoPoint))) throw new Error();
      return data;
    } catch { throw new Error('Your saved run plan could not be read. It has been preserved.'); }
  }
  async function write(scope: AccountScope, data: Planning) {
    assertAccountScope(scope); await storage.setItem(accountStorageKey(scope, 'run-planning-v1'), JSON.stringify(data));
  }
  return {
    get: (scope = getAccountScope()) => serial(scope, () => read(scope)),
    saveRoute: (value: unknown, scope = getAccountScope()) => serial(scope, async () => {
      const route = validatePlannedRoute(value), data = await read(scope); delete data.editor; await write(scope, { ...data, route }); return route;
    }),
    consumeRoute: (id: string, scope = getAccountScope()) => serial(scope, async () => {
      const data = await read(scope); if (data.route?.id !== id) return;
      delete data.route; delete data.editor; await write(scope, data);
    }),
    saveEditor: (points: GeoPoint[], scope = getAccountScope()) => serial(scope, async () => {
      if (!Array.isArray(points) || points.length > MAX_ROUTE_POINTS || !points.every(validGeoPoint)) throw new Error('Invalid route draft.');
      const data = await read(scope); await write(scope, { ...data, editor: points.map(p => ({ latitude: p.latitude, longitude: p.longitude })) });
    }),
    clearEditor: (scope = getAccountScope()) => serial(scope, async () => { const data = await read(scope); delete data.editor; await write(scope, data); }),
    saveSettings: (settings: RunSettings, scope = getAccountScope()) => serial(scope, async () => {
      if (!['miles', 'km'].includes(settings.unit) || ![0, 0.5, 1].includes(settings.notifInterval) || !['sound', 'update'].includes(settings.notificationType)) throw new Error('Choose valid run notification settings.');
      const data = await read(scope); await write(scope, { ...data, settings: { ...settings } });
    }),
  };
}
