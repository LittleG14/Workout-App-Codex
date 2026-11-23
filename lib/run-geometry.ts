export interface GeoPoint { latitude: number; longitude: number }
export const METERS_PER_MILE = 1609.34; // Same conversion as existing run metrics.
export const MAX_ROUTE_POINTS = 2048;
export function validGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== 'object') return false;
  const p = value as GeoPoint;
  return Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
export function geographicDistance(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export interface PlannedRoute { version: 1; id: string; coordinates: GeoPoint[]; distanceMeters: number; createdAt: number }
export function routeDistance(points: readonly GeoPoint[]): number {
  return points.reduce((sum, point, i) => sum + (i ? geographicDistance(points[i - 1], point) : 0), 0);
}
export function validatePlannedRoute(value: unknown): PlannedRoute {
  const route = value as PlannedRoute;
  if (!route || route.version !== 1 || typeof route.id !== 'string' || !route.id || route.id.length > 100
    || !Number.isFinite(route.createdAt) || !Array.isArray(route.coordinates)
    || route.coordinates.length < 2 || route.coordinates.length > MAX_ROUTE_POINTS || !route.coordinates.every(validGeoPoint)) throw new Error('The planned route is invalid. Clear and redraw it.');
  const coordinates = route.coordinates.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
  const distanceMeters = routeDistance(coordinates);
  if (distanceMeters < 20 || distanceMeters > 500000
    || coordinates.some((p, i) => i > 0 && geographicDistance(coordinates[i - 1], p) > 150)) throw new Error('Trace at least 20 meters using nearby points. Zoom in to keep each drawn segment under 150 meters.');
  return { version: 1, id: route.id, coordinates, distanceMeters, createdAt: route.createdAt };
}
/** Incremental editor geometry; no screen pixels are stored in the route. */
export function appendRoutePoint(points: readonly GeoPoint[], point: GeoPoint): GeoPoint[] {
  if (!validGeoPoint(point)) throw new Error('Could not place this map point. Try again.');
  const last = points.at(-1), segment = last ? geographicDistance(last, point) : 0;
  if (last && segment < 2) return points as GeoPoint[];
  if (segment > 150) throw new Error('Continue from the end of your line, or zoom in before drawing.');
  if (points.length >= MAX_ROUTE_POINTS) throw new Error('This trace has reached its point limit. Save it or clear and redraw at a wider scale.');
  return [...points, { latitude: point.latitude, longitude: point.longitude }];
}
