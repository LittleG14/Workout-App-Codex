import { assertAccountScope, getAccountScope, type AccountScope } from './account-scope';
import { EQUIPMENT_METADATA_KEY, equipmentPreferencesFromMetadata, validateEquipmentPreferences, type EquipmentPreferences } from '../shared/equipment';

export interface EquipmentTransport {
  read(scope: AccountScope): Promise<unknown>;
  write(scope: AccountScope, data: Record<string, unknown>): Promise<unknown>;
}
function fromUser(raw: unknown, scope: AccountScope): EquipmentPreferences {
  // Match Auth JS's supported direct-user and {user} response representations.
  const wrapped = raw && typeof raw === 'object' ? (raw as { user?: unknown }).user : null;
  const user = wrapped ?? raw;
  if (!user || typeof user !== 'object' || (user as { id?: unknown }).id !== scope.userId) throw new Error('Account preferences did not match your account. Please sign in again.');
  return equipmentPreferencesFromMetadata((user as { user_metadata?: unknown }).user_metadata);
}
/** No device-global preference cache; authority always comes from authenticated Auth API. */
export function createEquipmentRepository(transport: EquipmentTransport) {
  const saving = new Set<AccountScope>();
  const revisions = new WeakMap<AccountScope, number>();
  return {
    async load(scope = getAccountScope()): Promise<EquipmentPreferences> {
      assertAccountScope(scope);
      if (saving.has(scope)) throw new Error('Equipment is being saved. Please try again in a moment.');
      const revision = revisions.get(scope) ?? 0;
      const user = await transport.read(scope);
      assertAccountScope(scope);
      if (saving.has(scope) || revision !== (revisions.get(scope) ?? 0)) throw new Error('Equipment changed while loading. Please retry.');
      return fromUser(user, scope);
    },
    async save(value: unknown, scope = getAccountScope()): Promise<EquipmentPreferences> {
      assertAccountScope(scope);
      const pref = validateEquipmentPreferences(value);
      if (!pref.configured) throw new Error('Save an explicit equipment selection.');
      if (saving.has(scope)) throw new Error('An equipment save is already in progress.');
      saving.add(scope); revisions.set(scope, (revisions.get(scope) ?? 0) + 1);
      try {
        const user = await transport.write(scope, { [EQUIPMENT_METADATA_KEY]: pref });
        assertAccountScope(scope);
        const saved = fromUser(user, scope);
        if (JSON.stringify(saved) !== JSON.stringify(pref)) throw new Error('Equipment save was not confirmed. Reload and retry.');
        return saved;
      } finally { saving.delete(scope); }
    },
  };
}
