import { RunData } from './exercises';

let pendingRun: RunData | null = null;

export function setPendingRun(data: RunData): void {
  pendingRun = data;
}

export function consumePendingRun(): RunData | null {
  const d = pendingRun;
  pendingRun = null;
  return d;
}
