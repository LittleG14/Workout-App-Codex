import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  WorkoutType,
  TrainingStyle,
  WORKOUT_TYPE_LABELS,
  DURATION_OPTIONS,
  generateWorkout,
} from "@/lib/exercises";
import { saveWorkout } from "@/lib/workout-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WORKOUT_TYPES: { key: WorkoutType; icon: string; iconSet: "ionicons" | "mci" }[] = [
  { key: "chest_triceps", icon: "body", iconSet: "ionicons" },
  { key: "back_biceps", icon: "arm-flex", iconSet: "mci" },
  { key: "shoulders_abs", icon: "human-handsup", iconSet: "mci" },
  { key: "legs", icon: "walk", iconSet: "ionicons" },
  { key: "push", icon: "arrow-up-circle", iconSet: "ionicons" },
  { key: "pull", icon: "arrow-down-circle", iconSet: "ionicons" },
  { key: "full_body", icon: "fitness", iconSet: "ionicons" },
];

function TypeCard({ item, selected, onPress }: {
  item: typeof WORKOUT_TYPES[0];
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.93, { damping: 15 }),
      withSpring(1, { damping: 12 }),
    );
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.typeCard,
          selected && styles.typeCardSelected,
          animStyle,
        ]}
      >
        {item.iconSet === "ionicons" ? (
          <Ionicons
            name={item.icon as any}
            size={22}
            color={selected ? Colors.primary : Colors.textSecondary}
          />
        ) : (
          <MaterialCommunityIcons
            name={item.icon as any}
            size={22}
            color={selected ? Colors.primary : Colors.textSecondary}
          />
        )}
        <Text
          style={[
            styles.typeCardText,
            selected && styles.typeCardTextSelected,
          ]}
          numberOfLines={2}
        >
          {WORKOUT_TYPE_LABELS[item.key]}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function StyleToggle({ style, onToggle }: {
  style: TrainingStyle;
  onToggle: (s: TrainingStyle) => void;
}) {
  const isStrength = style === "strength";

  return (
    <View style={styles.styleToggleContainer}>
      <Pressable
        style={[styles.styleToggleBtn, isStrength && styles.styleToggleBtnActive]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle("strength");
        }}
      >
        <Ionicons
          name="barbell"
          size={18}
          color={isStrength ? "#FFF" : Colors.textSecondary}
        />
        <Text style={[styles.styleToggleText, isStrength && styles.styleToggleTextActive]}>
          Strength
        </Text>
        <Text style={[styles.styleToggleSubtext, isStrength && { color: "rgba(255,255,255,0.7)" }]}>
          4-6 reps
        </Text>
      </Pressable>
      <Pressable
        style={[styles.styleToggleBtn, !isStrength && styles.styleToggleBtnHyper]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle("hypertrophy");
        }}
      >
        <Ionicons
          name="pulse"
          size={18}
          color={!isStrength ? "#FFF" : Colors.textSecondary}
        />
        <Text style={[styles.styleToggleText, !isStrength && styles.styleToggleTextActive]}>
          Hypertrophy
        </Text>
        <Text style={[styles.styleToggleSubtext, !isStrength && { color: "rgba(255,255,255,0.7)" }]}>
          8-12 reps
        </Text>
      </Pressable>
    </View>
  );
}

function DurationPicker({ duration, onSelect }: {
  duration: number;
  onSelect: (d: number) => void;
}) {
  return (
    <View style={styles.durationRow}>
      {DURATION_OPTIONS.map((d) => {
        const selected = d === duration;
        return (
          <Pressable
            key={d}
            style={[styles.durationChip, selected && styles.durationChipSelected]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(d);
            }}
          >
            <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>
              {d}
            </Text>
            <Text style={[styles.durationChipLabel, selected && { color: "rgba(255,255,255,0.7)" }]}>
              min
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<WorkoutType>("chest_triceps");
  const [selectedStyle, setSelectedStyle] = useState<TrainingStyle>("hypertrophy");
  const [selectedDuration, setSelectedDuration] = useState(45);
  const [generating, setGenerating] = useState(false);
  const buttonScale = useSharedValue(1);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleGenerate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15 }),
      withSpring(1, { damping: 10 }),
    );
    setGenerating(true);

    await new Promise(r => setTimeout(r, 400));

    const workout = generateWorkout(selectedType, selectedStyle, selectedDuration);
    await saveWorkout(workout);
    setGenerating(false);
    router.push({ pathname: "/workout/[id]", params: { id: workout.id, fresh: "true" } });
  }, [selectedType, selectedStyle, selectedDuration]);

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>IronForge</Text>
          <Text style={styles.headerSubtitle}>Build your workout</Text>
        </View>

        <Animated.View entering={FadeIn.delay(100).duration(400)}>
          <Text style={styles.sectionTitle}>Muscle Group</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
          >
            {WORKOUT_TYPES.map((item) => (
              <TypeCard
                key={item.key}
                item={item}
                selected={selectedType === item.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedType(item.key);
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          <Text style={styles.sectionTitle}>Training Style</Text>
          <StyleToggle style={selectedStyle} onToggle={setSelectedStyle} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <DurationPicker duration={selectedDuration} onSelect={setSelectedDuration} />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(400).duration(400)}
          style={styles.summaryCard}
        >
          <LinearGradient
            colors={[Colors.surfaceLight, Colors.surface]}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="body" size={16} color={Colors.primary} />
                <Text style={styles.summaryLabel}>{WORKOUT_TYPE_LABELS[selectedType]}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name={selectedStyle === "strength" ? "barbell" : "pulse"} size={16} color={selectedStyle === "strength" ? Colors.strength : Colors.hypertrophy} />
                <Text style={styles.summaryLabel}>{selectedStyle === "strength" ? "Strength" : "Hypertrophy"}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="time" size={16} color={Colors.accent} />
                <Text style={styles.summaryLabel}>{selectedDuration} min</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={buttonAnimStyle}>
          <Pressable
            style={[styles.generateButton, generating && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={generating}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generateGradient}
            >
              {generating ? (
                <Text style={styles.generateText}>Forging...</Text>
              ) : (
                <>
                  <Ionicons name="flash" size={22} color="#FFF" />
                  <Text style={styles.generateText}>Generate Workout</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
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
  },
  header: {
    marginTop: 12,
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Rubik_700Bold",
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 8,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 20,
    paddingRight: 20,
  },
  typeCard: {
    width: 100,
    height: 90,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(255, 107, 53, 0.08)",
  },
  typeCardText: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  typeCardTextSelected: {
    color: Colors.primary,
  },
  styleToggleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  styleToggleBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  styleToggleBtnActive: {
    borderColor: Colors.strength,
    backgroundColor: "rgba(92, 124, 250, 0.12)",
  },
  styleToggleBtnHyper: {
    borderColor: Colors.hypertrophy,
    backgroundColor: "rgba(255, 107, 53, 0.12)",
  },
  styleToggleText: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  styleToggleTextActive: {
    color: "#FFF",
  },
  styleToggleSubtext: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  durationRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  durationChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  durationChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(0, 212, 170, 0.1)",
  },
  durationChipText: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.textSecondary,
  },
  durationChipTextSelected: {
    color: Colors.accent,
  },
  durationChipLabel: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  summaryCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  summaryGradient: {
    padding: 16,
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Rubik_500Medium",
    color: Colors.text,
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  generateButton: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 20,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
  },
  generateText: {
    fontSize: 17,
    fontFamily: "Rubik_700Bold",
    color: "#FFF",
    letterSpacing: 0.3,
  },
});
