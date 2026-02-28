import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { UserProfile, getProfile, saveProfile } from "@/lib/profile-storage";
import {
  Exercise,
  WorkoutExercise,
  GeneratedWorkout,
  WEIGHT_EXERCISES,
  CIRCUIT_EXERCISES,
  YOGA_CORE_POSES,
  YOGA_FLEX_POSES,
  CARDIO_RUNNING,
  CARDIO_MIXED,
} from "@/lib/exercises";
import { getWorkouts } from "@/lib/workout-storage";

type Gender = UserProfile["gender"];
type Goal = UserProfile["goal"];

const GENDER_OPTIONS: { key: Gender; label: string; icon: string }[] = [
  { key: "not_applicable", label: "N/A", icon: "remove-circle-outline" },
  { key: "male", label: "Male", icon: "male" },
  { key: "female", label: "Female", icon: "female" },
];

const GOAL_OPTIONS: { key: Goal; label: string; icon: string }[] = [
  { key: "build_muscle", label: "Build Muscle", icon: "barbell-outline" },
  { key: "lose_weight", label: "Lose Weight", icon: "flame-outline" },
  { key: "maintain_weight", label: "Maintain", icon: "shield-checkmark-outline" },
];

interface ExercisePR {
  exercise: Exercise;
  prWeight?: number;
  prWeightUnit?: string;
  prReps?: string;
  prDate?: string;
  lastWeight?: number;
  lastWeightUnit?: string;
  lastReps?: string;
  lastDate?: string;
  lastNotes?: string;
}

type PRCategory = "weight_lifting" | "circuit" | "yoga" | "cardio";

const PR_CATEGORY_TABS: { key: PRCategory; label: string; icon: string; color: string }[] = [
  { key: "weight_lifting", label: "Weights", icon: "barbell", color: Colors.primary },
  { key: "circuit", label: "Circuit", icon: "flash", color: Colors.circuit },
  { key: "yoga", label: "Yoga", icon: "leaf", color: Colors.yoga },
  { key: "cardio", label: "Cardio", icon: "heart", color: Colors.cardio },
];

function getExerciseListForCategory(cat: PRCategory): Exercise[] {
  switch (cat) {
    case "weight_lifting": return WEIGHT_EXERCISES;
    case "circuit": return CIRCUIT_EXERCISES;
    case "yoga": return [...YOGA_CORE_POSES, ...YOGA_FLEX_POSES];
    case "cardio": return [...CARDIO_RUNNING, ...CARDIO_MIXED];
  }
}

