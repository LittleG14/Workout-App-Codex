/** Shared vocabulary used by custom creation, preferences, and API validation. */
export const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbells', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell',
  'Medicine Ball', 'Jump Rope', 'Mat', 'Plyo Box', 'Battle Ropes', 'Ski Erg',
  'Sled', 'Rower', 'Assault Bike', 'Sandbag', 'Rings', 'Ab Wheel',
  'Pull-Up Bar', 'Bench', 'Resistance Band', 'None',
] as const;
export type Equipment = typeof EQUIPMENT_OPTIONS[number];
const aliases: Record<string, Equipment> = {
  dumbbell: 'Dumbbells', barbells: 'Barbell', kettlebells: 'Kettlebell',
  bands: 'Resistance Band', 'resistance bands': 'Resistance Band',
  'cable machine': 'Cable', 'no equipment': 'None', 'body weight': 'Bodyweight',
  ropes: 'Battle Ropes',
};
export function normalizeEquipment(value: unknown): Equipment | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return EQUIPMENT_OPTIONS.find(option => option.toLowerCase() === key)
    ?? (Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : null);
}
export function isImplicitEquipment(value: Equipment): boolean {
  return value === 'Bodyweight' || value === 'None';
}
export const AVAILABLE_EQUIPMENT_OPTIONS = EQUIPMENT_OPTIONS.filter(e => !isImplicitEquipment(e));
export interface EquipmentPreferences { configured: boolean; availableEquipment: Equipment[] }
export const EQUIPMENT_METADATA_KEY = 'available_equipment_v1';
export function validateEquipmentPreferences(value: unknown): EquipmentPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Equipment preferences could not be read. Please retry or save your equipment again.');
  const pref = value as Record<string, unknown>;
  if (typeof pref.configured !== 'boolean' || !Array.isArray(pref.availableEquipment)
    || pref.availableEquipment.length > EQUIPMENT_OPTIONS.length) throw new Error('Invalid equipment preferences.');
  const normalized = pref.availableEquipment.map(normalizeEquipment);
  if (normalized.some(e => e === null)) throw new Error('Unknown equipment in preferences. Please review your equipment.');
  const availableEquipment = AVAILABLE_EQUIPMENT_OPTIONS.filter(e => normalized.includes(e));
  if (!pref.configured && availableEquipment.length) throw new Error('Invalid unconfigured equipment preferences.');
  return { configured: pref.configured, availableEquipment };
}
export function equipmentPreferencesFromMetadata(metadata: unknown): EquipmentPreferences {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Account preferences could not be loaded. Please retry.');
  if (!Object.prototype.hasOwnProperty.call(metadata, EQUIPMENT_METADATA_KEY)) return { configured: false, availableEquipment: [] };
  return validateEquipmentPreferences((metadata as Record<string, unknown>)[EQUIPMENT_METADATA_KEY]);
}
