import { fetch } from 'expo/fetch';
import { createEquipmentRepository } from './equipment-repository';
import { getTokenForAccount } from './auth-storage';
import { assertAccountScope, type AccountScope } from './account-scope';
import { assertClientConfigured, clientEnvironment } from './client-config';
import { withRequestTimeout } from './request-timeout';

async function request(scope: AccountScope, data?: Record<string, unknown>) {
  assertClientConfigured();
  const token = await getTokenForAccount(scope);
  assertAccountScope(scope);
  const response = await withRequestTimeout(signal => fetch(new URL('/auth/v1/user', clientEnvironment.supabaseUrl!).href, {
    method: data ? 'PUT' : 'GET', signal,
    headers: { apikey: clientEnvironment.supabaseKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // Supabase merges only this metadata field; never send the rest of a stale profile.
    body: data ? JSON.stringify({ data }) : undefined,
  }));
  assertAccountScope(scope);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Your session has expired. Please sign in again.');
    throw new Error(data ? 'Equipment could not be saved. Check your connection and retry.' : 'Equipment could not be loaded. Check your connection and retry.');
  }
  const result: unknown = await response.json(); assertAccountScope(scope); return result;
}
export const equipmentRepository = createEquipmentRepository({ read: scope => request(scope), write: request });
