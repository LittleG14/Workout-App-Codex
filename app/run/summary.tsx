import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { RunData, GeneratedWorkout } from "@/lib/exercises";
import { ownRun, runs } from "@/lib/run-tracking";
import { runData as toRunData, type RunDraft } from "@/lib/run-repository";
import { getAccountScope, assertAccountScope } from "@/lib/account-scope";
import { saveWorkout } from "@/lib/workout-storage";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { ShareableRunCard, shareRunCard } from "@/components/ShareWorkoutCard";

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

function getMapRegion(runData: RunData) {
  if (runData.coordinates.length === 0) {
    return { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }
  const lats = runData.coordinates.map(c => c.latitude);
  const lons = runData.coordinates.map(c => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 0.003;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(maxLat - minLat + pad, 0.005),
    longitudeDelta: Math.max(maxLon - minLon + pad, 0.005),
  };
}

export default function RunSummaryScreen() {
  const insets = useSafeAreaInsets();
  const [runData, setRunData] = useState<RunData | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scope = useRef(getAccountScope());
  const [draft, setDraft] = useState<RunDraft | null>(null);
  const runShareRef = useRef<View>(null);
  const completedAt = new Date(draft?.stoppedAt ?? draft?.startedAt ?? 0).toISOString();

  useEffect(() => {
    let mounted = true;
    void ownRun().then(run => {
      assertAccountScope(scope.current); if (!mounted || !run) return;
      if (run.status !== 'stopped') { router.replace('/run/active'); return; }
      setDraft(run); setRunData(toRunData(run, run.stoppedAt ?? run.startedAt));
    }).catch(error => { if (mounted) Alert.alert('Could not recover run', error instanceof Error ? error.message : 'Please try again.'); });
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (!runData || !draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const distInUnit = runData.unit === "miles" ? runData.distanceMiles : runData.distanceKm;
    const pacePerUnit = runData.unit === "miles" ? runData.paceSecsPerMile : runData.paceSecsPerKm;
    const unitLabel = runData.unit === "miles" ? "mi" : "km";
    const paceStr = formatPace(pacePerUnit);
    const durationMins = Math.max(1, Math.round(runData.durationSeconds / 60));

    const workout: GeneratedWorkout = {
      id: draft.id,
      userId: scope.current.userId,
      name: `Just Run — ${distInUnit.toFixed(2)} ${unitLabel}`,
      topCategory: "cardio",
      subType: "just_run",
      style: "just_run",
      durationMinutes: durationMins,
      exercises: [],
      createdAt: new Date(draft.startedAt).toISOString(),
      runData,
    };

    try {
      assertAccountScope(scope.current);
      await saveWorkout(workout);
      assertAccountScope(scope.current);
      await runs.discard(scope.current.userId, draft.id);
      assertAccountScope(scope.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert('Could not finish saving', error instanceof Error ? error.message : 'Your draft is preserved. Please try again.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const handleDiscard = () => {
    Alert.alert(
      "Discard Run?",
      "This run will not be saved to your history.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => { void (async () => {
            try {
              assertAccountScope(scope.current); if (!draft) return;
              await runs.discard(scope.current.userId, draft.id); assertAccountScope(scope.current);
              router.replace('/(tabs)');
            } catch (error) { Alert.alert('Could not discard run', error instanceof Error ? error.message : 'Please try again.'); }
          })(); },
        },
      ]
    );
  };

  if (!runData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.noDataText}>No run data found.</Text>
        <Pressable style={styles.discardBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.discardBtnText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const unit = runData.unit;
  const distInUnit = unit === "miles" ? runData.distanceMiles : runData.distanceKm;
  const pacePerUnit = unit === "miles" ? runData.paceSecsPerMile : runData.paceSecsPerKm;
  const unitLabel = unit === "miles" ? "mi" : "km";
  const paceLabel = unit === "miles" ? "/mi" : "/km";
  const mapRegion = getMapRegion(runData);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.cardio} />
          </View>
          <Text style={styles.headerTitle}>Run Complete!</Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </Animated.View>

        {runData.coordinates.length > 1 && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.mapCard}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={mapRegion}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
              showsUserLocation={false}
              pointerEvents="auto"
            >
              {(runData.segmentStarts ?? [0]).map((start, index, starts) => <Polyline
                key={start}
                coordinates={runData.coordinates.slice(start, starts[index + 1] ?? runData.coordinates.length)}
                strokeColor="#FF8C00"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />)}
            </MapView>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.statsCard}>
          <View style={styles.statsShareRow}>
            <Pressable
              onPress={() => shareRunCard(runShareRef)}
              style={styles.shareBtn}
              hitSlop={8}
            >
              <Ionicons name="share-outline" size={15} color={Colors.cardio} />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
          <View style={styles.primaryStats}>
            <View style={styles.primaryStatItem}>
              <Text style={styles.primaryStatValue}>{distInUnit.toFixed(2)}</Text>
              <Text style={styles.primaryStatLabel}>{unitLabel}</Text>
            </View>
            <View style={styles.primaryStatDivider} />
            <View style={styles.primaryStatItem}>
              <Text style={styles.primaryStatValue}>{formatTime(runData.durationSeconds)}</Text>
              <Text style={styles.primaryStatLabel}>Time</Text>
            </View>
            <View style={styles.primaryStatDivider} />
            <View style={styles.primaryStatItem}>
              <Text style={styles.primaryStatValue}>{formatPace(pacePerUnit)}</Text>
              <Text style={styles.primaryStatLabel}>Pace{paceLabel}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.actionRow}>
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Ionicons name="save-outline" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save to History"}</Text>
          </Pressable>

          <Pressable style={styles.discardBtn} onPress={handleDiscard}>
            <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.discardBtnText}>Discard</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
      {runData && <ShareableRunCard ref={runShareRef} runData={runData} date={completedAt} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  headerIconWrap: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
  },
  mapCard: {
    borderRadius: 20,
    overflow: "hidden",
    height: 260,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    flex: 1,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsShareRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.cardio,
  },
  primaryStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  primaryStatValue: {
    fontSize: 28,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  primaryStatLabel: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  primaryStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.border,
  },
  actionRow: {
    gap: 12,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.cardio,
    borderRadius: 16,
    paddingVertical: 18,
  },
  saveBtnText: {
    fontSize: 17,
    fontFamily: "Rubik_700Bold",
    color: "#FFF",
  },
  discardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  discardBtnText: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  noDataText: {
    color: Colors.textMuted,
    fontFamily: "Rubik_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginTop: 60,
  },
});
