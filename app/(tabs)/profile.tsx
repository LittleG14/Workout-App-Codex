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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
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
  MOBILITY_EXERCISES,
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

type PRCategory = "weight_lifting" | "circuit" | "yoga" | "cardio" | "mobility";

const PR_CATEGORY_TABS: { key: PRCategory; label: string; icon: string; color: string }[] = [
  { key: "weight_lifting", label: "Weights", icon: "barbell", color: Colors.primary },
  { key: "circuit", label: "Circuit", icon: "flash", color: Colors.circuit },
  { key: "yoga", label: "Yoga", icon: "leaf", color: Colors.yoga },
  { key: "cardio", label: "Cardio", icon: "heart", color: Colors.cardio },
  { key: "mobility", label: "Mobility", icon: "body", color: Colors.mobility },
];

function getExerciseListForCategory(cat: PRCategory): Exercise[] {
  switch (cat) {
    case "weight_lifting": return WEIGHT_EXERCISES;
    case "circuit": return CIRCUIT_EXERCISES;
    case "yoga": return [...YOGA_CORE_POSES, ...YOGA_FLEX_POSES];
    case "cardio": return [...CARDIO_RUNNING, ...CARDIO_MIXED];
    case "mobility": return MOBILITY_EXERCISES;
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

function computeBMR(profile: UserProfile): number | null {
  if (!profile.weight || !profile.age) return null;

  const weightKg = profile.weightUnit === "lbs" ? profile.weight * 0.453592 : profile.weight;

  let heightCm: number | undefined;
  if (profile.heightUnit === "imperial") {
    if (profile.heightFeet) {
      heightCm = (profile.heightFeet * 12 + (profile.heightInches || 0)) * 2.54;
    }
  } else {
    heightCm = profile.heightCm;
  }
  if (!heightCm) return null;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * profile.age;
  if (profile.gender === "male") return Math.round(base + 5);
  if (profile.gender === "female") return Math.round(base - 161);
  return Math.round(base - 78);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [prCategory, setPrCategory] = useState<PRCategory>("weight_lifting");
  const [prData, setPrData] = useState<ExercisePR[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExercisePR | null>(null);
  const [prSearch, setPrSearch] = useState("");

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
    setPrSearch("");
    setShowPRModal(true);
  };

  const switchPRCategory = async (cat: PRCategory) => {
    setPrCategory(cat);
    setSelectedExercise(null);
    setPrSearch("");
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
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <View style={styles.accountCard}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName} numberOfLines={1}>{user?.name || "Swole House User"}</Text>
              <Text style={styles.accountEmail} numberOfLines={1}>{user?.email || ""}</Text>
            </View>
          </View>
        </Animated.View>

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

        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Age</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.numberInput, { width: 70 }]}
                value={profile.age ? String(profile.age) : ""}
                onChangeText={(v) => updateField("age", parseInt(v) || undefined)}
                keyboardType="numeric"
                placeholder="25"
                placeholderTextColor={Colors.textMuted}
                maxLength={3}
              />
              <Text style={styles.inputSuffix}>yrs</Text>
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

        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          {(() => {
            const bmr = computeBMR(profile);
            return (
              <View style={styles.bmrCard}>
                <View style={styles.bmrHeader}>
                  <Ionicons name="flame" size={18} color={Colors.primary} />
                  <Text style={styles.bmrLabel}>Estimated BMR</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() => Alert.alert(
                      "About BMR",
                      "This value is a rough estimate of your BMR (basal metabolic rate) which is the number of calories your body needs each day to keep you alive and functioning at complete rest. Consult a physician for more accurate info."
                    )}
                  >
                    <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                  </Pressable>
                </View>
                {bmr ? (
                  <Text style={styles.bmrValue}>{bmr.toLocaleString()} <Text style={styles.bmrUnit}>cal/day</Text></Text>
                ) : (
                  <Text style={styles.bmrPlaceholder}>Enter gender, height, weight & age above</Text>
                )}
              </View>
            );
          })()}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable style={styles.prButton} onPress={openPRModal} testID="pr-button">
            <Ionicons name="trophy" size={20} color="#FFF" />
            <Text style={styles.prButtonText}>PRs and Last</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(550).duration(400)}>
          {confirmLogout ? (
            <View style={styles.logoutConfirm}>
              <Text style={styles.logoutConfirmText}>Sign out of Swole House?</Text>
              <View style={styles.logoutConfirmRow}>
                <Pressable
                  style={styles.logoutCancelBtn}
                  onPress={() => setConfirmLogout(false)}
                  testID="logout-cancel-btn"
                >
                  <Text style={styles.logoutCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.logoutConfirmBtn}
                  onPress={() => { setConfirmLogout(false); logout(); }}
                  testID="logout-confirm-btn"
                >
                  <Text style={styles.logoutConfirmBtnText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.logoutBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setConfirmLogout(true);
              }}
              testID="logout-btn"
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </Pressable>
          )}
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
              data={prData.filter(item =>
                item.exercise.name.toLowerCase().includes(prSearch.toLowerCase()) ||
                item.exercise.equipment.toLowerCase().includes(prSearch.toLowerCase())
              )}
              keyExtractor={(item) => item.exercise.id}
              contentContainerStyle={styles.prListContent}
              ListHeaderComponent={
                <View style={styles.prSearchContainer}>
                  <Ionicons name="search" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.prSearchInput}
                    value={prSearch}
                    onChangeText={setPrSearch}
                    placeholder="Search exercises..."
                    placeholderTextColor={Colors.textMuted}
                    returnKeyType="search"
                    autoCorrect={false}
                  />
                  {prSearch.length > 0 && (
                    <Pressable onPress={() => setPrSearch("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              }
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
    fontSize: 24,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
  },
  optionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
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
    height: 42,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    fontSize: 18,
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
    paddingVertical: 10,
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
  bmrCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 16,
  },
  bmrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  bmrLabel: {
    fontSize: 13,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  bmrValue: {
    fontSize: 26,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  bmrUnit: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textMuted,
  },
  bmrPlaceholder: {
    fontSize: 13,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  prButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
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
  prSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  prSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Rubik_400Regular",
    color: Colors.text,
    paddingVertical: 0,
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
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${Colors.primary}22`,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarText: {
    fontFamily: "Rubik_700Bold",
    fontSize: 20,
    color: Colors.primary,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 17,
    color: Colors.text,
  },
  accountEmail: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginTop: 8,
  },
  logoutBtnText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  logoutConfirm: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    gap: 12,
  },
  logoutConfirmText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 15,
    color: Colors.text,
    textAlign: "center",
  },
  logoutConfirmRow: {
    flexDirection: "row",
    gap: 10,
  },
  logoutCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
  },
  logoutCancelBtnText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  logoutConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#FF4444",
    alignItems: "center",
  },
  logoutConfirmBtnText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 14,
    color: "#FFF",
  },
});
