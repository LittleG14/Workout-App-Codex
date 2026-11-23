import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { assertAccountScope, getAccountScope } from '@/lib/account-scope';
import { runPlanning } from '@/lib/run-planning';
import { appendRoutePoint, geographicDistance, METERS_PER_MILE, routeDistance, type GeoPoint } from '@/lib/run-geometry';
import { startupDeadline } from '@/lib/startup';
import { createRouteProjectionQueue } from '@/lib/route-projection';

const fallbackRegion = { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.01, longitudeDelta: 0.01 };
export default function TraceRouteScreen() {
  const insets = useSafeAreaInsets(), scope = useRef(getAccountScope());
  const { height } = useWindowDimensions();
  const map = useRef<MapView>(null), points = useRef<GeoPoint[]>([]), meters = useRef(0);
  const alive = useRef(true), revision = useRef(0);
  const lastSample = useRef(0), saving = useRef(false), mapMoving = useRef(false), frameSize = useRef({ width: 0, height: 0 });
  const dirty = useRef(false);
  const [coordinates, setCoordinates] = useState<GeoPoint[]>([]), [distance, setDistance] = useState(0);
  const [draw, setDraw] = useState(false), [ready, setReady] = useState(false), [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [savedId, setSavedId] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [mapTouching, setMapTouching] = useState(false);
  const projection = useRef<ReturnType<typeof createRouteProjectionQueue> | null>(null);
  if (!projection.current) projection.current = createRouteProjectionQueue({
    convert: point => startupDeadline(map.current!.coordinateForPoint(point), 2000, 'The map could not place this point. Reload the map and try again.'),
    accept: geo => {
      if (!alive.current || saving.current) return;
      const next = appendRoutePoint(points.current, geo);
      if (next === points.current) return;
      const last = points.current.at(-1); if (last) meters.current += geographicDistance(last, geo);
      points.current = next; dirty.current = true; setCoordinates(next); setDistance(meters.current); setError('');
    },
    error: err => { if (alive.current) setError(err instanceof Error ? err.message : 'Could not place this map point. Wait for the map and try again.'); },
  });
  const invalidate = () => { revision.current++; projection.current?.cancel(); };
  const redraw = useCallback((value: GeoPoint[]) => { points.current = value; meters.current = routeDistance(value); setCoordinates(value); setDistance(meters.current); }, []);
  const loadPlan = useCallback(async () => {
    try {
      const data = await runPlanning.get(scope.current); assertAccountScope(scope.current);
      if (!alive.current) return;
      const saved = data.route; if (saved) { redraw(saved.coordinates); setSavedId(saved.id); }
      setLoaded(true); setError('');
      if (data.editor) Alert.alert('Recover unsaved trace?', 'This drawing was preserved locally. Your saved route is unchanged until you press Save.', [
        { text: 'Discard draft', style: 'destructive', onPress: () => { void runPlanning.clearEditor(scope.current).catch(() => { if (alive.current) setError('Could not discard the draft. Please retry.'); }); } },
        { text: 'Restore draft', onPress: () => { if (alive.current) { dirty.current = true; redraw(data.editor!); } } },
      ], { cancelable: false });
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not load the saved route.'); }
  }, [redraw]);
  useEffect(() => {
    alive.current = true;
    const converter = projection.current;
    void loadPlan();
    return () => { alive.current = false; converter?.cancel(); };
  }, [loadPlan]);
  useEffect(() => {
    if (!loaded || !dirty.current || busy) return;
    const timer = setTimeout(() => {
      if (saving.current || !dirty.current) return;
      void runPlanning.saveEditor([...points.current], scope.current).catch(() => { if (alive.current) setError('The unsaved drawing could not be backed up. Save before leaving.'); });
    }, 300);
    return () => clearTimeout(timer);
  }, [coordinates, loaded, busy]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && dirty.current && !saving.current) void runPlanning.saveEditor([...points.current], scope.current)
        .catch(() => { if (alive.current) setError('The drawing could not be backed up. Keep the editor open and retry Save.'); });
    });
    return () => listener.remove();
  }, []);
  const changeMode = (value: boolean) => { invalidate(); setDraw(value); setError(''); };
  const centerLocation = useCallback(async (ask: boolean) => {
    const cameraRevision = revision.current;
    try {
      const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (!permission.granted) { if (ask) setError('Location is unavailable. Navigate the map manually to trace a route.'); return; }
      const position = await startupDeadline(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000);
      assertAccountScope(scope.current);
      if (alive.current && cameraRevision === revision.current) map.current?.animateToRegion({ ...position.coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    } catch { if (alive.current) setError('Current location is unavailable. You can navigate and draw anywhere on the map.'); }
  }, []);
  useEffect(() => {
    if (!loaded || !ready) return;
    if (points.current.length > 1) map.current?.fitToCoordinates(points.current, { edgePadding: { top: 40, bottom: 40, left: 30, right: 30 }, animated: false });
    else void centerLocation(false);
  }, [loaded, ready, centerLocation]);
  const trace = (event: GestureResponderEvent, force = false) => {
    if (!ready || !loaded || saving.current || mapMoving.current || event.nativeEvent.touches.length > 1) return;
    const time = Date.now(); if (!force && time - lastSample.current < 75) return;
    lastSample.current = time;
    projection.current?.push({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
  };
  const close = () => {
    if (saving.current) return;
    if (!loaded && !dirty.current) { router.back(); return; }
    const cancel = () => {
      const wasDirty = dirty.current;
      saving.current = true; dirty.current = false; setBusy(true); invalidate();
      void runPlanning.clearEditor(scope.current).then(() => { if (alive.current) router.back(); })
        .catch(() => { dirty.current = wasDirty; if (alive.current) setError('Could not discard the editor draft. Please retry Cancel.'); })
        .finally(() => { saving.current = false; if (alive.current) setBusy(false); });
    };
    if (dirty.current) Alert.alert('Close route editor?', 'Unsaved drawing changes will be discarded. Your previously saved route will be kept.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Close', onPress: cancel },
    ]); else cancel();
  };
  const save = async () => {
    if (saving.current || projection.current?.isBusy()) { setError('Wait for the final drawn point, then Save.'); return; }
    saving.current = true; setBusy(true); invalidate();
    try {
      await runPlanning.saveRoute({ version: 1, id: Crypto.randomUUID(), coordinates: points.current, distanceMeters: meters.current, createdAt: Date.now() }, scope.current);
      assertAccountScope(scope.current); dirty.current = false; if (alive.current) router.back();
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Route was not saved. Please retry.'); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  const clear = () => {
    const apply = () => { invalidate(); dirty.current = true; redraw([]); setError(''); };
    if (points.current.length > 20) Alert.alert('Clear current drawing?', 'Your previously saved route remains unchanged until you save a new route or explicitly remove it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: apply }]);
    else apply();
  };
  const removeSaved = () => Alert.alert('Remove saved plan?', 'Remove the route for your next run? Active runs and workout history will stay unchanged.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => {
      if (!savedId || saving.current) return;
      const wasDirty = dirty.current;
      saving.current = true; setBusy(true);
      dirty.current = false;
      invalidate();
      void runPlanning.consumeRoute(savedId, scope.current).then(() => { if (alive.current) router.back(); })
        .catch(err => { dirty.current = wasDirty; if (alive.current) setError(err instanceof Error ? err.message : 'Could not remove saved plan.'); })
        .finally(() => { saving.current = false; if (alive.current) setBusy(false); });
    } },
  ]);
  return <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={!mapTouching} canCancelContentTouches={false}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel route editing" disabled={busy} style={styles.button} onPress={close}><Text style={styles.text}>Cancel</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Trace Route</Text>
    </View>
    <Text style={styles.distance}>Miles: {(distance / METERS_PER_MILE).toFixed(2)}     Kilometers: {(distance / 1000).toFixed(2)}</Text>
    <View style={styles.row}>
      {['Navigate', 'Draw'].map((label, i) => <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: draw === !!i, disabled: busy || !loaded }}
        disabled={busy || !loaded} style={[styles.button, draw === !!i && styles.active]} onPress={() => changeMode(!!i)}><Text style={styles.text}>{label}</Text></Pressable>)}
      <Pressable accessibilityRole="button" disabled={busy || draw} style={styles.button} onPress={() => void centerLocation(true)}><Text style={styles.text}>My location</Text></Pressable>
    </View>
    <Text style={styles.hint}>{draw ? 'Drag one finger from the line’s end. Switch to Navigate to pan or pinch to zoom.' : 'Pan with one or two fingers and pinch to zoom. Switch to Draw to trace.'}</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!loaded && !!error && <Pressable style={styles.button} accessibilityRole="button" onPress={() => void loadPlan()}><Text style={styles.text}>Retry loading saved plan</Text></Pressable>}
    <View style={[styles.mapFrame, { height: Math.max(240, height * 0.55) }]} onTouchStart={() => setMapTouching(true)}
      onTouchEnd={event => setMapTouching(event.nativeEvent.touches.length > 0)} onTouchCancel={() => setMapTouching(false)}
      onLayout={event => { frameSize.current = event.nativeEvent.layout; invalidate(); }}>
      <MapView key={mapKey} ref={map} provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} initialRegion={fallbackRegion} onMapReady={() => setReady(true)}
        onRegionChange={() => { mapMoving.current = true; invalidate(); }} onRegionChangeComplete={() => { mapMoving.current = false; }}
        scrollEnabled={!draw} zoomEnabled={!draw} rotateEnabled={false} pitchEnabled={false}>
        {coordinates.length > 1 && <Polyline coordinates={coordinates} strokeColor={Colors.cardio} strokeWidth={5} />}
        {!!coordinates.length && <Marker coordinate={coordinates[0]} title="Planned start" pinColor={Colors.cardio} />}
        {coordinates.length > 1 && <Marker coordinate={coordinates[coordinates.length - 1]} title="Continue drawing from here" pinColor={Colors.primary} />}
      </MapView>
      {draw && <View style={StyleSheet.absoluteFill} accessible={false} onStartShouldSetResponder={e => e.nativeEvent.touches.length === 1}
        onMoveShouldSetResponder={e => e.nativeEvent.touches.length === 1} onResponderGrant={e => trace(e, true)}
        onResponderMove={e => trace(e)} onResponderRelease={e => trace(e, true)} onResponderTerminationRequest={() => true} />}
    </View>
    <Text style={styles.hint}>A hand-drawn visual reference, not verified directions. Map tiles need connectivity.</Text>
    <View style={styles.row}>
      {draw && <Pressable accessibilityRole="button" disabled={busy || !ready} style={styles.button}
        onPress={() => { if (!mapMoving.current) projection.current?.push({ x: frameSize.current.width / 2, y: frameSize.current.height / 2 }); }}><Text style={styles.text}>Add map center</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy || !loaded} style={styles.button} onPress={clear}><Text style={styles.text}>Clear</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy || !loaded || !ready} style={[styles.button, styles.active]} onPress={() => void save()}><Text style={styles.text}>{busy ? 'Saving…' : 'Save'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => { changeMode(false); setReady(false); setMapKey(key => key + 1); }}><Text style={styles.text}>Reload map</Text></Pressable>
    </View>
    {savedId && <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={removeSaved}><Text style={styles.text}>Remove saved route</Text></Pressable>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 12 },
  title: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.text, flexShrink: 1 },
  text: { color: Colors.text, fontFamily: 'Rubik_600SemiBold', textAlign: 'center', flexShrink: 1 },
  distance: { color: Colors.cardio, fontFamily: 'Rubik_600SemiBold', fontSize: 16, paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  button: { flexGrow: 1, minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  active: { backgroundColor: `${Colors.cardio}30`, borderColor: Colors.cardio },
  mapFrame: { minHeight: 240 }, hint: { color: Colors.textSecondary, fontFamily: 'Rubik_400Regular', fontSize: 12, padding: 8 },
  error: { color: Colors.error, padding: 10 },
});
