/** Native-session storage independent of React Native so failure paths can be tested. */
export interface SecureKeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const CHUNK_BYTES = 1800;
const MAX_CHUNKS = 128;
type Generation = { id: string; count: number };
type Manifest = { version: 2; current: Generation | null; retired: Generation[]; legacy: boolean };

function chunksByBytes(value: string): string[] {
  const chunks: string[] = [];
  let part = '';
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const size = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + size > CHUNK_BYTES) { chunks.push(part); part = ''; bytes = 0; }
    part += char;
    bytes += size;
  }
  chunks.push(part);
  if (chunks.length > MAX_CHUNKS) throw new Error('Session is too large to store securely.');
  return chunks;
}

function validGeneration(value: unknown): value is Generation {
  if (!value || typeof value !== 'object') return false;
  const g = value as Generation;
  return typeof g.id === 'string' && /^[a-z0-9]+$/.test(g.id)
    && Number.isInteger(g.count) && g.count > 0 && g.count <= MAX_CHUNKS;
}

export function createSecureSessionStorage(store: SecureKeyValueStore) {
  const queues = new Map<string, Promise<unknown>>();
  let sequence = 0;
  function serial<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.set(key, next);
    void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
    return next;
  }
  const manifestKey = (key: string) => `${key}_v2`;
  const chunkKey = (key: string, gen: Generation, index: number) => `${key}_v2_${gen.id}_${index}`;
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await store.getItemAsync(manifestKey(key));
    if (raw === null) return null;
    let m: Manifest;
    try { m = JSON.parse(raw); } catch { throw new Error('Stored session metadata is invalid.'); }
    if (m?.version !== 2 || (m.current !== null && !validGeneration(m.current))
      || !Array.isArray(m.retired) || m.retired.length > MAX_CHUNKS
      || !m.retired.every(validGeneration) || typeof m.legacy !== 'boolean') {
      throw new Error('Stored session metadata is invalid.');
    }
    return m;
  }
  async function clean(key: string, m: Manifest): Promise<void> {
    for (const gen of m.retired) {
      for (let i = 0; i < gen.count; i++) await store.deleteItemAsync(chunkKey(key, gen, i));
    }
    if (m.legacy) {
      // Older adapters left unindexed chunks after shrinking; sweep a bounded legacy range.
      for (let i = 0; i < MAX_CHUNKS; i++) await store.deleteItemAsync(`${key}_${i}`);
      await store.deleteItemAsync(key);
      await store.deleteItemAsync(`${key}_count`);
    }
    await store.setItemAsync(manifestKey(key), JSON.stringify({ ...m, retired: [], legacy: false }));
  }
  return {
    getItem(key: string): Promise<string | null> {
      return serial(key, async () => {
        const m = await manifest(key);
        if (m) {
          if (!m.current) return null;
          const parts: string[] = [];
          for (let i = 0; i < m.current.count; i++) {
            const part = await store.getItemAsync(chunkKey(key, m.current, i));
            if (part === null) throw new Error('Stored session is incomplete. Please sign in again.');
            parts.push(part);
          }
          return parts.join('');
        }
        const rawCount = await store.getItemAsync(`${key}_count`);
        if (rawCount === null) return store.getItemAsync(key);
        const count = Number(rawCount);
        if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) {
          throw new Error('Stored session metadata is invalid.');
        }
        const parts: string[] = [];
        for (let i = 0; i < count; i++) {
          const part = await store.getItemAsync(`${key}_${i}`);
          if (part === null) throw new Error('Stored session is incomplete. Please sign in again.');
          parts.push(part);
        }
        return parts.join('');
      });
    },
    setItem(key: string, value: string): Promise<void> {
      return serial(key, async () => {
        const previous = await manifest(key);
        const parts = chunksByBytes(value);
        const next = { id: `${Date.now().toString(36)}${(++sequence).toString(36)}${Math.random().toString(36).slice(2)}`, count: parts.length };
        const m: Manifest = { version: 2, current: next,
          retired: [...(previous?.retired ?? []), ...(previous?.current ? [previous.current] : [])],
          legacy: previous?.legacy ?? true };
        if (m.retired.length > MAX_CHUNKS) throw new Error('Session cleanup must complete before another update.');
        try {
          for (let i = 0; i < parts.length; i++) await store.setItemAsync(chunkKey(key, next, i), parts[i]);
          // Publish only after every new chunk exists. A failed write leaves the old session readable.
          await store.setItemAsync(manifestKey(key), JSON.stringify(m));
        } catch (error) {
          for (let i = 0; i < parts.length; i++) await store.deleteItemAsync(chunkKey(key, next, i)).catch(() => {});
          throw error;
        }
        await clean(key, m);
      });
    },
    removeItem(key: string): Promise<void> {
      return serial(key, async () => {
        const previous = await manifest(key);
        const m: Manifest = { version: 2, current: null,
          retired: [...(previous?.retired ?? []), ...(previous?.current ? [previous.current] : [])],
          legacy: previous?.legacy ?? true };
        // Tombstone prevents interrupted deletion from reviving an old session.
        await store.setItemAsync(manifestKey(key), JSON.stringify(m));
        await clean(key, m);
      });
    },
  };
}
