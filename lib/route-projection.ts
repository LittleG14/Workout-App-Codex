import type { GeoPoint } from './run-geometry';
export interface MapPixel { x: number; y: number }
/** Serial native projection with a single coalesced pending point. Invalidating
 * a stroke/view discards stale results without losing a newer pending stroke.
 */
export function createRouteProjectionQueue(deps: {
  convert(point: MapPixel): Promise<GeoPoint>; accept(point: GeoPoint): void; error(error: unknown): void;
}) {
  let epoch = 0, busy = false, pending: { point: MapPixel; epoch: number } | null = null;
  async function process(point: MapPixel, captured: number) {
    if (captured !== epoch) return;
    busy = true;
    try { const coordinate = await deps.convert(point); if (captured === epoch) deps.accept(coordinate); }
    catch (error) { if (captured === epoch) deps.error(error); }
    finally {
      busy = false;
      const next = pending; pending = null;
      if (next && next.epoch === epoch) void process(next.point, next.epoch);
    }
  }
  return {
    push(point: MapPixel) {
      if (![point.x, point.y].every(Number.isFinite)) return;
      if (busy) pending = { point, epoch }; else void process(point, epoch);
    },
    cancel() { epoch++; pending = null; },
    isBusy() { return busy || pending !== null; },
  };
}
