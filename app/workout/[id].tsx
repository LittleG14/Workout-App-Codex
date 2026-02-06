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
  WORKOUT_TYPE_LABELS,
} from "@/lib/exercises";
import { getWorkouts } from "@/lib/workout-storage";

function ExerciseCard({ item, index }: { item: WorkoutExercise; index: number }) {
  const isCompound = item.exercise.category === "compound";

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseNumberBadge}>
            <Text style={styles.exerciseNumber}>{index + 1}</Text>
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{item.exercise.name}</Text>
            <View style={styles.exerciseMeta}>
              <View style={styles.equipmentBadge}>
                <Text style={styles.equipmentText}>{item.exercise.equipment}</Text>
              </View>
              <View
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor: isCompound
                      ? "rgba(255, 107, 53, 0.12)"
                      : "rgba(0, 212, 170, 0.12)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: isCompound ? Colors.primary : Colors.accent },
                  ]}
                >
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
            <Text style={styles.statLabel}>Reps</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {item.restSeconds >= 60
                ? `${Math.floor(item.restSeconds / 60)}:${(item.restSeconds % 60).toString().padStart(2, "0")}`
                : `${item.restSeconds}s`}
            </Text>
            <Text style={styles.statLabel}>Rest</Text>
          </View>
        </View>

        <View style={styles.muscleRow}>
          {item.exercise.muscles.map((m) => (
            <View key={m} style={styles.musclePill}>
              <Text style={styles.musclePillText}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

export default function WorkoutDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    loadWorkout();
  }, [id]);

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

  const isStrength = workout.style === "strength";
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets, 0);
  const totalReps = workout.exercises.reduce((sum, e) => {
    const avgRep = parseInt(e.reps.split("-")[0]);
    return sum + avgRep * e.sets;
  }, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Workout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient
            colors={
              isStrength
                ? ["rgba(92, 124, 250, 0.15)", "rgba(92, 124, 250, 0.03)"]
                : ["rgba(255, 107, 53, 0.15)", "rgba(255, 107, 53, 0.03)"]
            }
            style={styles.heroCard}
          >
            <Text style={styles.heroTitle}>{workout.name}</Text>
            <Text style={styles.heroType}>
              {WORKOUT_TYPE_LABELS[workout.workoutType]}
            </Text>

            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{workout.exercises.length}</Text>
                <Text style={styles.heroStatLabel}>Exercises</Text>
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
              <View
                style={[
                  styles.heroBadge,
                  {
                    backgroundColor: isStrength
                      ? "rgba(92, 124, 250, 0.2)"
                      : "rgba(255, 107, 53, 0.2)",
                  },
                ]}
              >
                <Ionicons
                  name={isStrength ? "barbell" : "pulse"}
                  size={14}
                  color={isStrength ? Colors.strength : Colors.hypertrophy}
                />
                <Text
                  style={[
                    styles.heroBadgeText,
                    { color: isStrength ? Colors.strength : Colors.hypertrophy },
                  ]}
                >
                  {isStrength ? "Strength" : "Hypertrophy"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.exercisesSectionTitle}>Exercises</Text>

        {workout.exercises.map((ex, i) => (
          <ExerciseCard key={ex.exercise.id + i} item={ex} index={i} />
        ))}
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
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
    backgroundColor: "rgba(255, 107, 53, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseNumber: {
    fontSize: 14,
    fontFamily: "Rubik_700Bold",
    color: Colors.primary,
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
  muscleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  musclePill: {
    backgroundColor: "rgba(0, 212, 170, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  musclePillText: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
    color: Colors.accent,
  },
});
