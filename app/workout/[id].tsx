import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
  CircuitBalance,
  TOP_CATEGORY_LABELS,
  getSubTypeLabel,
  findReplacementExercise,
  findCoreReplacementExercise,
  rebalanceCircuit,
} from "@/lib/exercises";
import { getWorkouts, updateWorkout } from "@/lib/workout-storage";

const CATEGORY_COLORS: Record<string, string> = {
  weight_lifting: Colors.primary,
  circuit: Colors.circuit,
  yoga: Colors.yoga,
  cardio: Colors.cardio,
};

function ExerciseCard({ item, index, accentColor, onRefresh, onLogWeight, showWeightLog, onLogNotes, showNotesLog }: { item: WorkoutExercise; index: number; accentColor: string; onRefresh?: () => void; onLogWeight?: () => void; showWeightLog?: boolean; onLogNotes?: () => void; showNotesLog?: boolean }) {
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
          <View style={styles.exerciseActions}>
            {showWeightLog && (
              <Pressable onPress={onLogWeight} hitSlop={8} testID="log-weight" style={styles.weightLogBtn}>
                {item.weight ? (
                  <View style={[styles.weightBadge, { backgroundColor: `${accentColor}18` }]}>
                    <Ionicons name="barbell-outline" size={12} color={accentColor} />
                    <Text style={[styles.weightBadgeText, { color: accentColor }]}>{item.weight} {item.weightUnit || 'lbs'}</Text>
                  </View>
                ) : (
                  <View style={styles.weightLogIcon}>
                    <Ionicons name="document-text-outline" size={18} color={Colors.textMuted} />
                    <View style={styles.weightLogPlus}>
                      <Ionicons name="add" size={10} color="#FFF" />
                    </View>
                  </View>
                )}
              </Pressable>
            )}
            {showNotesLog && (
              <Pressable onPress={onLogNotes} hitSlop={8} testID="log-notes" style={styles.weightLogBtn}>
                {item.userNotes ? (
                  <View style={[styles.weightBadge, { backgroundColor: `${accentColor}18` }]}>
                    <Ionicons name="document-text" size={12} color={accentColor} />
                    <Text style={[styles.weightBadgeText, { color: accentColor }]} numberOfLines={1}>Notes ✓</Text>
                  </View>
                ) : (
                  <View style={styles.weightLogIcon}>
                    <Ionicons name="document-text-outline" size={18} color={Colors.textMuted} />
                    <View style={styles.weightLogPlus}>
                      <Ionicons name="add" size={10} color="#FFF" />
                    </View>
                  </View>
                )}
              </Pressable>
            )}
            {onRefresh && (
              <Pressable onPress={onRefresh} hitSlop={8} testID="refresh-exercise">
                <Ionicons name="refresh" size={20} color={Colors.textMuted} />
              </Pressable>
            )}
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

        {item.userNotes && (
          <View style={[styles.notesRow, { backgroundColor: `${accentColor}08`, borderRadius: 8, padding: 8 }]}>
            <Ionicons name="document-text" size={14} color={accentColor} />
            <Text style={[styles.notesText, { color: accentColor }]}>{item.userNotes}</Text>
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

function CircuitBlockCard({ block, index, accentColor, showWeightLog, onLogWeight, onRefreshExercise }: { block: CircuitBlock; index: number; accentColor: string; showWeightLog?: boolean; onLogWeight?: (exIndex: number) => void; onRefreshExercise?: (exIndex: number) => void }) {
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
            {ex.weight && (
              <View style={[styles.weightBadgeSm, { backgroundColor: `${accentColor}18`, marginRight: 6 }]}>
                <Ionicons name="barbell-outline" size={10} color={accentColor} />
                <Text style={[styles.weightBadgeSmText, { color: accentColor }]}>{ex.weight} {ex.weightUnit || 'lbs'}</Text>
              </View>
            )}
            {showWeightLog && onLogWeight && (
              <Pressable onPress={() => onLogWeight(i)} hitSlop={6}>
                {!ex.weight ? (
                  <View style={styles.weightLogIconSm}>
                    <Ionicons name="document-text-outline" size={14} color={Colors.textMuted} />
                    <View style={styles.weightLogPlusSm}>
                      <Ionicons name="add" size={8} color="#FFF" />
                    </View>
                  </View>
                ) : (
                  <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
                )}
              </Pressable>
            )}
            {onRefreshExercise && (
              <Pressable onPress={() => onRefreshExercise(i)} hitSlop={6} testID={`refresh-circuit-${i}`}>
                <Ionicons name="refresh" size={16} color={Colors.textMuted} />
              </Pressable>
            )}
            {ex.notes && <Text style={styles.circuitExerciseNote}>{ex.notes}</Text>}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function SupersetCard({ pair, index, accentColor, onRefreshA, onRefreshB, onLogWeightA, onLogWeightB }: { pair: SupersetPair; index: number; accentColor: string; onRefreshA?: () => void; onRefreshB?: () => void; onLogWeightA?: () => void; onLogWeightB?: () => void }) {
  const renderMiniExercise = (item: WorkoutExercise, label: string, onRefresh?: () => void, onLogWeight?: () => void) => (
    <View style={styles.ssExercise}>
      <View style={styles.ssExerciseHeader}>
        <View style={[styles.ssLabel, { backgroundColor: `${accentColor}20` }]}>
          <Text style={[styles.ssLabelText, { color: accentColor }]}>{label}</Text>
        </View>
        <Text style={styles.ssExerciseName}>{item.exercise.name}</Text>
        <View style={styles.ssExerciseActions}>
          {onLogWeight && (
            <Pressable onPress={onLogWeight} hitSlop={6} testID={`log-weight-superset-${label}`}>
              {item.weight ? (
                <View style={[styles.weightBadgeSm, { backgroundColor: `${accentColor}18` }]}>
                  <Ionicons name="barbell-outline" size={10} color={accentColor} />
                  <Text style={[styles.weightBadgeSmText, { color: accentColor }]}>{item.weight} {item.weightUnit || 'lbs'}</Text>
                </View>
              ) : (
                <View style={styles.weightLogIconSm}>
                  <Ionicons name="document-text-outline" size={14} color={Colors.textMuted} />
                  <View style={styles.weightLogPlusSm}>
                    <Ionicons name="add" size={8} color="#FFF" />
                  </View>
                </View>
              )}
            </Pressable>
          )}
          {onRefresh && (
            <Pressable onPress={onRefresh} hitSlop={8} testID={`refresh-superset-${label}`}>
              <Ionicons name="refresh" size={16} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
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

        {renderMiniExercise(pair.exerciseA, "A", onRefreshA, onLogWeightA)}

        <View style={styles.ssConnector}>
          <View style={[styles.ssConnectorLine, { backgroundColor: `${accentColor}30` }]} />
          <View style={[styles.ssConnectorIcon, { backgroundColor: accentColor }]}>
            <Ionicons name="swap-vertical" size={14} color="#FFF" />
          </View>
          <View style={[styles.ssConnectorLine, { backgroundColor: `${accentColor}30` }]} />
        </View>

        {renderMiniExercise(pair.exerciseB, "B", onRefreshB, onLogWeightB)}
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

  const getAllUsedIds = (w: GeneratedWorkout): string[] => {
    const ids = w.exercises.map(e => e.exercise.id);
    if (w.supersets) {
      w.supersets.forEach(ss => {
        ids.push(ss.exerciseA.exercise.id, ss.exerciseB.exercise.id);
      });
    }
    if (w.circuitBlocks) {
      w.circuitBlocks.forEach(b => b.exercises.forEach(e => ids.push(e.exercise.id)));
    }
    return ids;
  };

  const handleRefreshExercise = async (exerciseIndex: number) => {
    if (!workout) return;
    const target = workout.exercises[exerciseIndex];
    const usedIds = getAllUsedIds(workout);
    const isLastExercise = exerciseIndex === workout.exercises.length - 1;
    const isCoreSlot = isLastExercise && workout.includeCore;
    const replacement = isCoreSlot
      ? findCoreReplacementExercise(target.exercise, usedIds)
      : findReplacementExercise(target.exercise, workout.topCategory, workout.subType, usedIds);
    if (!replacement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = { ...workout, exercises: [...workout.exercises] };
    updated.exercises[exerciseIndex] = { ...target, exercise: replacement };
    setWorkout(updated);
    await updateWorkout(updated);
  };

  const handleRefreshSuperset = async (supersetIndex: number, slot: 'A' | 'B') => {
    if (!workout || !workout.supersets) return;
    const pair = workout.supersets[supersetIndex];
    const target = slot === 'A' ? pair.exerciseA : pair.exerciseB;
    const usedIds = getAllUsedIds(workout);
    const replacement = findReplacementExercise(target.exercise, workout.topCategory, workout.subType, usedIds);
    if (!replacement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedSupersets = [...workout.supersets];
    updatedSupersets[supersetIndex] = {
      ...pair,
      [slot === 'A' ? 'exerciseA' : 'exerciseB']: { ...target, exercise: replacement },
    };
    const updated = { ...workout, supersets: updatedSupersets };
    setWorkout(updated);
    await updateWorkout(updated);
  };

  const handleRefreshCircuitExercise = async (blockIndex: number, exIndex: number) => {
    if (!workout || !workout.circuitBlocks) return;
    const block = workout.circuitBlocks[blockIndex];
    const target = block.exercises[exIndex];
    const usedIds = getAllUsedIds(workout);
    const replacement = findReplacementExercise(target.exercise, workout.topCategory, workout.subType, usedIds);
    if (!replacement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedBlocks = [...workout.circuitBlocks];
    const updatedExercises = [...block.exercises];
    updatedExercises[exIndex] = { ...target, exercise: replacement };
    updatedBlocks[blockIndex] = { ...block, exercises: updatedExercises };
    const updatedFlatExercises = [...workout.exercises];
    if (exIndex < updatedFlatExercises.length) {
      updatedFlatExercises[exIndex] = { ...target, exercise: replacement };
    }
    const updated = { ...workout, circuitBlocks: updatedBlocks, exercises: updatedFlatExercises };
    setWorkout(updated);
    await updateWorkout(updated);
  };

  const [weightModal, setWeightModal] = useState<{
    visible: boolean;
    exerciseName: string;
    location: { type: 'exercise'; index: number } | { type: 'superset'; index: number; slot: 'A' | 'B' } | { type: 'circuit'; blockIndex: number; exIndex: number };
    currentWeight?: number;
    currentUnit?: 'lbs' | 'kg';
  }>({ visible: false, exerciseName: '', location: { type: 'exercise', index: 0 } });
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const weightInputRef = useRef<TextInput>(null);

  const openWeightModal = (
    exerciseName: string,
    location: typeof weightModal.location,
    currentWeight?: number,
    currentUnit?: 'lbs' | 'kg'
  ) => {
    setWeightInput(currentWeight ? String(currentWeight) : '');
    setWeightUnit(currentUnit || 'lbs');
    setWeightModal({ visible: true, exerciseName, location, currentWeight, currentUnit });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveWeight = async () => {
    if (!workout) return;
    const numWeight = parseFloat(weightInput);
    const updated = { ...workout };

    if (weightModal.location.type === 'exercise') {
      const idx = weightModal.location.index;
      updated.exercises = [...workout.exercises];
      updated.exercises[idx] = {
        ...updated.exercises[idx],
        weight: numWeight > 0 ? numWeight : undefined,
        weightUnit: numWeight > 0 ? weightUnit : undefined,
      };
    } else if (weightModal.location.type === 'superset' && updated.supersets) {
      const { index, slot } = weightModal.location;
      const updatedSupersets = [...updated.supersets];
      const pair = updatedSupersets[index];
      const key = slot === 'A' ? 'exerciseA' : 'exerciseB';
      updatedSupersets[index] = {
        ...pair,
        [key]: {
          ...pair[key],
          weight: numWeight > 0 ? numWeight : undefined,
          weightUnit: numWeight > 0 ? weightUnit : undefined,
        },
      };
      updated.supersets = updatedSupersets;
    } else if (weightModal.location.type === 'circuit' && updated.circuitBlocks) {
      const { blockIndex, exIndex } = weightModal.location;
      const updatedBlocks = [...updated.circuitBlocks];
      const block = { ...updatedBlocks[blockIndex], exercises: [...updatedBlocks[blockIndex].exercises] };
      block.exercises[exIndex] = {
        ...block.exercises[exIndex],
        weight: numWeight > 0 ? numWeight : undefined,
        weightUnit: numWeight > 0 ? weightUnit : undefined,
      };
      updatedBlocks[blockIndex] = block;
      updated.circuitBlocks = updatedBlocks;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWorkout(updated);
    await updateWorkout(updated);
    setWeightModal(prev => ({ ...prev, visible: false }));
  };

  const [notesModal, setNotesModal] = useState<{
    visible: boolean;
    exerciseName: string;
    location: { type: 'exercise'; index: number };
    currentNotes?: string;
  }>({ visible: false, exerciseName: '', location: { type: 'exercise', index: 0 } });
  const [notesInput, setNotesInput] = useState('');

  const openNotesModal = (exerciseName: string, location: typeof notesModal.location, currentNotes?: string) => {
    setNotesInput(currentNotes || '');
    setNotesModal({ visible: true, exerciseName, location, currentNotes });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveNotes = async () => {
    if (!workout) return;
    const updated = { ...workout, exercises: [...workout.exercises] };
    const idx = notesModal.location.index;
    updated.exercises[idx] = {
      ...updated.exercises[idx],
      userNotes: notesInput.trim() || undefined,
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWorkout(updated);
    await updateWorkout(updated);
    setNotesModal(prev => ({ ...prev, visible: false }));
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
  const showWeightLog = workout.topCategory === 'weight_lifting' || workout.topCategory === 'circuit';
  const showNotesLog = workout.topCategory === 'yoga' || workout.topCategory === 'cardio';
  const categoryLabel = TOP_CATEGORY_LABELS[workout.topCategory] || "Workout";
  const subLabel = getSubTypeLabel(workout.topCategory, workout.subType);
  const circuitFormat = hasCircuitBlocks ? workout.circuitBlocks![0].format : null;
  const supportsBalance = circuitFormat === 'EMOM' || circuitFormat === 'Rounds for Time';
  const currentBalance: CircuitBalance = workout.circuitBalance || 'default';

  const handleBalance = async (balance: CircuitBalance) => {
    if (!workout || balance === currentBalance) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const rebalanced = rebalanceCircuit(workout, balance);
    setWorkout(rebalanced);
    await updateWorkout(rebalanced);
  };

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
                <Text style={styles.heroStatValue}>
                  {supportsBalance && hasCircuitBlocks ? workout.circuitBlocks![0].rounds : totalSets}
                </Text>
                <Text style={styles.heroStatLabel}>
                  {supportsBalance ? "Rounds" : "Total Sets"}
                </Text>
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

            {supportsBalance && (
              <View style={styles.balanceRow}>
                <Pressable
                  style={[styles.balanceBtn, currentBalance === 'more_movements' && styles.balanceBtnActive]}
                  onPress={() => handleBalance('more_movements')}
                >
                  <Ionicons name="list" size={13} color={currentBalance === 'more_movements' ? '#FFF' : Colors.textSecondary} />
                  <Text style={[styles.balanceBtnText, currentBalance === 'more_movements' && styles.balanceBtnTextActive]}>More Movements</Text>
                </Pressable>
                <Pressable
                  style={[styles.balanceBtn, currentBalance === 'default' && styles.balanceBtnActive]}
                  onPress={() => handleBalance('default')}
                >
                  <Ionicons name="barbell" size={13} color={currentBalance === 'default' ? '#FFF' : Colors.textSecondary} />
                  <Text style={[styles.balanceBtnText, currentBalance === 'default' && styles.balanceBtnTextActive]}>Normal Lift</Text>
                </Pressable>
                <Pressable
                  style={[styles.balanceBtn, currentBalance === 'more_rounds' && styles.balanceBtnActive]}
                  onPress={() => handleBalance('more_rounds')}
                >
                  <Ionicons name="repeat" size={13} color={currentBalance === 'more_rounds' ? '#FFF' : Colors.textSecondary} />
                  <Text style={[styles.balanceBtnText, currentBalance === 'more_rounds' && styles.balanceBtnTextActive]}>More Rounds</Text>
                </Pressable>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        <Text style={styles.exercisesSectionTitle}>
          {hasCircuitBlocks ? "Workout Structure" : workout.topCategory === "yoga" ? "Poses" : "Exercises"}
        </Text>

        {hasCircuitBlocks ? (
          workout.circuitBlocks!.map((block, bi) => (
            <CircuitBlockCard
              key={bi}
              block={block}
              index={bi}
              accentColor={accentColor}
              showWeightLog={showWeightLog}
              onLogWeight={(exIndex) => openWeightModal(
                block.exercises[exIndex].exercise.name,
                { type: 'circuit', blockIndex: bi, exIndex },
                block.exercises[exIndex].weight,
                block.exercises[exIndex].weightUnit
              )}
              onRefreshExercise={(exIndex) => handleRefreshCircuitExercise(bi, exIndex)}
            />
          ))
        ) : (
          (() => {
            if (hasSupersets) {
              const compounds: { ex: WorkoutExercise; origIdx: number }[] = [];
              const rest: { ex: WorkoutExercise; origIdx: number }[] = [];
              workout.exercises.forEach((ex, i) => {
                if (ex.exercise.category === 'compound') compounds.push({ ex, origIdx: i });
                else rest.push({ ex, origIdx: i });
              });
              let idx = 0;
              return (
                <>
                  {compounds.map(({ ex, origIdx }) => (
                    <ExerciseCard key={ex.exercise.id + origIdx} item={ex} index={++idx} accentColor={accentColor} onRefresh={() => handleRefreshExercise(origIdx)} showWeightLog={showWeightLog} onLogWeight={() => openWeightModal(ex.exercise.name, { type: 'exercise', index: origIdx }, ex.weight, ex.weightUnit)} />
                  ))}
                  {workout.supersets!.map((pair, i) => (
                    <SupersetCard key={`ss-${i}`} pair={pair} index={i} accentColor={accentColor} onRefreshA={() => handleRefreshSuperset(i, 'A')} onRefreshB={() => handleRefreshSuperset(i, 'B')} onLogWeightA={() => openWeightModal(pair.exerciseA.exercise.name, { type: 'superset', index: i, slot: 'A' }, pair.exerciseA.weight, pair.exerciseA.weightUnit)} onLogWeightB={() => openWeightModal(pair.exerciseB.exercise.name, { type: 'superset', index: i, slot: 'B' }, pair.exerciseB.weight, pair.exerciseB.weightUnit)} />
                  ))}
                  {rest.map(({ ex, origIdx }) => (
                    <ExerciseCard key={ex.exercise.id + origIdx} item={ex} index={++idx} accentColor={accentColor} onRefresh={() => handleRefreshExercise(origIdx)} showWeightLog={showWeightLog} onLogWeight={() => openWeightModal(ex.exercise.name, { type: 'exercise', index: origIdx }, ex.weight, ex.weightUnit)} />
                  ))}
                </>
              );
            }
            return workout.exercises.map((ex, i) => (
              <ExerciseCard key={ex.exercise.id + i} item={ex} index={i + 1} accentColor={accentColor} onRefresh={() => handleRefreshExercise(i)} showWeightLog={showWeightLog} onLogWeight={() => openWeightModal(ex.exercise.name, { type: 'exercise', index: i }, ex.weight, ex.weightUnit)} showNotesLog={showNotesLog} onLogNotes={() => openNotesModal(ex.exercise.name, { type: 'exercise', index: i }, ex.userNotes)} />
            ));
          })()
        )}
      </ScrollView>

      <Modal
        visible={weightModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setWeightModal(prev => ({ ...prev, visible: false }))}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setWeightModal(prev => ({ ...prev, visible: false }))}>
            <Pressable style={styles.weightModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.weightModalHeader}>
                <Ionicons name="barbell-outline" size={22} color={accentColor} />
                <Text style={styles.weightModalTitle}>Log Weight</Text>
              </View>
              <Text style={styles.weightModalExercise}>{weightModal.exerciseName}</Text>

              <View style={styles.weightInputRow}>
                <TextInput
                  ref={weightInputRef}
                  style={styles.weightTextInput}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  selectTextOnFocus
                  testID="weight-input"
                />
                <View style={styles.unitToggle}>
                  <Pressable
                    style={[styles.unitBtn, weightUnit === 'lbs' && { backgroundColor: accentColor }]}
                    onPress={() => setWeightUnit('lbs')}
                  >
                    <Text style={[styles.unitBtnText, weightUnit === 'lbs' && styles.unitBtnTextActive]}>lbs</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitBtn, weightUnit === 'kg' && { backgroundColor: accentColor }]}
                    onPress={() => setWeightUnit('kg')}
                  >
                    <Text style={[styles.unitBtnText, weightUnit === 'kg' && styles.unitBtnTextActive]}>kg</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.weightModalActions}>
                {weightModal.currentWeight && (
                  <Pressable
                    style={styles.weightClearBtn}
                    onPress={() => { setWeightInput(''); }}
                  >
                    <Text style={styles.weightClearText}>Clear</Text>
                  </Pressable>
                )}
                <View style={{ flex: 1 }} />
                <Pressable
                  style={styles.weightCancelBtn}
                  onPress={() => setWeightModal(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.weightCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.weightSaveBtn, { backgroundColor: accentColor }]}
                  onPress={saveWeight}
                  testID="save-weight"
                >
                  <Text style={styles.weightSaveText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={notesModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesModal(prev => ({ ...prev, visible: false }))}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setNotesModal(prev => ({ ...prev, visible: false }))}>
            <Pressable style={styles.weightModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.weightModalHeader}>
                <Ionicons name="document-text-outline" size={22} color={accentColor} />
                <Text style={styles.weightModalTitle}>Add Note</Text>
              </View>
              <Text style={styles.weightModalExercise}>{notesModal.exerciseName}</Text>

              <TextInput
                style={styles.notesTextInput}
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="Write a short note..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                autoFocus
                testID="notes-input"
              />

              <View style={styles.weightModalActions}>
                {notesModal.currentNotes && (
                  <Pressable
                    style={styles.weightClearBtn}
                    onPress={() => setNotesInput('')}
                  >
                    <Text style={styles.weightClearText}>Clear</Text>
                  </Pressable>
                )}
                <View style={{ flex: 1 }} />
                <Pressable
                  style={styles.weightCancelBtn}
                  onPress={() => setNotesModal(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.weightCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.weightSaveBtn, { backgroundColor: accentColor }]}
                  onPress={saveNotes}
                  testID="save-notes"
                >
                  <Text style={styles.weightSaveText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
  balanceRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    marginHorizontal: -8,
  },
  balanceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  balanceBtnActive: {
    backgroundColor: Colors.circuit,
    borderColor: Colors.circuit,
  },
  balanceBtnText: {
    fontSize: 10,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  balanceBtnTextActive: {
    color: "#FFF",
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
  ssExerciseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: "auto",
  },
  exerciseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weightLogBtn: {
    padding: 2,
  },
  weightLogIcon: {
    position: "relative",
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  weightLogPlus: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  weightLogIconSm: {
    position: "relative",
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  weightLogPlusSm: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  weightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weightBadgeText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
  },
  weightBadgeSm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  weightBadgeSmText: {
    fontSize: 10,
    fontFamily: "Rubik_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  weightModalContent: {
    width: "85%",
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weightModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  weightModalTitle: {
    fontSize: 18,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  weightModalExercise: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    marginBottom: 20,
    marginTop: 4,
  },
  weightInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  weightTextInput: {
    flex: 1,
    height: 50,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 22,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  unitToggle: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  unitBtnText: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  unitBtnTextActive: {
    color: "#FFF",
  },
  weightModalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weightClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weightClearText: {
    fontSize: 14,
    fontFamily: "Rubik_500Medium",
    color: Colors.textMuted,
  },
  weightCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  weightCancelText: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  weightSaveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  weightSaveText: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: "#FFF",
  },
  notesTextInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Rubik_400Regular",
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
});
