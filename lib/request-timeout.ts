/** RN 0.81 uses abort-controller 3, which has no AbortSignal.timeout(). */
export async function withRequestTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal, milliseconds = 20000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, milliseconds);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', abort); }
}
