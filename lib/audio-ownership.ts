/** One native audio-session owner. Canceling a circuit must not stop a run update. */
export function createAudioOwnership(adapter: { play(kind: string, text: string): Promise<void>; stop(): Promise<void> }) {
  let owner: { key: symbol } | null = null;
  return {
    async play(key: symbol, kind: string, text: string) {
      if (owner) throw new Error('Another workout announcement is playing. This chime was skipped.');
      const claim = { key }; owner = claim;
      try { await adapter.play(kind, text); } finally { if (owner === claim) owner = null; }
    },
    stop(key: symbol) { if (owner?.key === key) { owner = null; void adapter.stop().catch(() => {}); } },
  };
}
