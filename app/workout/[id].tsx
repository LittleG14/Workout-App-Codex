import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  GeneratedWorkout,
  WorkoutExercise,
  CircuitBlock,
  SupersetPair,
  TOP_CATEGORY_LABELS,
  getSubTypeLabel,
} from "@/lib/exercises";
import { getWorkouts } from "@/lib/workout-storage";

const CATEGORY_COLORS: Record<string, string> = {
  weight_lifting: Colors.primary,
  circuit: Colors.circuit,
  yoga: Colors.yoga,
  cardio: Colors.cardio,
};

function ExerciseCard({ item, index, accentColor }: { item: WorkoutExercise; index: number; accentColor: string }) {
  const isCompound = item.exercise.category === "compound";

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(400)}>
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={[styles.exerciseNumberBadge, { backgroundColor: `${accentColor}18` }]}>
            <Text style={[styles.exerciseNumber, { color: accentColor }]}>{index + 1}</Text>
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{item.exercise.name}</Text>
            <View style={styles.exerciseMeta}>
              <View style={styles.equipmentBadge}>
                <Text style={styles.equipmentText}>{item.exercise.equipment}</Text>
              </View>
              <View style={[styles.categoryBadge, { backgroundColor: isCompound ? `${accentColor}18` : "rgba(0, 212, 170, 0.12)" }]}>
                <Text style={[styles.categoryText, { color: isCompound ? accentColor : Colors.accent }]}>
                  {isCompound ? "Compound" : "Isolation"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.exerciseStats}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.sets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.reps}</Text>
            <Text style={styles.statLabel}>{item.reps.includes("min") || item.reps.includes("s") || item.reps.includes("km") || item.reps.includes("m") ? "Duration" : "Reps"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {item.restSeconds === 0 ? "--" :
                item.restSeconds >= 60
                  ? `${Math.floor(item.restSeconds / 60)}:${(item.restSeconds % 60).toString().padStart(2, "0")}`
                  : `${item.restSeconds}s`}
            </Text>
            <Text style={styles.statLabel}>Rest</Text>
          </View>
        </View>

        {item.notes && (
          <View style={styles.notesRow}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        <View style={styles.muscleRow}>
          {item.exercise.muscles.map((m) => (
            <View key={m} style={[styles.musclePill, { backgroundColor: `${accentColor}12` }]}>
              <Text style={[styles.musclePillText, { color: accentColor }]}>
                {m === "full_body" ? "Full Body" : m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function CircuitBlockCard({ block, index, accentColor }: { block: CircuitBlock; index: number; accentColor: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <View style={[styles.circuitBlockCard, { borderLeftColor: accentColor }]}>
        <View style={styles.circuitBlockHeader}>
          <Text style={[styles.circuitBlockTitle, { color: accentColor }]}>{block.name}</Text>
          <View style={styles.circuitBlockMeta}>
            {block.timeCapMinutes && (
              <View style={[styles.circuitMetaBadge, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name="time-outline" size={12} color={accentColor} />
                <Text style={[styles.circuitMetaText, { color: accentColor }]}>{block.timeCapMinutes} min</Text>
              </View>
            )}
            {block.rounds && (
              <View style={[styles.circuitMetaBadge, { backgroundColor: `${accentColor}18` }]}>
                <Ionicons name="repeat-outline" size={12} color={accentColor} />
                <Text style={[styles.circuitMetaText, { color: accentColor }]}>{block.rounds} rounds</Text>
              </View>
            )}
          </View>
        </View>

        {block.exercises.map((ex, i) => (
          <View key={`${ex.exercise.id}-${i}`} style={[styles.circuitExerciseRow, i > 0 && styles.circuitExerciseBorder]}>
            <View style={[styles.circuitDot, { backgroundColor: accentColor }]} />
            <View style={styles.circuitExerciseInfo}>
              <Text style={styles.circuitExerciseName}>{ex.exercise.name}</Text>
              <Text style={styles.circuitExerciseReps}>{ex.reps}</Text>
            </View>
            {ex.notes && <Text style={styles.circuitExerciseNote}>{ex.notes}</Text>}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function SupersetCard({ pair, index, accentColor }: { pair: SupersetPair; index: number; accentColor: string }) {
  const renderMiniExercise = (item: WorkoutExercise, label: string) => (
    <View style={styles.ssExercise}>
      <View style={styles.ssExerciseHeader}>
        <View style={[styles.ssLabel, { backgroundColor: `${accentColor}20` }]}>
          <Text style={[styles.ssLabelText, { color: accentColor }]}>{label}</Text>
        </View>
        <Text style={styles.ssExerciseName}>{item.exercise.name}</Text>
      </View>
      <View style={styles.ssExerciseStats}>
        <Text style={styles.ssStatText}>{item.sets} sets</Text>
        <View style={styles.ssStatDot} />
        <Text style={styles.ssStatText}>{item.reps} reps</Text>
        <View style={styles.ssStatDot} />
        <Text style={styles.ssStatText}>
          {item.restSeconds === 0 ? "No rest" :
            item.restSeconds >= 60
              ? `${Math.floor(item.restSeconds / 60)}:${(item.restSeconds % 60).toString().padStart(2, "0")} rest`
              : `${item.restSeconds}s rest`}
        </Text>
      </View>
      <View style={styles.ssMuscleTags}>
        {item.exercise.muscles.map((m) => (
          <View key={m} style={[styles.ssMusclePill, { backgroundColor: `${accentColor}12` }]}>
            <Text style={[styles.ssMusclePillText, { color: accentColor }]}>
              {m === "full_body" ? "Full Body" : m.charAt(0).toUpperCase() + m.slice(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <View style={[styles.supersetCard, { borderLeftColor: accentColor }]}>
        <View style={[styles.supersetHeader, { backgroundColor: `${accentColor}12` }]}>
          <Ionicons name="git-compare" size={16} color={accentColor} />
          <Text style={[styles.supersetTitle, { color: accentColor }]}>Superset {index + 1}</Text>
        </View>

        {renderMiniExercise(pair.exerciseA, "A")}

        <View style={styles.ssConnector}>
          <View style={[styles.ssConnectorLine, { backgroundColor: `${accentColor}30` }]} />
          <View style={[styles.ssConnectorIcon, { backgroundColor: accentColor }]}>
            <Ionicons name="swap-vertical" size={14} color="#FFF" />
          </View>
          <View style={[styles.ssConnectorLine, { backgroundColor: `${accentColor}30` }]} />
        </View>

        {renderMiniExercise(pair.exerciseB, "B")}
      </View>
    </Animated.View>
  );
}

export default function WorkoutDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  useEffect(() => { loadWorkout(); }, [id]);

  const loadWorkout = async () => {
    const all = await getWorkouts();
    const found = all.find((w) => w.id === id);
    if (found) setWorkout(found);
  };

  if (!workout) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const accentColor = CATEGORY_COLORS[workout.topCategory] || Colors.primary;
  const hasSupersets = workout.supersets && workout.supersets.length > 0;
  const supersetExerciseCount = hasSupersets ? workout.supersets!.reduce((sum, ss) => sum + ss.exerciseA.sets + ss.exerciseB.sets, 0) : 0;
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets, 0) + supersetExerciseCount;
  const totalExerciseCount = workout.exercises.length + (hasSupersets ? workout.supersets!.length * 2 : 0);
  const hasCircuitBlocks = workout.circuitBlocks && workout.circuitBlocks.length > 0;
  const categoryLabel = TOP_CATEGORY_LABELS[workout.topCategory] || "Workout";
  const subLabel = getSubTypeLabel(workout.topCategory, workout.subType);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>{categoryLabel}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient
            colors={[`${accentColor}22`, `${accentColor}05`]}
            style={styles.heroCard}
          >
            <Text style={styles.heroTitle}>{workout.name}</Text>
            <Text style={styles.heroType}>{subLabel}</Text>

            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{totalExerciseCount}</Text>
                <Text style={styles.heroStatLabel}>{hasCircuitBlocks ? "Movements" : "Exercises"}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{totalSets}</Text>
                <Text style={styles.heroStatLabel}>Total Sets</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{workout.durationMinutes}</Text>
                <Text style={styles.heroStatLabel}>Minutes</Text>
              </View>
            </View>

            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroBadge, { backgroundColor: `${accentColor}30` }]}>
                <View style={[styles.heroBadgeDot, { backgroundColor: accentColor }]} />
                <Text style={[styles.heroBadgeText, { color: accentColor }]}>
                  {categoryLabel}
                </Text>
              </View>
              {workout.topCategory === "weight_lifting" && (
                <View style={[styles.heroBadge, {
                  backgroundColor: workout.style === "strength" ? "rgba(92,124,250,0.2)" : "rgba(255,107,53,0.2)"
                }]}>
                  <Ionicons
                    name={workout.style === "strength" ? "barbell" : "pulse"}
                    size={14}
                    color={workout.style === "strength" ? Colors.strength : Colors.hypertrophy}
                  />
                  <Text style={[styles.heroBadgeText, {
                    color: workout.style === "strength" ? Colors.strength : Colors.hypertrophy
                  }]}>
                    {workout.style === "strength" ? "Strength" : "Hypertrophy"}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.exercisesSectionTitle}>
          {hasCircuitBlocks ? "Workout Structure" : workout.topCategory === "yoga" ? "Poses" : "Exercises"}
        </Text>

        {hasCircuitBlocks ? (
          workout.circuitBlocks!.map((block, i) => (
            <CircuitBlockCard key={i} block={block} index={i} accentColor={accentColor} />
          ))
        ) : (
          (() => {
            if (hasSupersets) {
              const compounds = workout.exercises.filter(e => e.exercise.category === 'compound');
              const rest = workout.exercises.filter(e => e.exercise.category !== 'compound');
              let idx = 0;
              return (
                <>
                  {compounds.map((ex) => (
                    <ExerciseCard key={ex.exercise.id + idx} item={ex} index={++idx} accentColor={accentColor} />
                  ))}
                  {workout.supersets!.map((pair, i) => (
                    <SupersetCard key={`ss-${i}`} pair={pair} index={i} accentColor={accentColor} />
                  ))}
                  {rest.map((ex) => (
                    <ExerciseCard key={ex.exercise.id + idx} item={ex} index={++idx} accentColor={accentColor} />
                  ))}
                </>
              );
            }
            return workout.exercises.map((ex, i) => (
              <ExerciseCard key={ex.exercise.id + i} item={ex} index={i + 1} accentColor={accentColor} />
            ));
          })()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  heroType: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    marginBottom: 16,
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatValue: {
    fontSize: 24,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  heroStatLabel: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
    alignSelf: "center",
  },
  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroBadgeText: {
    fontSize: 13,
    fontFamily: "Rubik_600SemiBold",
  },
  exercisesSectionTitle: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  exerciseNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseNumber: {
    fontSize: 14,
    fontFamily: "Rubik_700Bold",
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    marginBottom: 5,
  },
  exerciseMeta: {
    flexDirection: "row",
    gap: 6,
  },
  equipmentBadge: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  equipmentText: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "Rubik_600SemiBold",
  },
  exerciseStats: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    alignSelf: "center",
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  notesText: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  muscleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  musclePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  musclePillText: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
  },
  circuitBlockCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  circuitBlockHeader: {
    marginBottom: 14,
  },
  circuitBlockTitle: {
    fontSize: 18,
    fontFamily: "Rubik_700Bold",
    marginBottom: 8,
  },
  circuitBlockMeta: {
    flexDirection: "row",
    gap: 8,
  },
  circuitMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  circuitMetaText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
  },
  circuitExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  circuitExerciseBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  circuitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  circuitExerciseInfo: {
    flex: 1,
  },
  circuitExerciseName: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
  },
  circuitExerciseReps: {
    fontSize: 13,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  circuitExerciseNote: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    maxWidth: 80,
    textAlign: "right",
  },
  supersetCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  supersetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },
  supersetTitle: {
    fontSize: 14,
    fontFamily: "Rubik_700Bold",
  },
  ssExercise: {
    gap: 8,
  },
  ssExerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ssLabel: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ssLabelText: {
    fontSize: 13,
    fontFamily: "Rubik_700Bold",
  },
  ssExerciseName: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  ssExerciseStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 38,
  },
  ssStatText: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  ssStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  ssMuscleTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingLeft: 38,
  },
  ssMusclePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ssMusclePillText: {
    fontSize: 10,
    fontFamily: "Rubik_500Medium",
  },
  ssConnector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    gap: 0,
  },
  ssConnectorLine: {
    flex: 1,
    height: 1,
  },
  ssConnectorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
});
