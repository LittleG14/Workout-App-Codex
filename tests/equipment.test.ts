import test from 'node:test';
import assert from 'node:assert/strict';
import { isExerciseEligible } from '../lib/equipment-eligibility';
import { EQUIPMENT_METADATA_KEY, AVAILABLE_EQUIPMENT_OPTIONS, equipmentPreferencesFromMetadata, validateEquipmentPreferences, normalizeEquipment, type EquipmentPreferences } from '../shared/equipment';
import { generateWorkout, findReplacementExercise, findCoreReplacementExercise, pickRandomNewExercise, rebalanceCircuit,
  WEIGHT_EXERCISES, CIRCUIT_EXERCISES, type CustomExerciseData, type GeneratedWorkout, type TopCategory } from '../lib/exercises';
import { createEquipmentRepository } from '../lib/equipment-repository';
import { setAccountScope, getAccountScope } from '../lib/account-scope';

const pref = (availableEquipment: string[]): EquipmentPreferences => validateEquipmentPreferences({ configured: true, availableEquipment });
const dumbbells = pref(['Dumbbells']);
function allExercises(w: GeneratedWorkout) {
  return [...w.exercises, ...(w.supersets ?? []).flatMap(p => [p.exerciseA, p.exerciseB]),
    ...(w.circuitBlocks ?? []).flatMap(b => b.exercises)].map(e => e.exercise);
}
test('eligibility requires every recognized external item and always permits explicit bodyweight/none', () => {
  for (const [equipment, available, allowed] of [
    ['Dumbbells', ['Dumbbells'], true], ['Bodyweight', ['Dumbbells'], true], ['None', [], true],
    ['Barbell', ['Dumbbells'], false], ['Dumbbells + Bench', ['Dumbbells'], false],
    ['Dumbbells + Bench', ['Dumbbells','Bench'], true],
    ['Dumbbells + Resistance Bands', ['Dumbbells','Resistance Band'], true],
    ['Dumbbells + Bodyweight', ['Dumbbells'], true], ['Bodyweight', [], true], ['Dumbbells', [], false],
    ['Unknown', ['Dumbbells'], false], ['', ['Dumbbells'], false], [null, ['Dumbbells'], false],
    ['Dumbbells + Unknown', ['Dumbbells'], false], ['Dumbbells / Barbell', ['Dumbbells','Barbell'], false],
  ] as [unknown, string[], boolean][]) assert.equal(isExerciseEligible({ equipment }, pref(available)), allowed, String(equipment));
});
test('unconfigured remains unrestricted; invalid metadata never becomes unconfigured', () => {
  assert.deepEqual(equipmentPreferencesFromMetadata({ name: 'kept' }), { configured: false, availableEquipment: [] });
  assert.equal(isExerciseEligible({ equipment: 'Unknown' }, { configured: false, availableEquipment: [] }), true);
  assert.equal(isExerciseEligible({ equipment: 'Unknown' }), true);
  for (const value of [null, {}, { configured: true, availableEquipment: ['Unknown'] }, { configured: 'false', availableEquipment: [] }]) {
    assert.throws(() => equipmentPreferencesFromMetadata({ [EQUIPMENT_METADATA_KEY]: value }));
  }
  assert.throws(() => equipmentPreferencesFromMetadata(null));
});
test('canonical vocabulary normalizes aliases without inventing new selectable categories', () => {
  assert.equal(normalizeEquipment(' dumbbell '), 'Dumbbells'); assert.equal(normalizeEquipment('Ropes'), 'Battle Ropes');
  assert.equal(normalizeEquipment({}), null); assert.equal(normalizeEquipment('Pool'), null);
  assert.equal(normalizeEquipment('__proto__'), null); assert.equal(normalizeEquipment('constructor'), null);
  assert.deepEqual(pref(['Dumbbell','Dumbbells','Bodyweight','None']).availableEquipment, ['Dumbbells']);
  assert.ok(!AVAILABLE_EQUIPMENT_OPTIONS.some(e => ['Bodyweight','None'].includes(e)));
});
test('legacy incomplete apparatus and slash tags fail conservatively for configured users', () => {
  assert.equal(isExerciseEligible(WEIGHT_EXERCISES.find(e => e.id === 'e2')!, dumbbells), false);
  assert.equal(isExerciseEligible(WEIGHT_EXERCISES.find(e => e.id === 'e2')!, pref(['Dumbbells','Bench'])), true);
  assert.equal(isExerciseEligible(WEIGHT_EXERCISES.find(e => e.id === 'e19')!, pref([])), false);
  assert.equal(isExerciseEligible(WEIGHT_EXERCISES.find(e => e.id === 'e19')!, pref(['Pull-Up Bar'])), true);
  assert.equal(isExerciseEligible({ equipment: 'Kettlebell / Bodyweight' }, dumbbells), false);
});
test('dumbbell-only integration covers all automatic workout categories, durations and core/supersets', () => {
  const variants: [TopCategory, string[]][] = [
    ['weight_lifting',['chest_triceps','shoulders_abs','legs','full_body','push','pull','back_biceps']],
    ['circuit',['amrap','emom','rounds_for_time','hyrox']], ['cardio',['running','mixed_cardio']],
    ['mobility',['full_body','lower_body','upper_body','hips_and_spine']],
  ];
  for (const [category, types] of variants) for (const subtype of types) for (const duration of [30,45,60,90]) {
    const w = generateWorkout(category, subtype, category === 'weight_lifting' ? 'hypertrophy' : subtype,
      duration, true, true, [], [], dumbbells);
    assert.ok(allExercises(w).length);
    assert.ok(allExercises(w).every(e => isExerciseEligible(e, dumbbells)), `${category}/${subtype}/${duration}`);
    if (category === 'weight_lifting') assert.ok(w.exercises.every(e => e.sets > 0));
    if (category === 'cardio' && subtype === 'running') assert.ok(w.exercises.every(e => !e.notes?.includes('uphill')));
    assert.ok(w.circuitBlocks?.every(b => b.exercises.length && (b.rounds === undefined || Number.isFinite(b.rounds))) ?? true);
  }
});
test('sparse/empty pools never widen equipment restrictions; smaller valid workouts and helpful failures', () => {
  const bodyweight = pref([]);
  const w = generateWorkout('weight_lifting','chest_triceps','strength',90,false,false,[],[],bodyweight);
  assert.ok(w.exercises.length < 8); assert.ok(allExercises(w).every(e => isExerciseEligible(e, bodyweight)));
  assert.throws(() => generateWorkout('yoga','flexibility','flexibility',30,false,false,[],[],bodyweight), /Available Equipment/);
  assert.throws(() => generateWorkout('weight_lifting','back_biceps','strength',30,false,false,[],[],bodyweight), /Available Equipment/);
  const yoga = generateWorkout('yoga','flexibility','flexibility',30,false,false,[],[],pref(['Mat']));
  assert.ok(allExercises(yoga).every(e => isExerciseEligible(e, pref(['Mat']))));
});
test('refresh, random add, core and superset partner selectors obey current preferences and exclusions', () => {
  const current = WEIGHT_EXERCISES[0];
  for (let i=0; i<40; i++) {
    for (const e of [findReplacementExercise(current,'weight_lifting','full_body',[],[],[],dumbbells),
      findCoreReplacementExercise(current,[],[],[],dumbbells), pickRandomNewExercise('weight_lifting','full_body',[],[],[],dumbbells)]) {
      assert.ok(e && isExerciseEligible(e,dumbbells));
    }
  }
  assert.equal(pickRandomNewExercise('yoga','core_strength',[],[],[],pref([])),null);
  const hidden = CIRCUIT_EXERCISES.map(e=>e.id);
  assert.equal(pickRandomNewExercise('circuit','emom',[],[],hidden,dumbbells),null);
});
test('circuit expansion filters only new selections and preserves existing manually chosen/history entries', () => {
  const old = generateWorkout('circuit','emom','emom',30);
  const snapshot = JSON.stringify(old), existing = new Set(allExercises(old).map(e=>e.id));
  const updated = rebalanceCircuit(old,'more_movements',[],[],dumbbells);
  assert.equal(JSON.stringify(old),snapshot);
  assert.ok(allExercises(updated).filter(e=>!existing.has(e.id)).every(e=>isExerciseEligible(e,dumbbells)));
  const restricted = generateWorkout('circuit','emom','emom',30,false,false,[],[],dumbbells);
  assert.ok(allExercises(rebalanceCircuit(restricted,'more_movements',[],[],dumbbells)).every(e=>isExerciseEligible(e,dumbbells)));
});
test('custom requirements survive generation, including multiple simultaneous items', () => {
  const custom: CustomExerciseData = { id:'cx_test', name:'Custom press', muscles:['chest'], equipment:'Dumbbells + Bench', type:'compound', topCategories:['weight_lifting'], weightSubCategories:['chest_triceps'] };
  const hidden = WEIGHT_EXERCISES.map(e=>e.id);
  assert.throws(()=>generateWorkout('weight_lifting','chest_triceps','strength',30,false,false,[custom],hidden,dumbbells));
  const w=generateWorkout('weight_lifting','chest_triceps','strength',30,false,false,[custom],hidden,pref(['Dumbbells','Bench']));
  assert.equal(w.exercises[0].exercise.equipment,custom.equipment);
  assert.equal(custom.equipment,'Dumbbells + Bench');
});
test('confirmed remote preferences persist per account, preserve profile metadata and survive repository recreation', async () => {
  const users = new Map<string, Record<string, unknown>>();
  const transport = {
    async read(scope: {userId:string}) { return {id:scope.userId,user_metadata:users.get(scope.userId) ?? {name:'untouched'}}; },
    async write(scope: {userId:string}, data: Record<string,unknown>) { users.set(scope.userId,{name:'untouched',...users.get(scope.userId),...data}); return this.read(scope); },
  };
  const repo=createEquipmentRepository(transport);
  setAccountScope('equipment-A');
  assert.equal((await repo.load()).configured,false);
  for (const selection of [['Dumbbells'], ['Dumbbells','Bench'], []]) {
    await repo.save(pref(selection)); assert.deepEqual(await repo.load(),pref(selection));
  }
  assert.equal(users.get('equipment-A')?.name,'untouched');
  setAccountScope(null); setAccountScope('equipment-B'); assert.equal((await repo.load()).configured,false);
  await repo.save(pref(['Barbell']));
  setAccountScope('equipment-A'); assert.deepEqual(await createEquipmentRepository(transport).load(),pref([]));
  assert.deepEqual(users.get('equipment-B')?.[EQUIPMENT_METADATA_KEY],pref(['Barbell']));
  setAccountScope(null);
});
test('failed fetches/saves and malformed or foreign responses reject rather than authorize unrestricted generation', async () => {
  setAccountScope('equipment-A');
  const failures = createEquipmentRepository({read:async()=>{throw new Error('offline');},write:async()=>{throw new Error('offline');}});
  await assert.rejects(failures.load(),/offline/); await assert.rejects(failures.save(dumbbells),/offline/);
  const foreign=createEquipmentRepository({read:async()=>({id:'equipment-B',user_metadata:{}}),write:async()=>({id:'equipment-B',user_metadata:{}})});
  await assert.rejects(foreign.load(),/match/); await assert.rejects(foreign.save(dumbbells),/match/);
  const unconfirmed=createEquipmentRepository({read:async()=>({id:'equipment-A',user_metadata:{}}),write:async()=>({id:'equipment-A',user_metadata:{}})});
  await assert.rejects(unconfirmed.save(dumbbells),/not confirmed/);
  const wrapped=createEquipmentRepository({read:async()=>({user:{id:'equipment-A',user_metadata:{[EQUIPMENT_METADATA_KEY]:dumbbells}}}),
    write:async(scope,data)=>({user:{id:scope.userId,user_metadata:data}})});
  assert.deepEqual(await wrapped.load(),dumbbells); assert.deepEqual(await wrapped.save(pref([])),pref([]));
  setAccountScope(null);
});
function deferred<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>{resolve=r;}); return {promise,resolve}; }
test('late account responses, logout/relogin and conflicting saves cannot alter the next account', async () => {
  setAccountScope('equipment-A'); const scope=getAccountScope(); const pending=deferred<unknown>();
  const repo=createEquipmentRepository({read:()=>pending.promise,write:()=>pending.promise});
  const saving=repo.save(dumbbells); await assert.rejects(repo.save(pref([])),/already/);
  await assert.rejects(repo.load(),/being saved/);
  setAccountScope(null); setAccountScope('equipment-A');
  pending.resolve({id:'equipment-A',user_metadata:{[EQUIPMENT_METADATA_KEY]:dumbbells}});
  await assert.rejects(saving,/account changed/); await assert.rejects(repo.load(scope),/account changed/);
  setAccountScope(null);
});
test('a stale load cannot overwrite a newer confirmed save', async () => {
  setAccountScope('equipment-A'); const pending=deferred<unknown>(); let writes=0;
  const repo=createEquipmentRepository({read:()=>pending.promise,write:async(scope,data)=>{writes++;return {id:scope.userId,user_metadata:data};}});
  const loading=repo.load();
  assert.equal(writes,0);
  await repo.save(pref([]));
  pending.resolve({id:'equipment-A',user_metadata:{}});
  await assert.rejects(loading,/changed while loading/); assert.equal(writes,1);
  setAccountScope(null);
});
