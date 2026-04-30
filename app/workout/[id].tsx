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
  FlatList,
} from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  Exercise,
  GeneratedWorkout,
  WorkoutExercise,
  CircuitBlock,
  SupersetPair,
  CircuitBalance,
  RunData,
  TOP_CATEGORY_LABELS,
  getSubTypeLabel,
  findReplacementExercise,
  findCoreReplacementExercise,
  rebalanceCircuit,
  WEIGHT_EXERCISES,
  CIRCUIT_EXERCISES,
  YOGA_CORE_POSES,
  YOGA_FLEX_POSES,
  CARDIO_RUNNING,
  CARDIO_MIXED,
  MOBILITY_EXERCISES,
  WEIGHT_LIFTING_LABELS,
  EQUIPMENT_OPTIONS,
  CustomExerciseData,
  TopCategory,
  MuscleGroup,
  WeightLiftingType,
  ExerciseCategory,
} from "@/lib/exercises";
import { getLocalWorkoutsOnly, updateWorkout } from "@/lib/workout-storage";
import { useCustomExercises } from "@/lib/useCustomExercises";
import { useHiddenExercises } from "@/lib/useHiddenExercises";
import {
  ShareableRegularCard,
  ShareableRunCard,
  shareWorkoutCard,
  shareRunCard,
} from "@/components/ShareWorkoutCard";

type PickerCategory = 'weight_lifting' | 'circuit' | 'yoga' | 'cardio' | 'mobility';

const PICKER_TABS: { key: PickerCategory; label: string; icon: string; color: string }[] = [
  { key: 'weight_lifting', label: 'Weights', icon: 'barbell', color: Colors.primary },
  { key: 'circuit', label: 'Circuit', icon: 'flash', color: Colors.circuit },
  { key: 'yoga', label: 'Yoga', icon: 'leaf', color: Colors.yoga },
  { key: 'cardio', label: 'Cardio', icon: 'heart', color: Colors.cardio },
  { key: 'mobility', label: 'Mobility', icon: 'body', color: Colors.mobility },
];

const MUSCLE_GROUP_OPTIONS: MuscleGroup[] = [
  'chest', 'triceps', 'back', 'biceps', 'shoulders', 'abs',
  'quads', 'hamstrings', 'glutes', 'calves', 'full_body',
];

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', triceps: 'Triceps', back: 'Back', biceps: 'Biceps',
  shoulders: 'Shoulders', abs: 'Abs', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves', full_body: 'Full Body',
};

const WEIGHT_SUB_OPTIONS: { key: WeightLiftingType; label: string }[] = [
  { key: 'chest_triceps', label: 'Chest & Triceps' },
  { key: 'back_biceps', label: 'Back & Biceps' },
  { key: 'shoulders_abs', label: 'Shoulders & Abs' },
  { key: 'legs', label: 'Legs' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'push', label: 'Push' },
  { key: 'pull', label: 'Pull' },
];

const TOP_CATEGORY_FORM_OPTIONS: { key: TopCategory; label: string }[] = [
  { key: 'weight_lifting', label: 'Weight Lifting' },
  { key: 'circuit', label: 'Circuit Training' },
  { key: 'yoga', label: 'Yoga' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'mobility', label: 'Mobility' },
];

function getPickerExercises(cat: PickerCategory, customExercises?: CustomExerciseData[], hiddenIds?: string[]): Exercise[] {
  const custom = (customExercises ?? [])
    .filter(c => c.topCategories.includes(cat as TopCategory))
    .map(c => ({ id: c.id, name: c.name, muscles: c.muscles, category: c.type, equipment: c.equipment }));
  let pool: Exercise[];
  switch (cat) {
    case 'weight_lifting': pool = [...WEIGHT_EXERCISES, ...custom]; break;
    case 'circuit': pool = [...CIRCUIT_EXERCISES, ...custom]; break;
    case 'yoga': pool = [...YOGA_CORE_POSES, ...YOGA_FLEX_POSES, ...custom]; break;
    case 'cardio': pool = [...CARDIO_RUNNING, ...CARDIO_MIXED, ...custom]; break;
    case 'mobility': pool = [...MOBILITY_EXERCISES, ...custom]; break;
  }
  if (hiddenIds?.length) pool = pool.filter(e => !hiddenIds.includes(e.id));
  return pool;
}

const CATEGORY_COLORS: Record<string, string> = {
  weight_lifting: Colors.primary,
  circuit: Colors.circuit,
  yoga: Colors.yoga,
  cardio: Colors.cardio,
  mobility: Colors.mobility,
};

