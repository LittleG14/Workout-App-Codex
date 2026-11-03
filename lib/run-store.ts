import { RunData } from './exercises';
import { assertAccountScope, type AccountScope } from './account-scope';

let pendingRun: { data: RunData; scope: AccountScope } | null = null;

export function setPendingRun(data: RunData, scope: AccountScope): void {
  assertAccountScope(scope);
  pendingRun = { data, scope };
}

export function consumePendingRun(): RunData | null {
  const d = pendingRun;
  pendingRun = null;
  if (!d) return null;
  try { assertAccountScope(d.scope); return d.data; }
  catch { return null; }
}

export function clearPendingRun(): void { pendingRun = null; }
