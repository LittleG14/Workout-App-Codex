import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { UserProfile, getProfile, saveProfile } from "@/lib/profile-storage";
import {
  Exercise,
  WorkoutExercise,
  GeneratedWorkout,
  RunData,
  WEIGHT_EXERCISES,
  CIRCUIT_EXERCISES,
  YOGA_CORE_POSES,
  YOGA_FLEX_POSES,
  CARDIO_RUNNING,
  CARDIO_MIXED,
  MOBILITY_EXERCISES,
} from "@/lib/exercises";
import { getWorkouts } from "@/lib/workout-storage";
import { useHiddenExercises } from "@/lib/useHiddenExercises";

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
  category: PRCategory,
  hiddenIds?: string[],
  resetTimestamps?: Record<string, string>
): ExercisePR[] {
  const prMap = new Map<string, ExercisePR>();

  exerciseList.forEach((ex) => {
    if (!hiddenIds?.includes(ex.id)) {
      prMap.set(ex.id, { exercise: ex });
    }
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
      const exId = ex.exercise.id;
      if (hiddenIds?.includes(exId)) return;
      if (!prMap.has(exId)) {
        prMap.set(exId, { exercise: ex.exercise });
      }
      const entry = prMap.get(exId);
      if (!entry) return;

      const resetDate = resetTimestamps?.[exId];
      if (resetDate && new Date(date) <= new Date(resetDate)) return;

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

function formatRunTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatRunPace(secsPerUnit: number): string {
  if (!isFinite(secsPerUnit) || secsPerUnit <= 0 || secsPerUnit > 3600) return "--:--";
  const m = Math.floor(secsPerUnit / 60);
  const s = Math.floor(secsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface JustRunPRs {
  fastestPaceRun: { pace: number; distance: number; time: number; unit: 'miles' | 'km'; date: string } | null;
  farthestDistanceRun: { distance: number; pace: number; time: number; unit: 'miles' | 'km'; date: string } | null;
}

function computeJustRunPRs(workouts: GeneratedWorkout[]): JustRunPRs {
  const runs = workouts.filter(w => w.subType === "just_run" && w.runData);

  let fastestPaceRun: JustRunPRs["fastestPaceRun"] = null;
  let farthestDistanceRun: JustRunPRs["farthestDistanceRun"] = null;

  runs.forEach(w => {
    const rd = w.runData!;
    const unit = rd.unit;
    const dist = unit === "miles" ? rd.distanceMiles : rd.distanceKm;
    const pace = unit === "miles" ? rd.paceSecsPerMile : rd.paceSecsPerKm;
    const time = rd.durationSeconds;

    if (pace > 0 && isFinite(pace)) {
      if (!fastestPaceRun || pace < fastestPaceRun.pace) {
        fastestPaceRun = { pace, distance: dist, time, unit, date: w.createdAt };
      }
    }

    if (dist > 0) {
      if (!farthestDistanceRun || dist > farthestDistanceRun.distance) {
        farthestDistanceRun = { distance: dist, pace, time, unit, date: w.createdAt };
      }
    }
  });

  return { fastestPaceRun, farthestDistanceRun };
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

type AccountSection = "menu" | "change_email" | "change_password" | "delete_confirm";

function AccountSettingsSheet({
  user,
  onClose,
  updateEmail,
  updatePassword,
  deleteAccount,
  logout,
}: {
  user: { email?: string; name?: string } | null;
  onClose: () => void;
  updateEmail: (email: string) => Promise<void>;
  updatePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<AccountSection>("menu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const reset = () => {
    setError("");
    setSuccess("");
    setNewEmail("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const goTo = (s: AccountSection) => {
    reset();
    setSection(s);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) { setError("Please enter a new email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    setError("");
    try {
      await updateEmail(newEmail.trim());
      setSuccess("A confirmation email has been sent to your new address. Please check your inbox to complete the change.");
      setNewEmail("");
    } catch (e: any) {
      setError(e.message || "Failed to update email.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) { setError("Please enter your current password."); return; }
    if (newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      await updatePassword(currentPassword, newPassword);
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError("");
    try {
      await deleteAccount();
    } catch (e: any) {
      setError(e.message || "Failed to delete account.");
      setLoading(false);
    }
  };

  const webTopPad = Platform.OS === "web" ? 20 : 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={[accountStyles.sheet, { paddingTop: insets.top + webTopPad }]}>
        <View style={accountStyles.header}>
          {section !== "menu" ? (
            <Pressable onPress={() => goTo("menu")} hitSlop={12} style={accountStyles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 34 }} />
          )}
          <Text style={accountStyles.headerTitle}>
            {section === "menu" ? "Account" :
             section === "change_email" ? "Change Email" :
             section === "change_password" ? "Change Password" :
             "Delete Account"}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={accountStyles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[accountStyles.body, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {section === "menu" && (
            <>
              <View style={accountStyles.infoBlock}>
                <View style={accountStyles.avatarLg}>
                  <Text style={accountStyles.avatarLgText}>
                    {user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
                <Text style={accountStyles.infoName}>{user?.name || "Swole House User"}</Text>
                <Text style={accountStyles.infoEmail}>{user?.email || ""}</Text>
              </View>

              <View style={accountStyles.menuGroup}>
                <Pressable style={accountStyles.menuRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goTo("change_email"); }}>
                  <View style={[accountStyles.menuIcon, { backgroundColor: `${Colors.primary}18` }]}>
                    <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                  </View>
                  <Text style={accountStyles.menuRowText}>Change Email</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </Pressable>
                <View style={accountStyles.menuDivider} />
                <Pressable style={accountStyles.menuRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); goTo("change_password"); }}>
                  <View style={[accountStyles.menuIcon, { backgroundColor: `${Colors.yoga}18` }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.yoga} />
                  </View>
                  <Text style={accountStyles.menuRowText}>Change Password</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>

              <Pressable
                style={accountStyles.deleteMenuRow}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goTo("delete_confirm"); }}
              >
                <View style={[accountStyles.menuIcon, { backgroundColor: "#FF444418" }]}>
                  <Ionicons name="trash-outline" size={18} color="#FF4444" />
                </View>
                <Text style={[accountStyles.menuRowText, { color: "#FF4444" }]}>Delete Account</Text>
                <Ionicons name="chevron-forward" size={16} color="#FF4444" />
              </Pressable>
            </>
          )}

          {section === "change_email" && (
            <>
              <Text style={accountStyles.sectionDesc}>
                Enter a new email address. We'll send a confirmation link to verify the change.
              </Text>
              <Text style={accountStyles.fieldLabel}>Current Email</Text>
              <View style={accountStyles.staticField}>
                <Text style={accountStyles.staticFieldText}>{user?.email || ""}</Text>
              </View>
              <Text style={accountStyles.fieldLabel}>New Email Address</Text>
              <TextInput
                style={accountStyles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="new@example.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!loading}
              />
              {error ? <Text style={accountStyles.errorText}>{error}</Text> : null}
              {success ? (
                <Animated.View entering={FadeIn.duration(300)} style={accountStyles.successBox}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={accountStyles.successText}>{success}</Text>
                </Animated.View>
              ) : null}
              <Pressable
                style={[accountStyles.actionBtn, loading && accountStyles.actionBtnDisabled]}
                onPress={handleUpdateEmail}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={accountStyles.actionBtnText}>Send Confirmation Email</Text>}
              </Pressable>
            </>
          )}

          {section === "change_password" && (
            <>
              <Text style={accountStyles.sectionDesc}>
                Enter your current password to confirm your identity, then set a new one.
              </Text>
              <Text style={accountStyles.fieldLabel}>Current Password</Text>
              <TextInput
                style={accountStyles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                editable={!loading}
              />
              <Text style={accountStyles.fieldLabel}>New Password</Text>
              <TextInput
                style={accountStyles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                editable={!loading}
              />
              <Text style={accountStyles.fieldLabel}>Confirm New Password</Text>
              <TextInput
                style={accountStyles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                editable={!loading}
              />
              {error ? <Text style={accountStyles.errorText}>{error}</Text> : null}
              {success ? (
                <Animated.View entering={FadeIn.duration(300)} style={accountStyles.successBox}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={accountStyles.successText}>{success}</Text>
                </Animated.View>
              ) : null}
              <Pressable
                style={[accountStyles.actionBtn, loading && accountStyles.actionBtnDisabled]}
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={accountStyles.actionBtnText}>Update Password</Text>}
              </Pressable>
            </>
          )}

          {section === "delete_confirm" && (
            <>
              <View style={accountStyles.dangerIcon}>
                <Ionicons name="warning" size={40} color="#FF4444" />
              </View>
              <Text style={accountStyles.dangerTitle}>Delete Your Account?</Text>
              <Text style={accountStyles.dangerDesc}>
                This will permanently delete your account and all associated data including your workout history and feedback submissions. This action{" "}
                <Text style={{ fontFamily: "Rubik_700Bold" }}>cannot be undone.</Text>
              </Text>
              {error ? <Text style={accountStyles.errorText}>{error}</Text> : null}
              <Pressable
                style={[accountStyles.deleteBtn, loading && accountStyles.actionBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={accountStyles.actionBtnText}>Yes, Delete My Account</Text>}
              </Pressable>
              <Pressable style={accountStyles.cancelBtn} onPress={() => goTo("menu")} disabled={loading}>
                <Text style={accountStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const PR_DELETE_THRESHOLD = -80;
const PR_SNAP_OPEN = -90;

function SwipeablePRItem({
  item, index, onDelete, onSelect, isWeightCategory, catColor,
}: {
  item: ExercisePR;
  index: number;
  onDelete: (id: string) => void;
  onSelect: (item: ExercisePR) => void;
  isWeightCategory: boolean;
  catColor: string;
}) {
  const translateX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const rowHeight = useSharedValue(1);
  const contextX = useSharedValue(0);
  const isOpen = useRef(false);

  const triggerDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDelete(item.exercise.id);
  }, [item.exercise.id, onDelete]);

  const handleDeletePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    translateX.value = withTiming(-400, { duration: 250 });
    rowHeight.value = withTiming(0, { duration: 300 });
    rowOpacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(triggerDelete)();
    });
  }, [triggerDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => { contextX.value = translateX.value; })
    .onUpdate((event) => {
      const newX = contextX.value + event.translationX;
      translateX.value = Math.min(0, Math.max(newX, -150));
    })
    .onEnd(() => {
      if (translateX.value < PR_DELETE_THRESHOLD) {
        translateX.value = withTiming(PR_SNAP_OPEN, { duration: 200 });
        isOpen.current = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        translateX.value = withTiming(0, { duration: 200 });
        isOpen.current = false;
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (isOpen.current) {
        translateX.value = withTiming(0, { duration: 200 });
        isOpen.current = false;
      } else {
        runOnJS(onSelect)(item);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, PR_SNAP_OPEN], [0, 1], Extrapolation.CLAMP),
  }));

  const rowContainerStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ scaleY: rowHeight.value }],
    marginBottom: interpolate(rowHeight.value, [0, 1], [0, 0], Extrapolation.CLAMP),
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View style={rowContainerStyle}>
      <View style={prSwipeStyles.swipeContainer}>
        <Animated.View style={[prSwipeStyles.deleteAction, deleteActionStyle]}>
          <Pressable onPress={handleDeletePress} style={prSwipeStyles.deleteButton}>
            <Ionicons name="trash" size={20} color="#FFF" />
            <Text style={prSwipeStyles.deleteText}>Delete</Text>
          </Pressable>
        </Animated.View>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[prSwipeStyles.exerciseRow, cardAnimStyle]}>
            <View style={prSwipeStyles.exerciseInfo}>
              <Text style={prSwipeStyles.exerciseName}>{item.exercise.name}</Text>
              <Text style={prSwipeStyles.exerciseEquipment}>{item.exercise.equipment}</Text>
            </View>
            {isWeightCategory ? (
              item.prWeight ? (
                <View style={[prSwipeStyles.badge, { backgroundColor: `${catColor}18` }]}>
                  <Ionicons name="trophy" size={12} color="#FFD700" />
                  <Text style={[prSwipeStyles.badgeText, { color: catColor }]}>{item.prWeight} {item.prWeightUnit}</Text>
                </View>
              ) : (
                <Text style={prSwipeStyles.noData}>--</Text>
              )
            ) : (
              item.lastDate ? (
                <View style={[prSwipeStyles.badge, { backgroundColor: `${catColor}18` }]}>
                  <Ionicons name="checkmark-circle" size={12} color={catColor} />
                  <Text style={[prSwipeStyles.badgeText, { color: catColor }]}>{formatDate(item.lastDate)}</Text>
                </View>
              ) : (
                <Text style={prSwipeStyles.noData}>--</Text>
              )
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const prSwipeStyles = StyleSheet.create({
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
  },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: "#FF4757",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: "100%",
    height: "100%",
  },
  deleteText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: "Rubik_500Medium",
    color: Colors.text,
    marginBottom: 2,
  },
  exerciseEquipment: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
  },
  noData: {
    fontSize: 14,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    marginRight: 8,
  },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateEmail, updatePassword, deleteAccount } = useAuth();
  const router = useRouter();
  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: adminData } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/is-admin", user?.id ?? ""],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/is-admin");
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminData?.isAdmin ?? false;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [prCategory, setPrCategory] = useState<PRCategory>("weight_lifting");
  const [prData, setPrData] = useState<ExercisePR[]>([]);
  const [justRunPRs, setJustRunPRs] = useState<JustRunPRs>({ fastestPaceRun: null, farthestDistanceRun: null });
  const [selectedExercise, setSelectedExercise] = useState<ExercisePR | null>(null);
  const [prSearch, setPrSearch] = useState("");
  const { hiddenIds, resetTimestamps, hideExercise, resetExercise } = useHiddenExercises();

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
    const data = computePRs(workouts, getExerciseListForCategory(prCategory), prCategory, hiddenIds, resetTimestamps);
    const runPRs = computeJustRunPRs(workouts);
    setPrData(data);
    setJustRunPRs(runPRs);
    setSelectedExercise(null);
    setPrSearch("");
    setShowPRModal(true);
  };

  const switchPRCategory = async (cat: PRCategory) => {
    setPrCategory(cat);
    setSelectedExercise(null);
    setPrSearch("");
    const workouts = await getWorkouts();
    const data = computePRs(workouts, getExerciseListForCategory(cat), cat, hiddenIds, resetTimestamps);
    const runPRs = computeJustRunPRs(workouts);
    setPrData(data);
    setJustRunPRs(runPRs);
  };

  const handleDeletePRExercise = useCallback((id: string) => {
    Alert.alert(
      "Remove Exercise",
      "Remove this exercise from tracking and future workouts? Your history won't be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await hideExercise(id);
            setPrData(prev => prev.filter(e => e.exercise.id !== id));
            if (selectedExercise?.exercise.id === id) setSelectedExercise(null);
          },
        },
      ]
    );
  }, [hideExercise, selectedExercise]);

  const handleResetPRExercise = useCallback(async (id: string) => {
    Alert.alert(
      "Reset Stats & Notes?",
      "This will clear the PR, last session, and notes for this exercise. Your workout history stays intact.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetExercise(id);
            const workouts = await getWorkouts();
            const next = { ...resetTimestamps, [id]: new Date().toISOString() };
            const data = computePRs(workouts, getExerciseListForCategory(prCategory), prCategory, hiddenIds, next);
            setPrData(data);
            const updated = data.find(e => e.exercise.id === id) ?? null;
            setSelectedExercise(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [resetExercise, prCategory, hiddenIds, resetTimestamps]);

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
          <Pressable
            style={styles.accountCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAccountSettings(true);
            }}
            testID="account-card"
          >
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName} numberOfLines={1}>{user?.name || "Swole House User"}</Text>
              <Text style={styles.accountEmail} numberOfLines={1}>{user?.email || ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
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

        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(520).duration(400)}>
            <Pressable
              style={styles.adminBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/admin");
              }}
              testID="admin-btn"
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.adminBtnText}>Admin</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}

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
        visible={showAccountSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAccountSettings(false)}
      >
        <AccountSettingsSheet
          user={user}
          onClose={() => setShowAccountSettings(false)}
          updateEmail={updateEmail}
          updatePassword={updatePassword}
          deleteAccount={deleteAccount}
          logout={logout}
        />
      </Modal>

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

                <Pressable
                  style={styles.prResetBtn}
                  onPress={() => handleResetPRExercise(selectedExercise.exercise.id)}
                >
                  <Ionicons name="refresh" size={16} color="#FF4757" />
                  <Text style={styles.prResetBtnText}>Reset Stats & Notes</Text>
                </Pressable>
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
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View>
                  {prCategory === "cardio" && (justRunPRs.fastestPaceRun || justRunPRs.farthestDistanceRun) && (
                    <View style={styles.justRunPRCard}>
                      <View style={styles.justRunPRHeader}>
                        <Ionicons name="location" size={16} color={Colors.cardio} />
                        <Text style={styles.justRunPRTitle}>Just Run PRs</Text>
                      </View>
                      <View style={styles.justRunPRRow}>
                        <View style={styles.justRunPRStat}>
                          <Ionicons name="trophy" size={14} color="#FFD700" />
                          <Text style={styles.justRunPRStatLabel}>Fastest Pace</Text>
                          {justRunPRs.fastestPaceRun ? (
                            <>
                              <Text style={styles.justRunPRStatValue}>
                                {formatRunPace(justRunPRs.fastestPaceRun.pace)}/{justRunPRs.fastestPaceRun.unit === "miles" ? "mi" : "km"}
                              </Text>
                              <Text style={styles.justRunPRStatSub}>
                                {justRunPRs.fastestPaceRun.distance.toFixed(2)} {justRunPRs.fastestPaceRun.unit === "miles" ? "mi" : "km"} · {formatRunTime(justRunPRs.fastestPaceRun.time)}
                              </Text>
                              <Text style={styles.justRunPRStatDate}>{formatDate(justRunPRs.fastestPaceRun.date)}</Text>
                            </>
                          ) : (
                            <Text style={styles.justRunPRStatEmpty}>No data</Text>
                          )}
                        </View>
                        <View style={styles.justRunPRDivider} />
                        <View style={styles.justRunPRStat}>
                          <Ionicons name="navigate" size={14} color={Colors.cardio} />
                          <Text style={styles.justRunPRStatLabel}>Farthest Run</Text>
                          {justRunPRs.farthestDistanceRun ? (
                            <>
                              <Text style={styles.justRunPRStatValue}>
                                {justRunPRs.farthestDistanceRun.distance.toFixed(2)} {justRunPRs.farthestDistanceRun.unit === "miles" ? "mi" : "km"}
                              </Text>
                              <Text style={styles.justRunPRStatSub}>
                                {formatRunPace(justRunPRs.farthestDistanceRun.pace)}/{justRunPRs.farthestDistanceRun.unit === "miles" ? "mi" : "km"} · {formatRunTime(justRunPRs.farthestDistanceRun.time)}
                              </Text>
                              <Text style={styles.justRunPRStatDate}>{formatDate(justRunPRs.farthestDistanceRun.date)}</Text>
                            </>
                          ) : (
                            <Text style={styles.justRunPRStatEmpty}>No data</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
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
                </View>
              }
              renderItem={({ item, index }) => (
                <SwipeablePRItem
                  item={item}
                  index={index}
                  onDelete={handleDeletePRExercise}
                  onSelect={setSelectedExercise}
                  isWeightCategory={isWeightCategory}
                  catColor={activeCatColor}
                />
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
  prResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF4757",
    backgroundColor: "rgba(255,71,87,0.07)",
  },
  prResetBtnText: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: "#FF4757",
  },
  justRunPRCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: `${Colors.cardio}10`,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${Colors.cardio}30`,
    padding: 16,
  },
  justRunPRHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  justRunPRTitle: {
    fontSize: 14,
    fontFamily: "Rubik_700Bold",
    color: Colors.cardio,
    letterSpacing: 0.3,
  },
  justRunPRRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  justRunPRStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  justRunPRStatLabel: {
    fontSize: 11,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  justRunPRStatValue: {
    fontSize: 18,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  justRunPRStatSub: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  justRunPRStatDate: {
    fontSize: 11,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  justRunPRStatEmpty: {
    fontSize: 13,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  justRunPRDivider: {
    width: 1,
    backgroundColor: `${Colors.cardio}30`,
    alignSelf: "stretch",
    marginHorizontal: 12,
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
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginTop: 8,
  },
  adminBtnText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 15,
    color: Colors.textMuted,
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

const accountStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 34,
    alignItems: "flex-start",
  },
  closeBtn: {
    width: 34,
    alignItems: "flex-end",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Rubik_700Bold",
    fontSize: 17,
    color: Colors.text,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  infoBlock: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.primary}22`,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarLgText: {
    fontFamily: "Rubik_700Bold",
    fontSize: 28,
    color: Colors.primary,
  },
  infoName: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 4,
  },
  infoEmail: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  menuGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRowText: {
    flex: 1,
    fontFamily: "Rubik_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  deleteMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FF444430",
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionDesc: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  fieldLabel: {
    fontFamily: "Rubik_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  staticField: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  staticFieldText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    color: Colors.textMuted,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.error,
    marginBottom: 16,
    textAlign: "center",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: `${Colors.success}18`,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.success}40`,
    marginBottom: 20,
  },
  successText: {
    flex: 1,
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.success,
    lineHeight: 20,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnDisabled: {
    backgroundColor: Colors.surfaceHighlight,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
  dangerIcon: {
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  dangerTitle: {
    fontFamily: "Rubik_700Bold",
    fontSize: 20,
    color: Colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  dangerDesc: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  deleteBtn: {
    backgroundColor: "#FF4444",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#FF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
