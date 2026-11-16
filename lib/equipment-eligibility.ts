import { normalizeEquipment, isImplicitEquipment, validateEquipmentPreferences, type EquipmentPreferences } from '../shared/equipment';

// Requirements omitted from legacy display tags. Applied only to new automatic choices.
// Unknown apparatus deliberately excludes an ambiguous movement for configured users.
const additionalRequirements: Record<string, string[]> = {
  e1: ['Bench'], e2: ['Bench'], e3: ['Bench'], e5: ['Bench'],
  e7: ['Dip station (unverified)'], e11: ['Dip support (unverified)'],
  e12: ['Bench'], e15: ['Bench'], e19: ['Pull-Up Bar'], e27: ['Pull-Up Bar'],
  e31: ['Preacher bench (unverified)'], e33: ['Bench'], e34: ['Bench'],
  e43: ['Pull-Up Bar'], e55: ['Bench'], e61: ['Bench'], e67: ['Bench'], e68: ['Bench'],
};
export function isExerciseEligible(
  exercise: { id?: string; equipment: unknown }, preferences?: EquipmentPreferences,
): boolean {
  if (preferences === undefined) return true; // Backward-compatible standalone generator API.
  const pref = validateEquipmentPreferences(preferences);
  if (!pref.configured) return true;
  if (typeof exercise.equipment !== 'string' || !exercise.equipment.trim()) return false;
  // Existing slash strings have no documented OR contract. Do not guess alternatives.
  if (exercise.equipment.includes('/')) return false;
  let equipment = exercise.equipment;
  if (['c8', 'cm7'].includes(exercise.id ?? '') && equipment === 'Bike') equipment = 'Assault Bike';
  const requirements = [...equipment.split(/\s*[+&]\s*/), ...(additionalRequirements[exercise.id ?? ''] ?? [])];
  return requirements.every(raw => {
    const requirement = normalizeEquipment(raw);
    return requirement !== null && (isImplicitEquipment(requirement) || pref.availableEquipment.includes(requirement));
  });
}
