import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { RunCoordinate, RunData } from "@/lib/exercises";
import { setPendingRun } from "@/lib/run-store";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";

function haversineMeters(a: RunCoordinate, b: RunCoordinate): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLon *
      sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

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
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ unit: string; notifInterval: string }>();
  const unit = (params.unit === "km" ? "km" : "miles") as "miles" | "km";
  const notifInterval = parseFloat(params.notifInterval ?? "0");

  const [coordinates, setCoordinates] = useState<RunCoordinate[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);

  const coordinatesRef = useRef<RunCoordinate[]>([]);
  const distanceRef = useRef(0);
  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const pausedRef = useRef(false);
  const lastMilestoneRef = useRef(0);
  const milestoneMsgTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startLocationWatch = useCallback(async () => {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        if (pausedRef.current) return;
        const newCoord: RunCoordinate = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
        };

        if (coordinatesRef.current.length > 0) {
          const prev = coordinatesRef.current[coordinatesRef.current.length - 1];
          const d = haversineMeters(prev, newCoord);
          if (d > 0.5 || coordinatesRef.current.length < 2) {
            distanceRef.current += d;
            setDistanceMeters(distanceRef.current);
          }
        }

        coordinatesRef.current = [...coordinatesRef.current, newCoord];
        setCoordinates([...coordinatesRef.current]);

        mapRef.current?.animateToRegion(
          {
            latitude: newCoord.latitude,
            longitude: newCoord.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          500
        );

        if (notifInterval > 0) {
          const distInUnit = unit === "miles"
            ? distanceRef.current / 1609.34
            : distanceRef.current / 1000;
          const milestone = Math.floor(distInUnit / notifInterval) * notifInterval;
          if (milestone > 0 && milestone > lastMilestoneRef.current) {
            lastMilestoneRef.current = milestone;
            const label = unit === "miles" ? "mi" : "km";
            const msg = `${milestone} ${label} reached!`;
            setMilestoneMsg(msg);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (milestoneMsgTimeout.current) clearTimeout(milestoneMsgTimeout.current);
            milestoneMsgTimeout.current = setTimeout(() => setMilestoneMsg(null), 3500);
          }
        }
      }
    );
    locationSubRef.current = sub;
  }, [unit, notifInterval]);

  useEffect(() => {
    // Center the map on the user's actual position as soon as the screen opens,
    // before watchPositionAsync fires its first event.
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((loc) => {
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          300
        );
      })
      .catch(() => {});

    startTimer();
    startLocationWatch();
    return () => {
      stopTimer();
      locationSubRef.current?.remove();
      if (milestoneMsgTimeout.current) clearTimeout(milestoneMsgTimeout.current);
    };
  }, []);

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (paused) {
      pausedRef.current = false;
      setPaused(false);
      startTimer();
    } else {
      pausedRef.current = true;
      setPaused(true);
      stopTimer();
    }
  };

  const finishRun = () => {
    stopTimer();
    locationSubRef.current?.remove();

    const coords = coordinatesRef.current;
    const distM = distanceRef.current;
    const durationSecs = elapsedRef.current;
    const distMiles = distM / 1609.34;
    const distKm = distM / 1000;
    const paceSecsPerMile = distMiles > 0 ? durationSecs / distMiles : 0;
    const paceSecsPerKm = distKm > 0 ? durationSecs / distKm : 0;

    const runData: RunData = {
      coordinates: coords,
      distanceMiles: distMiles,
      distanceKm: distKm,
      durationSeconds: durationSecs,
      paceSecsPerMile,
      paceSecsPerKm,
      unit,
      notifInterval,
    };

    setPendingRun(runData);
    router.replace("/run/summary");
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (paused) stopTimer();
    Alert.alert(
      "End Workout?",
      "Are you sure you want to stop this run? Your progress will be saved.",
      [
        { text: "Keep Running", style: "cancel", onPress: () => { if (!paused) {} } },
        {
          text: "Stop Run",
          style: "destructive",
          onPress: finishRun,
        },
      ]
    );
  };

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
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates.map(c => ({ latitude: c.latitude, longitude: c.longitude }))}
            strokeColor="#FF8C00"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
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
        <Pressable style={styles.pauseBtn} onPress={handlePause}>
          <Ionicons name={paused ? "play" : "pause"} size={28} color="#FFF" />
        </Pressable>
        <Pressable style={styles.stopBtn} onPress={handleStop}>
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
