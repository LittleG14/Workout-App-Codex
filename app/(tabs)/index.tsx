import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
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
  FadeIn,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  TopCategory,
  WeightLiftingType,
  CircuitStyle,
  YogaStyle,
  CardioStyle,
  MobilityStyle,
  TrainingStyle,
  WEIGHT_LIFTING_LABELS,
  CIRCUIT_STYLE_LABELS,
  YOGA_STYLE_LABELS,
  CARDIO_STYLE_LABELS,
  MOBILITY_STYLE_LABELS,
  DURATION_OPTIONS,
  MOBILITY_DURATION_OPTIONS,
  generateWorkout,
  getSubTypeLabel,
} from "@/lib/exercises";
import { saveWorkout } from "@/lib/workout-storage";

const CATEGORIES: { key: TopCategory; label: string; icon: string; iconSet: "ionicons" | "mci"; color: string; desc: string }[] = [
  { key: "weight_lifting", label: "Weights", icon: "barbell", iconSet: "ionicons", color: Colors.primary, desc: "Traditional splits" },
  { key: "circuit", label: "Circuit", icon: "flash", iconSet: "ionicons", color: Colors.circuit, desc: "CrossFit / Hyrox" },
  { key: "yoga", label: "Yoga", icon: "meditation", iconSet: "mci", color: Colors.yoga, desc: "Core & Flexibility" },
  { key: "cardio", label: "Cardio", icon: "heart", iconSet: "ionicons", color: Colors.cardio, desc: "Run & Mixed" },
  { key: "mobility", label: "Mobility", icon: "body", iconSet: "ionicons", color: Colors.mobility, desc: "Move & Restore" },
];

const MOBILITY_TYPES: { key: MobilityStyle; icon: string; iconSet: "ionicons" | "mci" }[] = [
  { key: "full_body", icon: "body", iconSet: "ionicons" },
  { key: "lower_body", icon: "walk", iconSet: "ionicons" },
  { key: "upper_body", icon: "hand-left", iconSet: "ionicons" },
  { key: "hips_and_spine", icon: "git-compare", iconSet: "ionicons" },
];

const WEIGHT_TYPES: { key: WeightLiftingType; icon: string; iconSet: "ionicons" | "mci" }[] = [
  { key: "chest_triceps", icon: "body", iconSet: "ionicons" },
  { key: "back_biceps", icon: "arm-flex", iconSet: "mci" },
  { key: "shoulders_abs", icon: "human-handsup", iconSet: "mci" },
  { key: "legs", icon: "walk", iconSet: "ionicons" },
  { key: "push", icon: "arrow-up-circle", iconSet: "ionicons" },
  { key: "pull", icon: "arrow-down-circle", iconSet: "ionicons" },
  { key: "full_body", icon: "fitness", iconSet: "ionicons" },
];

function CategoryCard({ item, selected, onPress }: {
  item: typeof CATEGORIES[0];
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.93, { damping: 15 }), withSpring(1, { damping: 12 }));
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={{ flex: 1 }}>
      <Animated.View style={[styles.categoryCard, selected && { borderColor: item.color, backgroundColor: `${item.color}10` }, animStyle]}>
        {item.iconSet === "ionicons" ? (
          <Ionicons name={item.icon as any} size={26} color={selected ? item.color : Colors.textSecondary} />
        ) : (
          <MaterialCommunityIcons name={item.icon as any} size={26} color={selected ? item.color : Colors.textSecondary} />
        )}
        <Text style={[styles.categoryLabel, selected && { color: item.color }]}>{item.label}</Text>
        <Text style={[styles.categoryDesc, selected && { color: `${item.color}AA` }]} numberOfLines={1}>{item.desc}</Text>
      </Animated.View>
    </Pressable>
  );
}

