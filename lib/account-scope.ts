export type AccountScope = Readonly<{ userId: string; generation: number }>;
let active: AccountScope | null = null;
let generation = 0;

/** Called synchronously on every identity change, before rendering account screens. */
export function setAccountScope(userId: string | null): boolean {
  if ((active?.userId ?? null) === userId) return false;
  generation += 1;
  active = userId ? Object.freeze({ userId, generation }) : null;
  return true;
}

export function getAccountScope(): AccountScope {
  if (!active) throw new Error('Please sign in to access your data.');
  return active;
}

export function assertAccountScope(scope: AccountScope): void {
  if (active !== scope) throw new Error('Your account changed. Please try again.');
}

export function accountStorageKey(scope: AccountScope, name: string): string {
  return `swolehouse:v1:${encodeURIComponent(scope.userId)}:${name}`;
}
