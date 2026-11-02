/** Bound startup waits without pretending a timed-out SDK operation was cancelled. */
export function startupDeadline<T>(operation: Promise<T>, milliseconds = 15000, message = 'Startup took too long. Check your connection and try again.'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