function computePRs(
  workouts: GeneratedWorkout[],
  exerciseList: Exercise[],
  category: PRCategory
): ExercisePR[] {
  const prMap = new Map<string, ExercisePR>();

  exerciseList.forEach((ex) => {
    prMap.set(ex.id, { exercise: ex });
  });

  const sorted = [...workouts]
    .filter((w) => w.topCategory === category)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  sorted.forEach((w) => {
    const allExercises: { ex: WorkoutExercise; date: string }[] = [];

    w.exercises.forEach((ex) => allExercises.push({ ex, date: w.createdAt }));

    if (w.supersets) {
      w.supersets.forEach((ss) => {
        allExercises.push({ ex: ss.exerciseA, date: w.createdAt });
        allExercises.push({ ex: ss.exerciseB, date: w.createdAt });
      });
    }

    if (w.circuitBlocks) {
      w.circuitBlocks.forEach((block) => {
        block.exercises.forEach((ex) =>
          allExercises.push({ ex, date: w.createdAt })
        );
      });
    }

    allExercises.forEach(({ ex, date }) => {
      const entry = prMap.get(ex.exercise.id);
      if (!entry) return;

      if (ex.weight && ex.weight > 0) {
        if (!entry.prWeight || ex.weight > entry.prWeight) {
          entry.prWeight = ex.weight;
          entry.prWeightUnit = ex.weightUnit || "lbs";
          entry.prReps = ex.reps;
          entry.prDate = date;
        }
      }

      if (!entry.lastDate) {
        entry.lastWeight = ex.weight;
        entry.lastWeightUnit = ex.weightUnit || "lbs";
        entry.lastReps = ex.reps;
        entry.lastDate = date;
        entry.lastNotes = ex.userNotes;
      }
    });
  });

  return Array.from(prMap.values());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);
  const [prCategory, setPrCategory] = useState<PRCategory>("weight_lifting");
  const [prData, setPrData] = useState<ExercisePR[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExercisePR | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    const p = await getProfile();
    setProfile(p);
  };

  const updateField = async <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    if (!profile) return;
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    await saveProfile(updated);
  };

  const openPRModal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const workouts = await getWorkouts();
    const data = computePRs(workouts, getExerciseListForCategory(prCategory), prCategory);
    setPrData(data);
    setSelectedExercise(null);
    setShowPRModal(true);
  };

  const switchPRCategory = async (cat: PRCategory) => {
    setPrCategory(cat);
    setSelectedExercise(null);
    const workouts = await getWorkouts();
    const data = computePRs(workouts, getExerciseListForCategory(cat), cat);
    setPrData(data);
  };

  const isWeightCategory = prCategory === "weight_lifting" || prCategory === "circuit";
  const activeCatColor = PR_CATEGORY_TABS.find((t) => t.key === prCategory)?.color || Colors.primary;

  if (!profile) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <Text style={styles.screenTitle}>Profile</Text>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gender</Text>
            <View style={styles.optionRow}>
              {GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.optionCard, profile.gender === opt.key && styles.optionCardActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateField("gender", opt.key); }}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={22}
                    color={profile.gender === opt.key ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.optionLabel, profile.gender === opt.key && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Height</Text>
              <View style={styles.unitSwitch}>
                <Pressable
                  style={[styles.unitSwitchBtn, profile.heightUnit === "imperial" && styles.unitSwitchBtnActive]}
                  onPress={() => updateField("heightUnit", "imperial")}
                >
                  <Text style={[styles.unitSwitchText, profile.heightUnit === "imperial" && styles.unitSwitchTextActive]}>ft/in</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitSwitchBtn, profile.heightUnit === "metric" && styles.unitSwitchBtnActive]}
                  onPress={() => updateField("heightUnit", "metric")}
                >
                  <Text style={[styles.unitSwitchText, profile.heightUnit === "metric" && styles.unitSwitchTextActive]}>cm</Text>
                </Pressable>
              </View>
            </View>

            {profile.heightUnit === "imperial" ? (
              <View style={styles.heightImperial}>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.numberInput}
                    value={profile.heightFeet ? String(profile.heightFeet) : ""}
                    onChangeText={(v) => updateField("heightFeet", parseInt(v) || undefined)}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={1}
                  />
                  <Text style={styles.inputSuffix}>ft</Text>
                </View>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.numberInput}
                    value={profile.heightInches !== undefined ? String(profile.heightInches) : ""}
                    onChangeText={(v) => updateField("heightInches", parseInt(v) || 0)}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={2}
                  />
                  <Text style={styles.inputSuffix}>in</Text>
                </View>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.numberInput, { width: 80 }]}
                  value={profile.heightCm ? String(profile.heightCm) : ""}
                  onChangeText={(v) => updateField("heightCm", parseInt(v) || undefined)}
                  keyboardType="numeric"
                  placeholder="178"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={3}
                />
                <Text style={styles.inputSuffix}>cm</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Weight</Text>
              <View style={styles.unitSwitch}>
                <Pressable
                  style={[styles.unitSwitchBtn, profile.weightUnit === "lbs" && styles.unitSwitchBtnActive]}
                  onPress={() => updateField("weightUnit", "lbs")}
                >
                  <Text style={[styles.unitSwitchText, profile.weightUnit === "lbs" && styles.unitSwitchTextActive]}>lbs</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitSwitchBtn, profile.weightUnit === "kg" && styles.unitSwitchBtnActive]}
                  onPress={() => updateField("weightUnit", "kg")}
                >
                  <Text style={[styles.unitSwitchText, profile.weightUnit === "kg" && styles.unitSwitchTextActive]}>kg</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.numberInput, { width: 80 }]}
                value={profile.weight ? String(profile.weight) : ""}
                onChangeText={(v) => updateField("weight", parseFloat(v) || undefined)}
                keyboardType="numeric"
                placeholder="185"
                placeholderTextColor={Colors.textMuted}
                maxLength={5}
              />
              <Text style={styles.inputSuffix}>{profile.weightUnit}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goal</Text>
            <View style={styles.goalRow}>
              {GOAL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.goalCard, profile.goal === opt.key && styles.goalCardActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateField("goal", opt.key); }}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={profile.goal === opt.key ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.goalLabel, profile.goal === opt.key && styles.goalLabelActive]} numberOfLines={1}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable style={styles.prButton} onPress={openPRModal} testID="pr-button">
            <Ionicons name="trophy" size={20} color="#FFF" />
            <Text style={styles.prButtonText}>PRs and Last</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showPRModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowPRModal(false); setSelectedExercise(null); }}
      >
        <View style={[styles.prModal, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
          <View style={styles.prModalHeader}>
            <Text style={styles.prModalTitle}>PRs & Last</Text>
            <Pressable onPress={() => { setShowPRModal(false); setSelectedExercise(null); }} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.prCategoryTabs}>
            {PR_CATEGORY_TABS.map((tab) => {
              const isActive = prCategory === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.prCategoryTab, isActive && { backgroundColor: `${tab.color}15`, borderBottomWidth: 2, borderBottomColor: tab.color }]}
                  onPress={() => switchPRCategory(tab.key)}
                >
                  <Ionicons name={tab.icon as any} size={14} color={isActive ? tab.color : Colors.textMuted} />
                  <Text style={[styles.prCategoryTabText, isActive && { color: tab.color }]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedExercise ? (
            <View style={styles.prDetailContainer}>
              <Pressable style={styles.prBackBtn} onPress={() => setSelectedExercise(null)}>
                <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                <Text style={styles.prBackText}>Back to list</Text>
              </Pressable>

              <View style={styles.prDetailCard}>
                <Text style={styles.prDetailName}>{selectedExercise.exercise.name}</Text>
                <View style={styles.prDetailMeta}>
                  <View style={styles.prDetailMetaBadge}>
                    <Text style={styles.prDetailMetaText}>{selectedExercise.exercise.equipment}</Text>
                  </View>
                  {selectedExercise.exercise.muscles.map((m) => (
                    <View key={m} style={[styles.prDetailMetaBadge, { backgroundColor: `${activeCatColor}15` }]}>
                      <Text style={[styles.prDetailMetaText, { color: activeCatColor }]}>
                        {m === "full_body" ? "Full Body" : m.charAt(0).toUpperCase() + m.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>

                {isWeightCategory && (
                  <View style={styles.prStatRow}>
                    <View style={styles.prStatCard}>
                      <View style={styles.prStatHeader}>
                        <Ionicons name="trophy" size={18} color="#FFD700" />
                        <Text style={styles.prStatTitle}>Personal Record</Text>
                      </View>
                      {selectedExercise.prWeight ? (
                        <>
                          <Text style={styles.prStatWeight}>{selectedExercise.prWeight} {selectedExercise.prWeightUnit}</Text>
                          <Text style={styles.prStatDetail}>{selectedExercise.prReps} reps</Text>
                          {selectedExercise.prDate && (
                            <Text style={styles.prStatDate}>{formatDate(selectedExercise.prDate)}</Text>
                          )}
                        </>
                      ) : (
                        <Text style={styles.prStatEmpty}>No data yet</Text>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.prStatRow}>
                  <View style={styles.prStatCard}>
                    <View style={styles.prStatHeader}>
                      <Ionicons name="time" size={18} color={Colors.accent} />
                      <Text style={styles.prStatTitle}>Last Performed</Text>
                    </View>
                    {selectedExercise.lastDate ? (
                      <>
                        {isWeightCategory && selectedExercise.lastWeight ? (
                          <Text style={styles.prStatWeight}>{selectedExercise.lastWeight} {selectedExercise.lastWeightUnit}</Text>
                        ) : isWeightCategory ? (
                          <Text style={styles.prStatWeight}>Bodyweight</Text>
                        ) : null}
                        <Text style={styles.prStatDetail}>{selectedExercise.lastReps}</Text>
                        <Text style={styles.prStatDate}>{formatDate(selectedExercise.lastDate)}</Text>
                      </>
                    ) : (
                      <Text style={styles.prStatEmpty}>Not performed yet</Text>
                    )}
                  </View>
                </View>

                {!isWeightCategory && (
                  <View style={styles.prStatRow}>
                    <View style={styles.prStatCard}>
                      <View style={styles.prStatHeader}>
                        <Ionicons name="document-text" size={18} color={activeCatColor} />
                        <Text style={styles.prStatTitle}>Last Note</Text>
                      </View>
                      {selectedExercise.lastNotes ? (
                        <Text style={styles.prStatDetail}>{selectedExercise.lastNotes}</Text>
                      ) : (
                        <Text style={styles.prStatEmpty}>No notes saved</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <FlatList
              data={prData}
              keyExtractor={(item) => item.exercise.id}
              contentContainerStyle={styles.prListContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.prExerciseRow}
                  onPress={() => setSelectedExercise(item)}
                >
                  <View style={styles.prExerciseInfo}>
                    <Text style={styles.prExerciseName}>{item.exercise.name}</Text>
                    <Text style={styles.prExerciseEquipment}>{item.exercise.equipment}</Text>
                  </View>
                  {isWeightCategory ? (
                    item.prWeight ? (
                      <View style={[styles.prWeightBadge, { backgroundColor: `${activeCatColor}18` }]}>
                        <Ionicons name="trophy" size={12} color="#FFD700" />
                        <Text style={[styles.prWeightBadgeText, { color: activeCatColor }]}>{item.prWeight} {item.prWeightUnit}</Text>
                      </View>
                    ) : (
                      <Text style={styles.prNoData}>--</Text>
                    )
                  ) : (
                    item.lastDate ? (
                      <View style={[styles.prWeightBadge, { backgroundColor: `${activeCatColor}18` }]}>
                        <Ionicons name="checkmark-circle" size={12} color={activeCatColor} />
                        <Text style={[styles.prWeightBadgeText, { color: activeCatColor }]}>{formatDate(item.lastDate)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.prNoData}>--</Text>
                    )
                  )}
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
  },
  optionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  optionLabel: {
    fontSize: 13,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  optionLabelActive: {
    color: Colors.primary,
    fontFamily: "Rubik_600SemiBold",
  },
  unitSwitch: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  unitSwitchBtnActive: {
    backgroundColor: Colors.primary,
  },
  unitSwitchText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textMuted,
  },
  unitSwitchTextActive: {
    color: "#FFF",
  },
  heightImperial: {
    flexDirection: "row",
    gap: 16,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  numberInput: {
    width: 60,
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    fontSize: 20,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  inputSuffix: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  goalRow: {
    flexDirection: "row",
    gap: 8,
  },
  goalCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  goalCardActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  goalLabel: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  goalLabelActive: {
    color: Colors.primary,
    fontFamily: "Rubik_600SemiBold",
  },
  prButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  prButtonText: {
    fontSize: 16,
    fontFamily: "Rubik_700Bold",
    color: "#FFF",
  },
  prModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  prModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  prModalTitle: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  prCategoryTabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prCategoryTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  prCategoryTabText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textMuted,
  },
  prListContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  prExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  prExerciseInfo: {
    flex: 1,
  },
  prExerciseName: {
    fontSize: 15,
    fontFamily: "Rubik_500Medium",
    color: Colors.text,
  },
  prExerciseEquipment: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  prWeightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prWeightBadgeText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
  },
  prNoData: {
    fontSize: 14,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  prBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  prBackText: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  prDetailContainer: {
    flex: 1,
  },
  prDetailCard: {
    paddingHorizontal: 20,
  },
  prDetailName: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    marginBottom: 8,
  },
  prDetailMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 24,
  },
  prDetailMetaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  prDetailMetaText: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  prStatRow: {
    marginBottom: 16,
  },
  prStatCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  prStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  prStatTitle: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  prStatWeight: {
    fontSize: 28,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    marginBottom: 2,
  },
  prStatDetail: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  prStatDate: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  prStatEmpty: {
    fontSize: 15,
    fontFamily: "Rubik_500Medium",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
});
