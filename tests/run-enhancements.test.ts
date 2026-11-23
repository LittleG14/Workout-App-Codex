import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appendRoutePoint, geographicDistance, METERS_PER_MILE, routeDistance, validatePlannedRoute, type PlannedRoute } from '../lib/run-geometry';
import { createRunPlanningRepository } from '../lib/run-planning-repository';
import { createRunRepository, elapsedRunSeconds, runData, type RunDraft } from '../lib/run-repository';
import { createRunAudioQueue, milestoneIndex, nextRunMilestone, spokenDuration, spokenRunUpdate, type RunAudioEvent } from '../lib/run-milestones';
import { getAccountScope, setAccountScope } from '../lib/account-scope';
import { createRouteProjectionQueue } from '../lib/route-projection';

const route = (): PlannedRoute => validatePlannedRoute({ version: 1, id: 'plan-1', createdAt: 10,
  coordinates: [{ latitude: 40, longitude: -74 }, { latitude: 40.0003, longitude: -74 }, { latitude: 40.0003, longitude: -73.9997 }], distanceMeters: 0 });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('all half/full mile and kilometer thresholds are exact and monotonic', () => {
  for (const unit of ['miles', 'km'] as const) for (const interval of [0.5, 1]) {
    const factor = unit === 'miles' ? METERS_PER_MILE : 1000;
    for (let i = 1; i < 10; i++) {
      const threshold = i * interval * factor;
      assert.equal(milestoneIndex(threshold - 0.01, unit, interval), i - 1);
      assert.equal(milestoneIndex(threshold, unit, interval), i);
      const run = { distanceMeters: threshold, unit, notifInterval: interval, notificationIndex: i, status: 'running' };
      assert.equal(nextRunMilestone(run, 600, 1000), null);
      assert.equal(nextRunMilestone({ ...run, distanceMeters: threshold - 10 }, 600, 1000), null);
    }
  }
  assert.equal(milestoneIndex(9000, 'km', 0), 0); assert.equal(milestoneIndex(NaN, 'km', 1), 0);
});
test('a multi-threshold batch coalesces to one latest event and never fires while paused/stopped', () => {
  const input = { distanceMeters: 2600, unit: 'km' as const, notifInterval: 0.5, notificationIndex: 0, status: 'running' };
  const event = nextRunMilestone(input, 900, 10000)!;
  assert.equal(event.index, 5); assert.equal(event.distance, 2.5); assert.equal(event.distanceMeters, 2600);
  assert.equal(nextRunMilestone({ ...input, notificationIndex: event.index }, 901, 10001), null);
  for (const status of ['paused', 'stopped']) assert.equal(nextRunMilestone({ ...input, status }, 900, 10000), null);
});
test('speech uses actual accumulated distance and active elapsed time with average pace in the selected unit', () => {
  const base = { index: 2, distance: 2, unit: 'miles' as const, distanceMeters: 2 * METERS_PER_MILE, elapsedSeconds: 1104, at: 1 };
  assert.equal(spokenRunUpdate(base), 'Distance: 2 miles. Total time: 18 minutes and 24 seconds. Average pace: 9 minutes and 12 seconds per mile.');
  assert.equal(spokenRunUpdate({ ...base, unit: 'km', distanceMeters: 3000, elapsedSeconds: 1035 }), 'Distance: 3 kilometers. Total time: 17 minutes and 15 seconds. Average pace: 5 minutes and 45 seconds per kilometer.');
  assert.ok(spokenRunUpdate({ ...base, distanceMeters: METERS_PER_MILE, elapsedSeconds: 600 }).includes('Distance: 1 mile.'));
  assert.ok(spokenRunUpdate({ ...base, distanceMeters: 0 }).includes('not available'));
  assert.ok(!spokenRunUpdate({ ...base, distanceMeters: 0 }).includes('Infinity'));
  assert.equal(spokenDuration(3661), '1 hour, 1 minute and 1 second'); assert.equal(spokenDuration(59.9), '1 minute');
});
test('audio lifecycle serializes playback, keeps only latest pending update and cancels on pause/end', async () => {
  const started: RunAudioEvent[] = [], finishes: ReturnType<typeof deferred>[] = []; let stops = 0;
  const queue = createRunAudioQueue({ play: async event => { started.push(event); const d = deferred(); finishes.push(d); await d.promise; }, stop: () => { stops++; } });
  const event = (index: number, type: 'sound' | 'update' = 'sound'): RunAudioEvent => ({ runId: 'r', userId: 'A', type,
    milestone: { index, distance: index, unit: 'km', distanceMeters: index * 1000, elapsedSeconds: index * 300, at: index } });
  queue.enqueue(event(1)); queue.enqueue(event(2)); queue.enqueue(event(3, 'update'));
  assert.equal(started.length, 1); finishes[0].resolve(); await tick();
  assert.deepEqual(started.map(e => [e.milestone.index, e.type]), [[1, 'sound'], [3, 'update']]);
  queue.enqueue(event(4)); queue.cancel(); finishes[1].resolve(); await tick();
  assert.equal(started.length, 2); assert.equal(stops, 1);
});
test('playback failures are reported and do not poison the next notification', async () => {
  let calls = 0, errors = 0;
  const queue = createRunAudioQueue({ play: async () => { calls++; if (calls === 1) throw new Error('interrupted'); }, stop: () => {} });
  queue.onError(() => { errors++; });
  const e: RunAudioEvent = { runId: 'r', userId: 'A', type: 'update', milestone: { index: 1, distance: 1, unit: 'km', elapsedSeconds: 300, distanceMeters: 1000, at: 1 } };
  queue.enqueue(e); await tick(); queue.enqueue(e); await tick(); assert.equal(calls, 2); assert.equal(errors, 1);
});
test('route geometry measures the entire polyline, rejects invalid points and avoids redundant samples', () => {
  const a = { latitude: 0, longitude: 0 }, b = { latitude: 0, longitude: 0.001 }, c = { latitude: 0.001, longitude: 0.001 };
  assert.ok(Math.abs(geographicDistance(a, b) - 111.1949) < 0.01);
  assert.ok(Math.abs(routeDistance([a, b, c]) - 222.3898) < 0.02);
  assert.ok(routeDistance([a, b, c]) > geographicDistance(a, c));
  const points = appendRoutePoint([], a); assert.equal(appendRoutePoint(points, a), points);
  assert.throws(() => appendRoutePoint(points, { latitude: 91, longitude: 0 }));
  assert.throws(() => appendRoutePoint(points, { latitude: 2, longitude: 0 }), /end of your line/);
  assert.ok(Math.abs(1609.34 / METERS_PER_MILE - 1) < 0.00001);
});
test('native map projections are ordered/coalesced and stale results cannot resurrect a cleared drawing', async () => {
  let release!: (value: {latitude:number;longitude:number}) => void;
  const accepted: {latitude:number;longitude:number}[] = [], requested: number[] = [];
  const queue = createRouteProjectionQueue({
    convert: async point => { requested.push(point.x); if (point.x === 1) return new Promise(resolve => { release=resolve; }); return {latitude:point.x,longitude:point.y}; },
    accept: point => {accepted.push(point);}, error: () => { throw new Error('Unexpected projection failure'); },
  });
  queue.push({x:1,y:1}); queue.push({x:2,y:2}); queue.push({x:3,y:3}); assert.equal(queue.isBusy(),true);
  queue.cancel(); queue.push({x:4,y:4}); release({latitude:1,longitude:1}); await tick();
  assert.deepEqual(requested,[1,4]); assert.deepEqual(accepted,[{latitude:4,longitude:4}]); assert.equal(queue.isBusy(),false);
});
test('saved routes validate useful length, bounds and point limits; distance is recomputed rather than trusted', () => {
  const p = route(); assert.ok(p.distanceMeters > 50); assert.notEqual(p.distanceMeters, 0);
  assert.throws(() => validatePlannedRoute({ ...p, coordinates: [p.coordinates[0]] }));
  assert.throws(() => validatePlannedRoute({ ...p, coordinates: [p.coordinates[0], p.coordinates[0]] }));
  assert.throws(() => validatePlannedRoute({ ...p, coordinates: [{ latitude: NaN, longitude: 0 }, p.coordinates[0]] }));
  assert.throws(() => validatePlannedRoute({ ...p, coordinates: Array(2049).fill(p.coordinates[0]) }));
  assert.throws(() => validatePlannedRoute({ ...p, coordinates: [{ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 10 }] }));
});
function fixture() {
  const data = new Map<string, string>(); let currentUser: string | null = 'A', now = 100000, stops = 0;
  const events: RunAudioEvent[] = [];
  const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key, value); }, removeItem: async (key: string) => { data.delete(key); } };
  const plans = createRunPlanningRepository(storage);
  const deps = { storage, userId: async () => currentUser, now: () => now, id: () => 'run-test', start: async () => {}, stop: async () => {},
    cancelAudio: () => { stops++; }, notify: (e: RunAudioEvent) => { events.push(e); }, consumePlan: async (_user: string, id: string) => plans.consumeRoute(id) };
  return { data, events, plans, repo: createRunRepository(deps), restart: () => createRunRepository(deps), time: (t: number) => { now = t; }, user: (id: string | null) => { currentUser = id; }, stops: () => stops };
}
test('route and sound/update settings survive setup navigation/recreation and remain account scoped', async () => {
  setAccountScope('A'); const f = fixture();
  assert.equal((await f.plans.get()).route, undefined);
  await f.plans.saveSettings({ unit: 'km', notifInterval: 0.5, notificationType: 'update' });
  const saved = await f.plans.saveRoute(route());
  const fresh = createRunPlanningRepository({ getItem: async key => f.data.get(key) ?? null, setItem: async(key,value) => { f.data.set(key,value); } });
  assert.deepEqual((await fresh.get()).route, saved); assert.equal((await fresh.get()).settings.notificationType, 'update');
  setAccountScope('B'); assert.equal((await fresh.get()).route, undefined); assert.equal((await fresh.get()).settings.notificationType, 'sound');
  setAccountScope('A'); assert.deepEqual((await fresh.get()).route, saved); setAccountScope(null);
});
test('editing/clearing drafts and canceling do not overwrite the saved plan; explicit replacement and consumption do', async () => {
  setAccountScope('A'); const f = fixture(); const first = await f.plans.saveRoute(route());
  await f.plans.saveEditor([...first.coordinates]); assert.deepEqual((await f.plans.get()).editor, first.coordinates);
  await f.plans.saveEditor([]); assert.deepEqual((await f.plans.get()).editor, []);
  await f.plans.clearEditor(); assert.equal((await f.plans.get()).editor, undefined);
  assert.deepEqual((await f.plans.get()).route, first);
  const second = await f.plans.saveRoute({ ...route(), id: 'plan-2' });
  await f.plans.consumeRoute('plan-1'); assert.deepEqual((await f.plans.get()).route, second);
  await f.plans.consumeRoute('plan-2'); assert.equal((await f.plans.get()).route, undefined); setAccountScope(null);
});
test('a failed plan consumption preserves an attached paused run and retries before discard', async () => {
  const memory=new Map<string,string>(); let fail=true;
  const repo=createRunRepository({storage:{getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>{memory.set(k,v);},removeItem:async k=>{memory.delete(k);}},
    userId:async()=>'A',now:()=>100000,id:()=>'attached',start:async()=>{},stop:async()=>{},consumePlan:async()=>{if(fail)throw new Error('disk full');}});
  await assert.rejects(repo.begin('A','km',1,'background',{plannedRoute:route(),notificationType:'update'}),/disk full/);
  const run=(await repo.get('A'))!; assert.equal(run.status,'paused'); assert.deepEqual(run.plannedRoute,route());
  await assert.rejects(repo.discard('A',run.id),/disk full/); assert.ok(await repo.get('A'));
  fail=false; await repo.discard('A',run.id); assert.equal(await repo.get('A'),null);
});
test('route failures and stale accounts preserve original storage rather than report a successful save', async () => {
  setAccountScope('A'); const scope = getAccountScope();
  const repository = createRunPlanningRepository({ getItem: async () => null, setItem: async () => { throw new Error('disk full'); } });
  await assert.rejects(repository.saveRoute(route()), /disk full/);
  setAccountScope('B'); await assert.rejects(repository.saveRoute(route(), scope), /account changed/);
  const corrupt = createRunPlanningRepository({getItem: async () => '{bad', setItem: async () => { throw new Error('must not overwrite'); }});
  await assert.rejects(corrupt.get(), /preserved/); setAccountScope(null);
});
test('planned route is durably attached to active/recovered/completed runs without changing actual metrics', async () => {
  setAccountScope('A'); const f = fixture(); const plan = await f.plans.saveRoute(route());
  const active = await f.repo.begin('A','km',0.5,'background',{notificationType:'update',plannedRoute:plan});
  assert.equal((await f.plans.get()).route, undefined);
  assert.deepEqual((await f.restart().get('A'))?.plannedRoute,plan);
  f.time(120000); const stopped = await f.repo.finish('A',active.id); const history = runData(stopped,120000);
  assert.deepEqual(history.plannedRoute,plan); assert.equal(history.distanceKm,0); assert.equal(history.durationSeconds,20);
  assert.equal(history.notificationType,'update'); assert.equal(stopped.coordinates.length,0);
  await f.repo.discard('A',active.id); assert.equal(await f.repo.get('A'),null);
  assert.equal((await f.plans.get()).route,undefined); setAccountScope(null);
});
test('repository persists milestones before dispatch, restores cursor, rejects teleports and cancels after pause/end', async () => {
  const f=fixture(); const run=await f.repo.begin('A','km',0.5,'background',{notificationType:'sound'});
  const fixes = Array.from({length:51},(_,i)=>({latitude:40+i*0.0001,longitude:-74,timestamp:100000+i*2000,accuracy:5}));
  f.time(202000); await f.repo.locations(fixes);
  assert.equal(f.events.length,1); assert.equal(f.events[0].milestone.index,1);
  const saved=JSON.parse(f.data.get('swolehouse:v1:A:run-draft')!) as RunDraft;
  assert.equal(saved.notificationIndex,1); assert.equal(saved.latestMilestone?.index,1);
  f.time(204000); await f.restart().locations([{...fixes.at(-1)!,timestamp:203000}]); assert.equal(f.events.length,1);
  await f.repo.pause('A',run.id); assert.ok(f.stops()>0);
  f.time(300000); await f.repo.locations([{latitude:41,longitude:-74,timestamp:250000,accuracy:5}]); assert.equal(f.events.length,1);
  await f.repo.resume('A',run.id); f.time(302000);
  await f.repo.locations([{latitude:40.005,longitude:-74,timestamp:301000,accuracy:5}]);
  f.time(303000); await f.repo.locations([{latitude:41,longitude:-74,timestamp:302000,accuracy:5}]);
  assert.ok((await f.repo.get('A'))!.distanceMeters<600); assert.equal(f.events.length,1);
  f.time(410000);
  await f.repo.locations(Array.from({length:50},(_,i)=>({latitude:40.005+(i+1)*0.0001,longitude:-74,timestamp:304000+i*2000,accuracy:5})));
  assert.equal(f.events.length,2); assert.equal(f.events[1].milestone.index,2);
  await f.repo.finish('A',run.id); f.time(500000); await f.repo.locations([{latitude:42,longitude:-74,timestamp:450000,accuracy:5}]); assert.equal(f.events.length,2);
});
test('legacy active runs without route/audio fields migrate without historical replay or altered elapsed time', async () => {
  const f=fixture(); const run=await f.repo.begin('A','miles',1,'background');
  const key='swolehouse:v1:A:run-draft', stored=JSON.parse(f.data.get(key)!); delete stored.notificationIndex;
  stored.distanceMeters=2*METERS_PER_MILE; f.data.set(key,JSON.stringify(stored));
  const restored=(await f.restart().get('A'))!;
  assert.equal(restored.notificationIndex,2); assert.equal(restored.notificationType,undefined); assert.equal(restored.plannedRoute,undefined);
  assert.equal(elapsedRunSeconds(restored,110000),10); assert.equal(runData(restored,110000).distanceMiles,2);
  await f.repo.finish('A',run.id);
});
test('iOS config enables only intended background capabilities and bundles a small valid original chime', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo config plugins are intentionally CommonJS.
  const plugin = require('../plugins/with-run-background');
  const config = plugin({name:'Swole House',slug:'swole-house'});
  assert.ok(config.mods.ios.infoPlist);
  const bytes=fs.readFileSync('modules/swole-run-audio/ios/Resources/run-ding.wav');
  assert.equal(bytes.toString('ascii',0,4),'RIFF'); assert.equal(bytes.toString('ascii',8,12),'WAVE');
  assert.equal(bytes.readUInt32LE(24),22050); assert.ok(bytes.length<20000);
  const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo; assert.equal(app.ios.bundleIdentifier,'app.replit.swolehouse');
  assert.equal(app.ios.infoPlist.NSMicrophoneUsageDescription,undefined);
});
