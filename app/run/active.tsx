import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  Platform,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { ownRun, runs } from '@/lib/run-tracking';
import { elapsedRunSeconds, type RunDraft } from '@/lib/run-repository';
import { getAccountScope, assertAccountScope } from '@/lib/account-scope';
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPace(secsPerUnit: number): string {
  if (!isFinite(secsPerUnit) || secsPerUnit <= 0 || secsPerUnit > 3600) return "--:--";
  const m = Math.floor(secsPerUnit / 60);
  const s = Math.floor(secsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ActiveRunScreen() {
  const runScope = useRef(getAccountScope());
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const lastMilestoneRef = useRef(0);
  const mapRef = useRef<MapView>(null);
  const refresh = useCallback(async () => {
    assertAccountScope(runScope.current);
    const run = await ownRun(); assertAccountScope(runScope.current);
    if (!run) { router.replace('/run/setup'); return; }
    if (run.status === 'stopped') { router.replace('/run/summary'); return; }
    setDraft(run); setNow(Date.now());
  }, []);
  useEffect(() => {
    let mounted = true;
    let reading = false;
    const load = async () => {
      if (reading || !mounted) return;
      reading = true;
      try {
        const run = await ownRun(); assertAccountScope(runScope.current);
        if (!mounted) return;
        if (!run) { router.replace('/run/setup'); return; }
        if (run.status === 'stopped') { router.replace('/run/summary'); return; }
        setDraft(run); setNow(Date.now());
      } catch (error) {
        if (mounted) setMilestoneMsg(error instanceof Error ? error.message : 'Could not read your run.');
      } finally { reading = false; }
    };
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { mounted = false; clearInterval(timer); listener.remove(); };
  }, []);
  const unit = draft?.unit ?? 'miles';
  const notifInterval = draft?.notifInterval ?? 0;
  const coordinates = draft?.coordinates ?? [];
  const paused = draft?.status !== 'running';
  const elapsed = draft ? elapsedRunSeconds(draft, now) : 0;
  const distanceMeters = draft?.distanceMeters ?? 0;
  useEffect(() => {
    const latest = draft?.coordinates.at(-1);
    if (latest) mapRef.current?.animateToRegion({ ...latest, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
    const dist = unit === 'miles' ? distanceMeters / 1609.34 : distanceMeters / 1000;
    const milestone = notifInterval > 0 ? Math.floor(dist / notifInterval) * notifInterval : 0;
    if (milestone > lastMilestoneRef.current) {
      lastMilestoneRef.current = milestone;
      setMilestoneMsg(milestone + ' ' + (unit === 'miles' ? 'mi' : 'km') + ' reached!');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [draft?.coordinates, distanceMeters, unit, notifInterval]);
  useEffect(() => {
    if (!milestoneMsg) return;
    const timer = setTimeout(() => setMilestoneMsg(null), 3500);
    return () => clearTimeout(timer);
  }, [milestoneMsg]);
  const control = async (action: 'pause' | 'resume' | 'finish') => {
    if (!draft || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      assertAccountScope(runScope.current);
      await runs[action](runScope.current.userId, draft.id);
      assertAccountScope(runScope.current);
      if (action === 'finish') router.replace('/run/summary');
      else await refresh();
    } catch (error) { Alert.alert('Run needs attention', error instanceof Error ? error.message : 'Please try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const handlePause = () => { void control(paused ? 'resume' : 'pause'); };
  const handleStop = () => Alert.alert('End Workout?', 'Your run will be kept as a draft. Save it to your history on the next screen.', [
    { text: 'Keep Running', style: 'cancel' },
    { text: 'Stop Run', onPress: () => { void control('finish'); } },
  ]);

  const distInUnit = unit === "miles" ? distanceMeters / 1609.34 : distanceMeters / 1000;
  const paceSecsPerUnit = unit === "miles"
    ? (distInUnit > 0 ? elapsed / distInUnit : 0)
    : (distInUnit > 0 ? elapsed / distInUnit : 0);
  const unitLabel = unit === "miles" ? "mi" : "km";
  const paceLabel = unit === "miles" ? "/mi" : "/km";

  const initialRegion = coordinates.length > 0
    ? {
        latitude: coordinates[coordinates.length - 1].latitude,
        longitude: coordinates[coordinates.length - 1].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {(draft?.segmentStarts ?? [0]).map((start, index, starts) => (
          <Polyline
            key={start}
            coordinates={coordinates.slice(start, starts[index + 1] ?? coordinates.length)}
            strokeColor="#FF8C00"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </MapView>

      {milestoneMsg && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(400)}
          style={[styles.milestoneBanner, { top: insets.top + webTopPad + 16 }]}
        >
          <Ionicons name="flag" size={18} color="#FF8C00" />
          <Text style={styles.milestoneBannerText}>{milestoneMsg}</Text>
        </Animated.View>
      )}

      <View style={[styles.statsOverlay, { paddingTop: insets.top + webTopPad }]}>
        <View style={styles.statusRow}>
          {draft?.mode === 'foreground' && <Text style={styles.pausedBadgeText}>App-open tracking only</Text>}
          {draft?.error && <Text accessibilityRole="alert" style={styles.pausedBadgeText}>{draft.error}</Text>}
          {paused ? (
            <View style={styles.pausedBadge}>
              <Ionicons name="pause" size={12} color="#FFD700" />
              <Text style={styles.pausedBadgeText}>PAUSED</Text>
            </View>
          ) : (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>TRACKING</Text>
            </View>
          )}
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {distInUnit.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>{unitLabel}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatTime(elapsed)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatPace(paceSecsPerUnit)}</Text>
            <Text style={styles.statLabel}>Pace{paceLabel}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 32 }]}>
        <Pressable disabled={busy || !draft} accessibilityRole="button" accessibilityLabel={paused ? "Resume run" : "Pause run"} style={styles.pauseBtn} onPress={handlePause}>
          <Ionicons name={paused ? "play" : "pause"} size={28} color="#FFF" />
        </Pressable>
        <Pressable disabled={busy || !draft} accessibilityRole="button" accessibilityLabel="End run" style={styles.stopBtn} onPress={handleStop}>
          <Ionicons name="stop" size={28} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  milestoneBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#FF8C00",
    zIndex: 20,
  },
  milestoneBannerText: {
    fontSize: 16,
    fontFamily: "Rubik_700Bold",
    color: "#FF8C00",
  },
  statsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  statusRow: {
    alignItems: "flex-start",
    paddingTop: 12,
    paddingBottom: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,211,238,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardio,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.cardio,
  },
  liveBadgeText: {
    fontSize: 11,
    fontFamily: "Rubik_700Bold",
    color: Colors.cardio,
    letterSpacing: 0.8,
  },
  pausedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,215,0,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  pausedBadgeText: {
    fontSize: 11,
    fontFamily: "Rubik_700Bold",
    color: "#FFD700",
    letterSpacing: 0.8,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 4,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 32,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
    paddingTop: 24,
    paddingHorizontal: 40,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  pauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  stopBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.circuit,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.circuit,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