function OptionPill({ label, selected, color, onPress }: {
  label: string; selected: boolean; color: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={[styles.optionPill, selected && { borderColor: color, backgroundColor: `${color}15` }]}
    >
      <Text style={[styles.optionPillText, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

function SubTypeSelector({ category, subType, onSelect, color }: {
  category: TopCategory;
  subType: string;
  onSelect: (s: string) => void;
  color: string;
}) {
  let options: { key: string; label: string; icon?: string; iconSet?: "ionicons" | "mci" }[] = [];

  switch (category) {
    case "weight_lifting":
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {WEIGHT_TYPES.map((item) => {
            const selected = subType === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(item.key); }}
              >
                <View style={[styles.typeCard, selected && { borderColor: color, backgroundColor: `${color}10` }]}>
                  {item.iconSet === "ionicons" ? (
                    <Ionicons name={item.icon as any} size={20} color={selected ? color : Colors.textSecondary} />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={selected ? color : Colors.textSecondary} />
                  )}
                  <Text style={[styles.typeCardText, selected && { color }]} numberOfLines={2}>
                    {WEIGHT_LIFTING_LABELS[item.key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      );
    case "circuit":
      options = Object.entries(CIRCUIT_STYLE_LABELS).map(([k, v]) => ({ key: k, label: v }));
      break;
    case "yoga":
      options = Object.entries(YOGA_STYLE_LABELS).map(([k, v]) => ({ key: k, label: v }));
      break;
    case "cardio":
      options = Object.entries(CARDIO_STYLE_LABELS).map(([k, v]) => ({ key: k, label: v }));
      break;
    case "mobility":
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {MOBILITY_TYPES.map((item) => {
            const selected = subType === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(item.key); }}
              >
                <View style={[styles.typeCard, selected && { borderColor: color, backgroundColor: `${color}10` }]}>
                  {item.iconSet === "ionicons" ? (
                    <Ionicons name={item.icon as any} size={20} color={selected ? color : Colors.textSecondary} />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={selected ? color : Colors.textSecondary} />
                  )}
                  <Text style={[styles.typeCardText, selected && { color }]} numberOfLines={2}>
                    {MOBILITY_STYLE_LABELS[item.key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      );
  }

  return (
    <View style={styles.pillRow}>
      {options.map((opt) => (
        <OptionPill
          key={opt.key}
          label={opt.label}
          selected={subType === opt.key}
          color={color}
          onPress={() => onSelect(opt.key)}
        />
      ))}
    </View>
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
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle("strength"); }}
      >
        <Ionicons name="barbell" size={18} color={isStrength ? "#FFF" : Colors.textSecondary} />
        <Text style={[styles.styleToggleText, isStrength && styles.styleToggleTextActive]}>Strength</Text>
        <Text style={[styles.styleToggleSubtext, isStrength && { color: "rgba(255,255,255,0.7)" }]}>4-6 reps</Text>
      </Pressable>
      <Pressable
        style={[styles.styleToggleBtn, !isStrength && styles.styleToggleBtnHyper]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle("hypertrophy"); }}
      >
        <Ionicons name="pulse" size={18} color={!isStrength ? "#FFF" : Colors.textSecondary} />
        <Text style={[styles.styleToggleText, !isStrength && styles.styleToggleTextActive]}>Hypertrophy</Text>
        <Text style={[styles.styleToggleSubtext, !isStrength && { color: "rgba(255,255,255,0.7)" }]}>8-12 reps</Text>
      </Pressable>
    </View>
  );
}

function DurationPicker({ duration, onSelect, color, options }: {
  duration: number; onSelect: (d: number) => void; color: string; options?: number[];
}) {
  const durations = options || DURATION_OPTIONS;
  return (
    <View style={styles.durationRow}>
      {durations.map((d) => {
        const selected = d === duration;
        return (
          <Pressable
            key={d}
            style={[styles.durationChip, selected && { borderColor: color, backgroundColor: `${color}15` }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(d); }}
          >
            <Text style={[styles.durationChipText, selected && { color }]}>{d}</Text>
            <Text style={[styles.durationChipLabel, selected && { color: `${color}AA` }]}>min</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const DEFAULT_SUB_TYPES: Record<TopCategory, string> = {
  weight_lifting: "chest_triceps",
  circuit: "amrap",
  yoga: "core_strength",
  cardio: "running",
  mobility: "full_body",
};

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<TopCategory>("weight_lifting");
  const [subTypes, setSubTypes] = useState<Record<TopCategory, string>>(DEFAULT_SUB_TYPES);
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>("hypertrophy");
  const [selectedDuration, setSelectedDuration] = useState(45);
  const [includeSupersets, setIncludeSupersets] = useState(false);
  const [includeCore, setIncludeCore] = useState(false);
  const [generating, setGenerating] = useState(false);
  const buttonScale = useSharedValue(1);
  const buttonAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  const currentSubType = subTypes[selectedCategory];
  const catColor = CATEGORIES.find(c => c.key === selectedCategory)?.color || Colors.primary;

  const handleSubTypeChange = (val: string) => {
    setSubTypes(prev => ({ ...prev, [selectedCategory]: val }));
  };

  const handleGenerate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    buttonScale.value = withSequence(withSpring(0.95, { damping: 15 }), withSpring(1, { damping: 10 }));
    setGenerating(true);

    await new Promise(r => setTimeout(r, 400));

    const style = selectedCategory === "weight_lifting" ? trainingStyle : currentSubType;
    const workout = generateWorkout(selectedCategory, currentSubType, style, selectedDuration, includeSupersets, includeCore);
    await saveWorkout(workout);
    setGenerating(false);
    router.push({ pathname: "/workout/[id]", params: { id: workout.id, fresh: "true" } });
  }, [selectedCategory, currentSubType, trainingStyle, selectedDuration, includeSupersets, includeCore]);

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const getSummaryLabel = (): string => {
    return getSubTypeLabel(selectedCategory, currentSubType);
  };

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
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.key}
                item={cat}
                selected={selectedCategory === cat.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setSelectedCategory(cat.key);
                  if (cat.key === "mobility") {
                    if (!MOBILITY_DURATION_OPTIONS.includes(selectedDuration)) {
                      setSelectedDuration(20);
                    }
                  } else {
                    if (!DURATION_OPTIONS.includes(selectedDuration)) {
                      setSelectedDuration(45);
                    }
                  }
                }}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(400)}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === "weight_lifting" ? "Muscle Group" :
             selectedCategory === "circuit" ? "Format" :
             selectedCategory === "yoga" ? "Focus" :
             selectedCategory === "mobility" ? "Focus Area" : "Type"}
          </Text>
          <SubTypeSelector
            category={selectedCategory}
            subType={currentSubType}
            onSelect={handleSubTypeChange}
            color={catColor}
          />
        </Animated.View>

        {selectedCategory === "weight_lifting" && (
          <Animated.View entering={FadeIn.delay(250).duration(400)}>
            <Text style={styles.sectionTitle}>Training Style</Text>
            <StyleToggle style={trainingStyle} onToggle={setTrainingStyle} />

            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIncludeSupersets(prev => !prev);
                }}
                style={[styles.supersetToggle, includeSupersets && styles.supersetToggleActive]}
              >
                <View style={styles.supersetToggleTop}>
                  <View style={[styles.supersetIconWrap, includeSupersets && styles.supersetIconWrapActive]}>
                    <Ionicons name="git-compare" size={18} color={includeSupersets ? "#FFF" : Colors.textSecondary} />
                  </View>
                  <View style={[styles.supersetSwitch, includeSupersets && styles.supersetSwitchActive]}>
                    <Animated.View style={[styles.supersetSwitchThumb, includeSupersets && styles.supersetSwitchThumbActive]} />
                  </View>
                </View>
                <Text style={[styles.supersetToggleTitle, includeSupersets && { color: Colors.primary }]}>Supersets</Text>
                <Text style={styles.supersetToggleDesc}>
                  {selectedDuration >= 60 ? "2 pairs" : "1 pair"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIncludeCore(prev => !prev);
                }}
                style={[styles.supersetToggle, includeCore && styles.supersetToggleActive]}
              >
                <View style={styles.supersetToggleTop}>
                  <View style={[styles.supersetIconWrap, includeCore && styles.supersetIconWrapActive]}>
                    <Ionicons name="fitness" size={18} color={includeCore ? "#FFF" : Colors.textSecondary} />
                  </View>
                  <View style={[styles.supersetSwitch, includeCore && styles.supersetSwitchActive]}>
                    <Animated.View style={[styles.supersetSwitchThumb, includeCore && styles.supersetSwitchThumbActive]} />
                  </View>
                </View>
                <Text style={[styles.supersetToggleTitle, includeCore && { color: Colors.primary }]}>Core</Text>
                <Text style={styles.supersetToggleDesc}>Add ab finisher</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <DurationPicker
            duration={selectedDuration}
            onSelect={setSelectedDuration}
            color={catColor}
            options={selectedCategory === "mobility" ? MOBILITY_DURATION_OPTIONS : DURATION_OPTIONS}
          />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(350).duration(400)}
          style={styles.summaryCard}
        >
          <LinearGradient
            colors={[Colors.surfaceLight, Colors.surface]}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryDot, { backgroundColor: catColor }]} />
                <Text style={styles.summaryLabel}>
                  {CATEGORIES.find(c => c.key === selectedCategory)?.label}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="options" size={14} color={catColor} />
                <Text style={styles.summaryLabel}>{getSummaryLabel()}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="time" size={14} color={Colors.accent} />
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
              colors={[catColor, `${catColor}CC`]}
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
    marginBottom: 24,
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
    fontSize: 13,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  categoryCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
    aspectRatio: 1,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  categoryDesc: {
    fontSize: 9,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  optionPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionPillText: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 20,
    paddingRight: 20,
  },
  typeCard: {
    width: 95,
    height: 80,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  typeCardText: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  styleToggleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
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
    marginBottom: 20,
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
  durationChipText: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.textSecondary,
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
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  toggleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  supersetToggle: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  supersetToggleActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  supersetToggleTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  supersetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  supersetIconWrapActive: {
    backgroundColor: Colors.primary,
  },
  supersetToggleTitle: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  supersetToggleDesc: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    marginTop: 1,
  },
  supersetSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceHighlight,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  supersetSwitchActive: {
    backgroundColor: Colors.primary,
  },
  supersetSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textMuted,
  },
  supersetSwitchThumbActive: {
    alignSelf: "flex-end" as const,
    backgroundColor: "#FFF",
  },
});