function ExerciseCard({ item, index, accentColor, onRefresh, onPickExercise, onLogWeight, showWeightLog, onLogNotes, showNotesLog }: { item: WorkoutExercise; index: number; accentColor: string; onRefresh?: () => void; onPickExercise?: () => void; onLogWeight?: () => void; showWeightLog?: boolean; onLogNotes?: () => void; showNotesLog?: boolean }) {
  const isCompound = item.exercise.category === "compound";

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(400)}>
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={[styles.exerciseNumberBadge, { backgroundColor: `${accentColor}18` }]}>
            <Text style={[styles.exerciseNumber, { color: accentColor }]}>{index}</Text>
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
            {onPickExercise && (
              <Pressable onPress={onPickExercise} hitSlop={8} testID="pick-exercise">
                <Ionicons name="pencil-outline" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
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

function CircuitBlockCard({ block, index, accentColor, showWeightLog, onLogWeight, onRefreshExercise, onPickExercise }: { block: CircuitBlock; index: number; accentColor: string; showWeightLog?: boolean; onLogWeight?: (exIndex: number) => void; onRefreshExercise?: (exIndex: number) => void; onPickExercise?: (exIndex: number) => void }) {
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
            {onPickExercise && (
              <Pressable onPress={() => onPickExercise(i)} hitSlop={6} testID={`pick-circuit-${i}`} style={{ marginRight: 4 }}>
                <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
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

function SupersetCard({ pair, index, accentColor, onRefreshA, onRefreshB, onLogWeightA, onLogWeightB, onPickA, onPickB }: { pair: SupersetPair; index: number; accentColor: string; onRefreshA?: () => void; onRefreshB?: () => void; onLogWeightA?: () => void; onLogWeightB?: () => void; onPickA?: () => void; onPickB?: () => void }) {
  const renderMiniExercise = (item: WorkoutExercise, label: string, onRefresh?: () => void, onLogWeight?: () => void, onPick?: () => void) => (
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
          {onPick && (
            <Pressable onPress={onPick} hitSlop={8} testID={`pick-superset-${label}`}>
              <Ionicons name="pencil-outline" size={15} color={Colors.textMuted} />
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

        {renderMiniExercise(pair.exerciseA, "A", onRefreshA, onLogWeightA, onPickA)}

        <View style={styles.ssConnector}>
          <View style={[styles.ssConnectorLine, { backgroundColor: `${accentColor}30` }]} />
          <View style={[styles.ssConnectorIcon, { backgroundColor: accentColor }]}>
            <Ionicons name="swap-vertical" size={14} color="#FFF" />
          </View>
          <View style={[styles.ssConnectorLine, { backgroundColor: `${accentColor}30` }]} />
        </View>

        {renderMiniExercise(pair.exerciseB, "B", onRefreshB, onLogWeightB, onPickB)}
      </View>
    </Animated.View>
  );
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

function getRunMapRegion(runData: RunData) {
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

function JustRunDetail({ workout }: { workout: GeneratedWorkout }) {
  const insets = useSafeAreaInsets();
  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const runShareRef = useRef<View>(null);
  const runData = workout.runData;

  const date = new Date(workout.createdAt);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (!runData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtnRun, { top: insets.top + webTopPad + 8 }]}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={[styles.loadingText, { marginTop: 80 }]}>Run data not available.</Text>
      </View>
    );
  }

  const unit = runData.unit;
  const distInUnit = unit === "miles" ? runData.distanceMiles : runData.distanceKm;
  const pacePerUnit = unit === "miles" ? runData.paceSecsPerMile : runData.paceSecsPerKm;
  const unitLabel = unit === "miles" ? "mi" : "km";
  const paceLabel = unit === "miles" ? "/mi" : "/km";
  const mapRegion = getRunMapRegion(runData);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtnRun, { top: insets.top + webTopPad + 8 }]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.runDetailScroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.runDetailHeader}>
          <View style={[styles.runDetailIconWrap, { backgroundColor: `${Colors.cardio}18` }]}>
            <Ionicons name="location" size={32} color={Colors.cardio} />
          </View>
          <Text style={styles.runDetailTitle}>{workout.name}</Text>
          <Text style={styles.runDetailDate}>{dateStr} at {timeStr}</Text>
        </Animated.View>

        {runData.coordinates.length > 1 && (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.runMapCard}>
            <MapView
              style={styles.runMap}
              provider={PROVIDER_DEFAULT}
              initialRegion={mapRegion}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
              showsUserLocation={false}
            >
              <Polyline
                coordinates={runData.coordinates.map(c => ({ latitude: c.latitude, longitude: c.longitude }))}
                strokeColor="#FF8C00"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            </MapView>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.runStatsCard}>
          <View style={styles.runStatsShareRow}>
            <Pressable
              onPress={() => shareRunCard(runShareRef)}
              style={styles.shareBtn}
              hitSlop={8}
            >
              <Ionicons name="share-outline" size={15} color={Colors.cardio} />
              <Text style={[styles.shareBtnText, { color: Colors.cardio }]}>Share</Text>
            </Pressable>
          </View>
          <View style={styles.runStatRow}>
            <View style={styles.runStatItem}>
              <Ionicons name="location-outline" size={20} color={Colors.cardio} />
              <Text style={styles.runStatValue}>{distInUnit.toFixed(2)}</Text>
              <Text style={styles.runStatLabel}>{unitLabel}</Text>
            </View>
            <View style={styles.runStatDivider} />
            <View style={styles.runStatItem}>
              <Ionicons name="time-outline" size={20} color={Colors.cardio} />
              <Text style={styles.runStatValue}>{formatRunTime(runData.durationSeconds)}</Text>
              <Text style={styles.runStatLabel}>Time</Text>
            </View>
            <View style={styles.runStatDivider} />
            <View style={styles.runStatItem}>
              <Ionicons name="speedometer-outline" size={20} color={Colors.cardio} />
              <Text style={styles.runStatValue}>{formatRunPace(pacePerUnit)}</Text>
              <Text style={styles.runStatLabel}>Pace{paceLabel}</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      <ShareableRunCard ref={runShareRef} runData={runData} date={workout.createdAt} />
    </View>
  );
}

export default function WorkoutDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const shareCardRef = useRef<View>(null);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  useEffect(() => { loadWorkout(); }, [id]);

  const loadWorkout = async () => {
    const all = await getLocalWorkoutsOnly();
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
      ? findCoreReplacementExercise(target.exercise, usedIds, customExercises, hiddenIds)
      : findReplacementExercise(target.exercise, workout.topCategory, workout.subType, usedIds, customExercises, hiddenIds);
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
    const replacement = findReplacementExercise(target.exercise, workout.topCategory, workout.subType, usedIds, customExercises, hiddenIds);
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
    const replacement = findReplacementExercise(target.exercise, workout.topCategory, workout.subType, usedIds, customExercises, hiddenIds);
    if (!replacement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedBlocks = [...workout.circuitBlocks];
    const updatedExercises = [...block.exercises];
    updatedExercises[exIndex] = { ...target, exercise: replacement };
    updatedBlocks[blockIndex] = { ...block, exercises: updatedExercises };
    const updatedFlatExercises = updatedBlocks.flatMap(b => b.exercises);
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

  type PickerLocation =
    | { type: 'exercise'; index: number }
    | { type: 'superset'; index: number; slot: 'A' | 'B' }
    | { type: 'circuit'; blockIndex: number; exIndex: number };

  const [pickerModal, setPickerModal] = useState<{ visible: boolean; location: PickerLocation }>({
    visible: false,
    location: { type: 'exercise', index: 0 },
  });
  const [pickerCategory, setPickerCategory] = useState<PickerCategory>('weight_lifting');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerIsNew, setPickerIsNew] = useState(false);

  const [newExName, setNewExName] = useState('');
  const [newExCategories, setNewExCategories] = useState<Set<TopCategory>>(new Set());
  const [newExWeightSubs, setNewExWeightSubs] = useState<Set<WeightLiftingType>>(new Set());
  const [newExMuscles, setNewExMuscles] = useState<Set<MuscleGroup>>(new Set());
  const [newExEquipment, setNewExEquipment] = useState('');
  const [newExType, setNewExType] = useState<ExerciseCategory>('compound');
  const [newExSaving, setNewExSaving] = useState(false);
  const [newExError, setNewExError] = useState('');

  type SwState = 'idle' | 'countdown' | 'running' | 'paused';
  const [swState, setSwState] = useState<SwState>('idle');
  const [swCountdown, setSwCountdown] = useState(5);
  const [swElapsed, setSwElapsed] = useState(0);
  const [swIsHolding, setSwIsHolding] = useState(false);
  const swIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const swElapsedRef = useRef(0);

  useEffect(() => {
    return () => { if (swIntervalRef.current) clearInterval(swIntervalRef.current); };
  }, []);

  function formatSwTime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function startSwRunning() {
    setSwState('running');
    swIntervalRef.current = setInterval(() => {
      swElapsedRef.current += 1;
      setSwElapsed(swElapsedRef.current);
    }, 1000);
  }

  function handleSwPress() {
    if (swState === 'idle') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      swElapsedRef.current = 0;
      setSwElapsed(0);
      setSwState('countdown');
      setSwCountdown(5);
      let count = 5;
      swIntervalRef.current = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(swIntervalRef.current!);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          startSwRunning();
        } else {
          setSwCountdown(count);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }, 1000);
    } else if (swState === 'running') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
      setSwState('paused');
    } else if (swState === 'paused') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startSwRunning();
    }
  }

  async function handleSwLongPress() {
    if (swState !== 'running' && swState !== 'paused') return;
    if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    const finalElapsed = swElapsedRef.current;
    setSwState('idle');
    setSwIsHolding(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWorkout(prev => {
      if (!prev) return prev;
      const updated = { ...prev, elapsedSeconds: finalElapsed };
      updateWorkout(updated);
      return updated;
    });
  }

  function handleSwPressIn() {
    if (swState === 'running' || swState === 'paused') setSwIsHolding(true);
  }

  function handleSwPressOut() {
    setSwIsHolding(false);
  }

  const { customExercises, createExercise } = useCustomExercises();
  const { hiddenIds } = useHiddenExercises();

  const resetNewExForm = () => {
    setNewExName('');
    setNewExCategories(new Set());
    setNewExWeightSubs(new Set());
    setNewExMuscles(new Set());
    setNewExEquipment('');
    setNewExType('compound');
    setNewExError('');
  };

  const openPicker = (location: PickerLocation) => {
    setPickerSearch('');
    setPickerIsNew(false);
    resetNewExForm();
    setPickerModal({ visible: true, location });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveNewExercise = async () => {
    const trimmedName = newExName.trim();
    if (!trimmedName) { setNewExError('Exercise name is required.'); return; }
    if (trimmedName.length > 40) { setNewExError('Name must be 40 characters or less.'); return; }
    if (newExCategories.size === 0) { setNewExError('Select at least one category.'); return; }
    if (newExMuscles.size === 0) { setNewExError('Select at least one muscle group.'); return; }
    if (!newExEquipment) { setNewExError('Select equipment.'); return; }
    setNewExError('');
    setNewExSaving(true);
    try {
      const saved = await createExercise({
        name: trimmedName,
        muscles: Array.from(newExMuscles),
        equipment: newExEquipment,
        type: newExType,
        topCategories: Array.from(newExCategories),
        weightSubCategories: Array.from(newExWeightSubs),
      });
      const exercise: Exercise = {
        id: saved.id,
        name: saved.name,
        muscles: saved.muscles,
        category: saved.type,
        equipment: saved.equipment,
      };
      await handleSelectExercise(exercise);
      resetNewExForm();
      setPickerIsNew(false);
    } catch {
      setNewExError('Failed to save. Please try again.');
    } finally {
      setNewExSaving(false);
    }
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    if (!workout) return;
    setPickerModal(prev => ({ ...prev, visible: false }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const loc = pickerModal.location;
    let updated: GeneratedWorkout = { ...workout };

    if (loc.type === 'exercise') {
      const exercises = [...workout.exercises];
      exercises[loc.index] = { ...exercises[loc.index], exercise };
      updated = { ...workout, exercises };
    } else if (loc.type === 'superset' && workout.supersets) {
      const supersets = [...workout.supersets];
      const pair = supersets[loc.index];
      const key = loc.slot === 'A' ? 'exerciseA' : 'exerciseB';
      supersets[loc.index] = { ...pair, [key]: { ...pair[key], exercise } };
      updated = { ...workout, supersets };
    } else if (loc.type === 'circuit' && workout.circuitBlocks) {
      const blocks = [...workout.circuitBlocks];
      const block = { ...blocks[loc.blockIndex], exercises: [...blocks[loc.blockIndex].exercises] };
      block.exercises[loc.exIndex] = { ...block.exercises[loc.exIndex], exercise };
      blocks[loc.blockIndex] = block;
      const flatExercises = blocks.flatMap(b => b.exercises);
      updated = { ...workout, circuitBlocks: blocks, exercises: flatExercises };
    }

    setWorkout(updated);
    await updateWorkout(updated);
  };

  if (!workout) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (workout.subType === "just_run") {
    return <JustRunDetail workout={workout} />;
  }

  const accentColor = CATEGORY_COLORS[workout.topCategory] || Colors.primary;
  const hasSupersets = workout.supersets && workout.supersets.length > 0;
  const supersetExerciseCount = hasSupersets ? workout.supersets!.reduce((sum, ss) => sum + ss.exerciseA.sets + ss.exerciseB.sets, 0) : 0;
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets, 0) + supersetExerciseCount;
  const totalExerciseCount = workout.exercises.length + (hasSupersets ? workout.supersets!.length * 2 : 0);
  const hasCircuitBlocks = workout.circuitBlocks && workout.circuitBlocks.length > 0;
  const showWeightLog = workout.topCategory === 'weight_lifting' || workout.topCategory === 'circuit';
  const showNotesLog = workout.topCategory === 'yoga' || workout.topCategory === 'cardio' || workout.topCategory === 'mobility';
  const categoryLabel = TOP_CATEGORY_LABELS[workout.topCategory] || "Workout";
  const subLabel = getSubTypeLabel(workout.topCategory, workout.subType);
  const circuitFormat = hasCircuitBlocks ? workout.circuitBlocks![0].format : null;
  const supportsBalance = circuitFormat === 'EMOM' || circuitFormat === 'Rounds for Time';
  const currentBalance: CircuitBalance = workout.circuitBalance || 'default';

  const handleBalance = async (balance: CircuitBalance) => {
    if (!workout || balance === currentBalance) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const rebalanced = rebalanceCircuit(workout, balance, customExercises);
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
            <View style={styles.heroTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{workout.name}</Text>
                <Text style={styles.heroType}>{subLabel}</Text>
              </View>
              <Pressable
                onPress={() => shareWorkoutCard(shareCardRef)}
                style={styles.shareBtn}
                hitSlop={8}
              >
                <Ionicons name="share-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.shareBtnText}>Share</Text>
              </Pressable>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{totalExerciseCount}</Text>
                <Text style={styles.heroStatLabel}>{hasCircuitBlocks ? "Movements" : "Exercises"}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>
                  {supportsBalance && hasCircuitBlocks
                    ? (workout.circuitBlocks!.length > 1
                        ? workout.circuitBlocks!.map(b => b.rounds || 0).join('/')
                        : workout.circuitBlocks![0].rounds)
                    : totalSets}
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
              onPickExercise={(exIndex) => openPicker({ type: 'circuit', blockIndex: bi, exIndex })}
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
                    <ExerciseCard key={ex.exercise.id + origIdx} item={ex} index={++idx} accentColor={accentColor} onRefresh={() => handleRefreshExercise(origIdx)} onPickExercise={() => openPicker({ type: 'exercise', index: origIdx })} showWeightLog={showWeightLog} onLogWeight={() => openWeightModal(ex.exercise.name, { type: 'exercise', index: origIdx }, ex.weight, ex.weightUnit)} />
                  ))}
                  {workout.supersets!.map((pair, i) => (
                    <SupersetCard key={`ss-${i}`} pair={pair} index={i} accentColor={accentColor} onRefreshA={() => handleRefreshSuperset(i, 'A')} onRefreshB={() => handleRefreshSuperset(i, 'B')} onLogWeightA={() => openWeightModal(pair.exerciseA.exercise.name, { type: 'superset', index: i, slot: 'A' }, pair.exerciseA.weight, pair.exerciseA.weightUnit)} onLogWeightB={() => openWeightModal(pair.exerciseB.exercise.name, { type: 'superset', index: i, slot: 'B' }, pair.exerciseB.weight, pair.exerciseB.weightUnit)} onPickA={() => openPicker({ type: 'superset', index: i, slot: 'A' })} onPickB={() => openPicker({ type: 'superset', index: i, slot: 'B' })} />
                  ))}
                  {rest.map(({ ex, origIdx }) => (
                    <ExerciseCard key={ex.exercise.id + origIdx} item={ex} index={++idx} accentColor={accentColor} onRefresh={() => handleRefreshExercise(origIdx)} onPickExercise={() => openPicker({ type: 'exercise', index: origIdx })} showWeightLog={showWeightLog} onLogWeight={() => openWeightModal(ex.exercise.name, { type: 'exercise', index: origIdx }, ex.weight, ex.weightUnit)} />
                  ))}
                </>
              );
            }
            return workout.exercises.map((ex, i) => (
              <ExerciseCard key={ex.exercise.id + i} item={ex} index={i + 1} accentColor={accentColor} onRefresh={() => handleRefreshExercise(i)} onPickExercise={() => openPicker({ type: 'exercise', index: i })} showWeightLog={showWeightLog} onLogWeight={() => openWeightModal(ex.exercise.name, { type: 'exercise', index: i }, ex.weight, ex.weightUnit)} showNotesLog={showNotesLog} onLogNotes={() => openNotesModal(ex.exercise.name, { type: 'exercise', index: i }, ex.userNotes)} />
            ));
          })()
        )}
      </ScrollView>

      {hasCircuitBlocks && (
        <View style={[styles.swFooter, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8) }]}>
          <Pressable
            onPress={handleSwPress}
            onLongPress={handleSwLongPress}
            onPressIn={handleSwPressIn}
            onPressOut={handleSwPressOut}
            delayLongPress={2000}
            style={[styles.swBtn, swIsHolding && styles.swBtnHolding, swState !== 'idle' && { borderColor: `${Colors.circuit}60` }]}
          >
            <Ionicons
              name={swState === 'running' ? 'pause-outline' : swState === 'paused' ? 'play-outline' : 'stopwatch-outline'}
              size={16}
              color={swState === 'idle' ? Colors.textSecondary : Colors.circuit}
            />
            <Text style={[styles.swBtnText, swState !== 'idle' && { color: Colors.circuit }]}>
              {swState === 'idle' ? 'Stopwatch' : swState === 'running' ? 'Pause' : swState === 'countdown' ? 'Starting…' : 'Resume'}
            </Text>
            {swIsHolding && <Text style={styles.swHoldLabel}>hold to stop</Text>}
          </Pressable>

          <View style={styles.swDisplay}>
            {swState === 'idle' && (
              workout.elapsedSeconds != null
                ? <Text style={styles.swSavedTime}>{formatSwTime(workout.elapsedSeconds)}</Text>
                : <Text style={styles.swDisplayIdle}>--:--</Text>
            )}
            {swState === 'countdown' && (
              <Text style={styles.swCountdownNum}>{swCountdown}</Text>
            )}
            {(swState === 'running' || swState === 'paused') && (
              <Text style={[styles.swElapsedText, swState === 'paused' && { opacity: 0.45 }]}>
                {formatSwTime(swElapsed)}
              </Text>
            )}
          </View>
        </View>
      )}

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

      <Modal
        visible={pickerModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={[styles.pickerModal, { paddingTop: Platform.OS === 'web' ? 20 : 0 }]}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choose Exercise</Text>
            <Pressable onPress={() => setPickerModal(prev => ({ ...prev, visible: false }))} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.pickerCategoryRow}>
            {PICKER_TABS.map(tab => {
              const isActive = !pickerIsNew && pickerCategory === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.pickerCategoryTab, isActive && { backgroundColor: `${tab.color}18`, borderBottomWidth: 2, borderBottomColor: tab.color }]}
                  onPress={() => { setPickerCategory(tab.key); setPickerSearch(''); setPickerIsNew(false); }}
                >
                  <Ionicons name={tab.icon as any} size={14} color={isActive ? tab.color : Colors.textMuted} />
                  <Text style={[styles.pickerCategoryTabText, isActive && { color: tab.color }]}>{tab.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.pickerCategoryTab, pickerIsNew && { backgroundColor: `${Colors.primary}18`, borderBottomWidth: 2, borderBottomColor: Colors.primary }]}
              onPress={() => { setPickerIsNew(true); setPickerSearch(''); resetNewExForm(); }}
            >
              <Ionicons name="add-circle-outline" size={14} color={pickerIsNew ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.pickerCategoryTabText, pickerIsNew && { color: Colors.primary }]}>New +</Text>
            </Pressable>
          </View>

          {pickerIsNew ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.newExFormContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.newExSectionLabel}>Category <Text style={styles.newExRequired}>*</Text></Text>
              <View style={styles.newExChipRow}>
                {TOP_CATEGORY_FORM_OPTIONS.map(opt => {
                  const checked = newExCategories.has(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      style={[styles.newExChip, checked && styles.newExChipActive]}
                      onPress={() => {
                        const next = new Set(newExCategories);
                        if (checked) { next.delete(opt.key); if (opt.key === 'weight_lifting') setNewExWeightSubs(new Set()); }
                        else next.add(opt.key);
                        setNewExCategories(next);
                      }}
                    >
                      {checked && <Ionicons name="checkmark" size={12} color={Colors.primary} style={{ marginRight: 4 }} />}
                      <Text style={[styles.newExChipText, checked && styles.newExChipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {newExCategories.has('weight_lifting') && (
                <>
                  <Text style={styles.newExSectionLabel}>Weight Splits <Text style={styles.newExHint}>(leave empty for all splits)</Text></Text>
                  <View style={styles.newExChipRow}>
                    {WEIGHT_SUB_OPTIONS.map(opt => {
                      const checked = newExWeightSubs.has(opt.key);
                      return (
                        <Pressable
                          key={opt.key}
                          style={[styles.newExChip, checked && styles.newExChipActive]}
                          onPress={() => {
                            const next = new Set(newExWeightSubs);
                            if (checked) next.delete(opt.key); else next.add(opt.key);
                            setNewExWeightSubs(next);
                          }}
                        >
                          {checked && <Ionicons name="checkmark" size={12} color={Colors.primary} style={{ marginRight: 4 }} />}
                          <Text style={[styles.newExChipText, checked && styles.newExChipTextActive]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.newExSectionLabel}>Exercise Name <Text style={styles.newExRequired}>*</Text></Text>
              <View style={styles.newExInputRow}>
                <TextInput
                  style={styles.newExInput}
                  value={newExName}
                  onChangeText={t => setNewExName(t.slice(0, 40))}
                  placeholder="e.g. Kettlebell Clean"
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                  maxLength={40}
                />
                <Text style={styles.newExCharCount}>{newExName.length}/40</Text>
              </View>

              <Text style={styles.newExSectionLabel}>Muscle Group(s) <Text style={styles.newExRequired}>*</Text></Text>
              <View style={styles.newExChipRow}>
                {MUSCLE_GROUP_OPTIONS.map(mg => {
                  const checked = newExMuscles.has(mg);
                  return (
                    <Pressable
                      key={mg}
                      style={[styles.newExChip, checked && styles.newExChipActive]}
                      onPress={() => {
                        const next = new Set(newExMuscles);
                        if (checked) next.delete(mg); else next.add(mg);
                        setNewExMuscles(next);
                      }}
                    >
                      {checked && <Ionicons name="checkmark" size={12} color={Colors.primary} style={{ marginRight: 4 }} />}
                      <Text style={[styles.newExChipText, checked && styles.newExChipTextActive]}>{MUSCLE_GROUP_LABELS[mg]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.newExSectionLabel}>Equipment <Text style={styles.newExRequired}>*</Text></Text>
              <View style={styles.newExChipRow}>
                {EQUIPMENT_OPTIONS.map(eq => {
                  const checked = newExEquipment === eq;
                  return (
                    <Pressable
                      key={eq}
                      style={[styles.newExChip, checked && styles.newExChipActive]}
                      onPress={() => setNewExEquipment(checked ? '' : eq)}
                    >
                      {checked && <Ionicons name="checkmark" size={12} color={Colors.primary} style={{ marginRight: 4 }} />}
                      <Text style={[styles.newExChipText, checked && styles.newExChipTextActive]}>{eq}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.newExSectionLabel}>Type <Text style={styles.newExRequired}>*</Text></Text>
              <View style={styles.newExTypeRow}>
                {(['compound', 'isolation'] as ExerciseCategory[]).map(t => (
                  <Pressable
                    key={t}
                    style={[styles.newExTypeBtn, newExType === t && styles.newExTypeBtnActive]}
                    onPress={() => setNewExType(t)}
                  >
                    <Text style={[styles.newExTypeBtnText, newExType === t && styles.newExTypeBtnTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {newExError ? <Text style={styles.newExErrorText}>{newExError}</Text> : null}

              <Pressable
                style={[styles.newExSaveBtn, newExSaving && { opacity: 0.6 }]}
                onPress={handleSaveNewExercise}
                disabled={newExSaving}
              >
                <Text style={styles.newExSaveBtnText}>{newExSaving ? 'Saving...' : 'Save & Use Exercise'}</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <View style={styles.pickerSearchContainer}>
                <Ionicons name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.pickerSearchInput}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  placeholder="Search exercises..."
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {pickerSearch.length > 0 && (
                  <Pressable onPress={() => setPickerSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <FlatList
                data={getPickerExercises(pickerCategory, customExercises, hiddenIds).filter(ex =>
                  ex.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                  ex.equipment.toLowerCase().includes(pickerSearch.toLowerCase())
                )}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.pickerListContent}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const activeColor = PICKER_TABS.find(t => t.key === pickerCategory)?.color || Colors.primary;
                  const isCustom = item.id.startsWith('cx_');
                  return (
                    <Pressable style={styles.pickerExerciseRow} onPress={() => handleSelectExercise(item)}>
                      <View style={styles.pickerExerciseInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.pickerExerciseName}>{item.name}</Text>
                          {isCustom && (
                            <View style={styles.customBadge}>
                              <Text style={styles.customBadgeText}>Custom</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.pickerExerciseMeta}>
                          <Text style={styles.pickerExerciseEquipment}>{item.equipment}</Text>
                          <View style={[styles.pickerCategoryBadge, { backgroundColor: item.category === 'compound' ? `${activeColor}18` : 'rgba(0,212,170,0.12)' }]}>
                            <Text style={[styles.pickerCategoryBadgeText, { color: item.category === 'compound' ? activeColor : Colors.accent }]}>
                              {item.category === 'compound' ? 'Compound' : 'Isolation'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </Pressable>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
              />
            </>
          )}
        </View>
      </Modal>

      {workout && <ShareableRegularCard ref={shareCardRef} workout={workout} />}
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
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
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
    marginLeft: 8,
    marginTop: 2,
  },
  shareBtnText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  runStatsShareRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  swFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 8,
  },
  swBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swBtnHolding: {
    backgroundColor: `${Colors.circuit}18`,
    borderColor: Colors.circuit,
  },
  swBtnText: {
    fontSize: 14,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  swHoldLabel: {
    fontSize: 10,
    fontFamily: "Rubik_400Regular",
    color: Colors.circuit,
    marginLeft: 4,
  },
  swDisplay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  swDisplayIdle: {
    fontSize: 22,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  swSavedTime: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.circuit,
    letterSpacing: 1,
  },
  swCountdownNum: {
    fontSize: 38,
    fontFamily: "Rubik_700Bold",
    color: Colors.circuit,
  },
  swElapsedText: {
    fontSize: 28,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: 1,
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
  pickerModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  pickerCategoryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerCategoryTab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  pickerCategoryTabText: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
    color: Colors.textMuted,
  },
  pickerSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Rubik_400Regular",
    color: Colors.text,
  },
  pickerListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  pickerExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  pickerExerciseInfo: {
    flex: 1,
  },
  pickerExerciseName: {
    fontSize: 15,
    fontFamily: "Rubik_500Medium",
    color: Colors.text,
    marginBottom: 4,
  },
  pickerExerciseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerExerciseEquipment: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  pickerCategoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pickerCategoryBadgeText: {
    fontSize: 11,
    fontFamily: "Rubik_500Medium",
  },
  pickerSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 0,
  },
  customBadge: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customBadgeText: {
    fontSize: 10,
    fontFamily: 'Rubik_600SemiBold',
    color: Colors.primary,
  },
  newExFormContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 60,
  },
  newExSectionLabel: {
    fontSize: 13,
    fontFamily: 'Rubik_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 10,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newExRequired: {
    color: Colors.primary,
  },
  newExHint: {
    fontSize: 11,
    fontFamily: 'Rubik_400Regular',
    color: Colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
  },
  newExChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  newExChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newExChipActive: {
    backgroundColor: `${Colors.primary}18`,
    borderColor: Colors.primary,
  },
  newExChipText: {
    fontSize: 13,
    fontFamily: 'Rubik_500Medium',
    color: Colors.textSecondary,
  },
  newExChipTextActive: {
    color: Colors.primary,
  },
  newExInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  newExInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Rubik_400Regular',
    color: Colors.text,
    paddingVertical: 10,
  },
  newExCharCount: {
    fontSize: 12,
    fontFamily: 'Rubik_400Regular',
    color: Colors.textMuted,
    marginLeft: 8,
  },
  newExTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  newExTypeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newExTypeBtnActive: {
    backgroundColor: `${Colors.primary}18`,
    borderColor: Colors.primary,
  },
  newExTypeBtnText: {
    fontSize: 14,
    fontFamily: 'Rubik_500Medium',
    color: Colors.textSecondary,
  },
  newExTypeBtnTextActive: {
    color: Colors.primary,
    fontFamily: 'Rubik_600SemiBold',
  },
  newExErrorText: {
    fontSize: 13,
    fontFamily: 'Rubik_400Regular',
    color: '#FF4757',
    marginTop: 12,
    marginBottom: 4,
  },
  newExSaveBtn: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  newExSaveBtnText: {
    fontSize: 16,
    fontFamily: 'Rubik_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  backBtnRun: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  runDetailScroll: {
    paddingHorizontal: 20,
    paddingTop: 60,
    gap: 16,
  },
  runDetailHeader: {
    alignItems: "center",
    paddingBottom: 4,
    gap: 6,
  },
  runDetailIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  runDetailTitle: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  runDetailDate: {
    fontSize: 13,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  runMapCard: {
    borderRadius: 20,
    overflow: "hidden",
    height: 280,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  runMap: {
    flex: 1,
  },
  runStatsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  runStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  runStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  runStatValue: {
    fontSize: 26,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  runStatLabel: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  runStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.border,
  },
});
