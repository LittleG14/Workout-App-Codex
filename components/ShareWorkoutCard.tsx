import React, { forwardRef } from "react";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import Colors from "@/constants/colors";
import {
  GeneratedWorkout,
  RunData,
  TOP_CATEGORY_LABELS,
  getSubTypeLabel,
} from "@/lib/exercises";

const CARD_WIDTH = 360;

const CATEGORY_COLORS: Record<string, string> = {
  weight_lifting: Colors.primary,
  circuit: Colors.circuit,
  yoga: Colors.yoga,
  cardio: Colors.cardio,
  mobility: Colors.mobility,
};

export function getExerciseNamesForShare(workout: GeneratedWorkout): string {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };
  if (workout.circuitBlocks?.length) {
    workout.circuitBlocks.forEach((b) => b.exercises.forEach((e) => add(e.exercise.name)));
  } else {
    workout.exercises.forEach((e) => add(e.exercise.name));
    workout.supersets?.forEach((ss) => {
      add(ss.exerciseA.exercise.name);
      add(ss.exerciseB.exercise.name);
    });
  }
  return names.join(" · ");
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPace(secsPerUnit: number): string {
  if (!isFinite(secsPerUnit) || secsPerUnit <= 0 || secsPerUnit > 3600) return "--:--";
  const m = Math.floor(secsPerUnit / 60);
  const s = Math.floor(secsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function captureAndShare(
  ref: React.RefObject<View>,
  transparent: boolean
) {
  try {
    const uri = await captureRef(ref, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      ...(transparent ? { backgroundColor: "transparent" } : {}),
    });

    const canShare = await Sharing.isAvailableAsync();

    if (Platform.OS === "web") {
      await handleWebShare(ref, transparent);
      return;
    }

    Alert.alert("Share Workout", "", [
      {
        text: "Share…",
        onPress: async () => {
          if (canShare) {
            await Sharing.shareAsync(uri, {
              mimeType: "image/png",
              dialogTitle: "Share Workout",
            });
          }
        },
      },
      {
        text: "Copy Image",
        onPress: async () => {
          try {
            const b64 = await captureRef(ref, {
              format: "png",
              quality: 1,
              result: "base64",
              ...(transparent ? { backgroundColor: "transparent" } : {}),
            });
            await Clipboard.setImageAsync(b64);
          } catch (_) {}
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  } catch (err) {
    Alert.alert("Oops", "Could not capture the workout card. Please try again.");
  }
}

async function handleWebShare(ref: React.RefObject<View>, transparent: boolean) {
  try {
    const b64 = await captureRef(ref, {
      format: "png",
      quality: 1,
      result: "base64",
      ...(transparent ? { backgroundColor: "transparent" } : {}),
    });
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${b64}`;
    link.download = "swole-house-workout.png";
    link.click();
  } catch (_) {}
}

export async function shareWorkoutCard(ref: React.RefObject<View>) {
  await captureAndShare(ref, false);
}

export async function shareRunCard(ref: React.RefObject<View>) {
  await captureAndShare(ref, true);
}

interface ShareableRegularCardProps {
  workout: GeneratedWorkout;
}

export const ShareableRegularCard = forwardRef<View, ShareableRegularCardProps>(
  ({ workout }, ref) => {
    const accentColor = CATEGORY_COLORS[workout.topCategory] || Colors.primary;
    const categoryLabel = TOP_CATEGORY_LABELS[workout.topCategory] || "Workout";
    const subLabel = getSubTypeLabel(workout.topCategory, workout.subType);
    const hasSupersets = workout.supersets && workout.supersets.length > 0;
    const supersetCount = hasSupersets
      ? workout.supersets!.reduce((s, ss) => s + ss.exerciseA.sets + ss.exerciseB.sets, 0)
      : 0;
    const totalSets = workout.exercises.reduce((s, e) => s + e.sets, 0) + supersetCount;
    const totalExercises =
      workout.exercises.length + (hasSupersets ? workout.supersets!.length * 2 : 0);
    const hasCircuitBlocks = workout.circuitBlocks && workout.circuitBlocks.length > 0;
    const exerciseNames = getExerciseNamesForShare(workout);

    const dateStr = new Date(workout.createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <View
        ref={ref}
        collapsable={false}
        style={sc.offscreen}
      >
        <LinearGradient
          colors={[`${accentColor}28`, `${accentColor}08`, Colors.background]}
          style={sc.card}
        >
          <View style={sc.brandRow}>
            <Text style={sc.brandText}>SWOLE HOUSE</Text>
            <View style={[sc.brandDot, { backgroundColor: accentColor }]} />
          </View>

          <Text style={sc.workoutName}>{workout.name}</Text>
          <Text style={[sc.subLabel, { color: accentColor }]}>{subLabel}</Text>

          <View style={sc.statsRow}>
            <View style={sc.statItem}>
              <Text style={sc.statValue}>{totalExercises}</Text>
              <Text style={sc.statLabel}>
                {hasCircuitBlocks ? "Movements" : "Exercises"}
              </Text>
            </View>
            <View style={sc.statDivider} />
            <View style={sc.statItem}>
              <Text style={sc.statValue}>{totalSets}</Text>
              <Text style={sc.statLabel}>Total Sets</Text>
            </View>
            <View style={sc.statDivider} />
            <View style={sc.statItem}>
              <Text style={sc.statValue}>{workout.durationMinutes}</Text>
              <Text style={sc.statLabel}>Minutes</Text>
            </View>
          </View>

          <View style={sc.badgeRow}>
            <View style={[sc.badge, { backgroundColor: `${accentColor}25` }]}>
              <View style={[sc.badgeDot, { backgroundColor: accentColor }]} />
              <Text style={[sc.badgeText, { color: accentColor }]}>{categoryLabel}</Text>
            </View>
            {workout.topCategory === "weight_lifting" && workout.style && (
              <View
                style={[
                  sc.badge,
                  {
                    backgroundColor:
                      workout.style === "strength"
                        ? "rgba(92,124,250,0.2)"
                        : "rgba(255,107,53,0.2)",
                  },
                ]}
              >
                <Text
                  style={[
                    sc.badgeText,
                    {
                      color:
                        workout.style === "strength"
                          ? Colors.strength
                          : Colors.hypertrophy,
                    },
                  ]}
                >
                  {workout.style === "strength" ? "Strength" : "Hypertrophy"}
                </Text>
              </View>
            )}
          </View>

          <View style={sc.exerciseDivider} />

          <Text style={sc.exerciseNames} numberOfLines={3}>
            {exerciseNames}
          </Text>

          <Text style={sc.dateText}>{dateStr}</Text>
        </LinearGradient>
      </View>
    );
  }
);

interface ShareableRunCardProps {
  runData: RunData;
  date: string;
}

export const ShareableRunCard = forwardRef<View, ShareableRunCardProps>(
  ({ runData, date }, ref) => {
    const unit = runData.unit;
    const distInUnit = unit === "miles" ? runData.distanceMiles : runData.distanceKm;
    const pacePerUnit =
      unit === "miles" ? runData.paceSecsPerMile : runData.paceSecsPerKm;
    const unitLabel = unit === "miles" ? "mi" : "km";
    const paceLabel = unit === "miles" ? "/mi" : "/km";

    const dateStr = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[sc.offscreen, { backgroundColor: "transparent" }]}
      >
        <View style={rc.card}>
          <View style={rc.brandRow}>
            <Text style={rc.brandText}>SWOLE HOUSE</Text>
            <View style={rc.runBadge}>
              <Text style={rc.runBadgeText}>Just Run</Text>
            </View>
          </View>

          <View style={rc.statsRow}>
            <View style={rc.statItem}>
              <Text style={rc.statValue}>{distInUnit.toFixed(2)}</Text>
              <Text style={rc.statLabel}>{unitLabel}</Text>
            </View>
            <View style={rc.statDivider} />
            <View style={rc.statItem}>
              <Text style={rc.statValue}>{formatTime(runData.durationSeconds)}</Text>
              <Text style={rc.statLabel}>Time</Text>
            </View>
            <View style={rc.statDivider} />
            <View style={rc.statItem}>
              <Text style={rc.statValue}>{formatPace(pacePerUnit)}</Text>
              <Text style={rc.statLabel}>Pace{paceLabel}</Text>
            </View>
          </View>

          <Text style={rc.dateText}>{dateStr}</Text>
        </View>
      </View>
    );
  }
);

const sc = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -5000,
    top: 0,
    width: CARD_WIDTH,
  },
  card: {
    borderRadius: 22,
    padding: 24,
    gap: 4,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  brandText: {
    fontSize: 11,
    fontFamily: "Rubik_700Bold",
    color: Colors.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  workoutName: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.border,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
  },
  exerciseDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  exerciseNames: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    marginTop: 4,
  },
});

const rc = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 24,
    gap: 4,
    backgroundColor: "transparent",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  brandText: {
    fontSize: 12,
    fontFamily: "Rubik_700Bold",
    color: "#FF8C00",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  runBadge: {
    backgroundColor: "rgba(255,140,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  runBadgeText: {
    fontSize: 11,
    fontFamily: "Rubik_600SemiBold",
    color: "#FF8C00",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Rubik_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
});
