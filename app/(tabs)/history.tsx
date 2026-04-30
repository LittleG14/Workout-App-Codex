import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Colors from "@/constants/colors";
import {
  GeneratedWorkout,
  TOP_CATEGORY_LABELS,
  getSubTypeLabel,
  TopCategory,
} from "@/lib/exercises";
import { getWorkouts, deleteWorkout } from "@/lib/workout-storage";

const DELETE_THRESHOLD = -80;
const SNAP_OPEN = -90;

function SwipeableWorkoutItem({ item, index, onDelete }: {
  item: GeneratedWorkout;
  index: number;
  onDelete: (id: string) => void;
}) {
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue(1);
  const rowOpacity = useSharedValue(1);
  const contextX = useSharedValue(0);
  const isOpen = useRef(false);

  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const totalSets = item.exercises.reduce((sum, e) => sum + e.sets, 0);
  const isJustRun = item.subType === "just_run";

  const CATEGORY_COLORS: Record<string, string> = {
    weight_lifting: Colors.primary,
    circuit: Colors.circuit,
    yoga: Colors.yoga,
    cardio: Colors.cardio,
  };
  const catColor = CATEGORY_COLORS[item.topCategory] || Colors.primary;
  const catLabel = TOP_CATEGORY_LABELS[item.topCategory] || "Workout";

  function formatRunTime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const runDist = isJustRun && item.runData
    ? item.runData.unit === "miles"
      ? `${item.runData.distanceMiles.toFixed(2)} mi`
      : `${item.runData.distanceKm.toFixed(2)} km`
    : null;
  const runTime = isJustRun && item.runData ? formatRunTime(item.runData.durationSeconds) : null;

  const triggerDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDelete(item.id);
  }, [item.id, onDelete]);

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
    .onStart(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((event) => {
      const newX = contextX.value + event.translationX;
      translateX.value = Math.min(0, Math.max(newX, -150));
    })
    .onEnd((event) => {
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withTiming(SNAP_OPEN, { duration: 200 });
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
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(router.push)({ pathname: "/workout/[id]", params: { id: item.id } });
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteActionStyle = useAnimatedStyle(() => {
    const actionOpacity = interpolate(
      translateX.value,
      [0, SNAP_OPEN],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: actionOpacity,
    };
  });

  const rowContainerStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ scaleY: rowHeight.value }],
    marginBottom: interpolate(rowHeight.value, [0, 1], [0, 12]),
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(350)}
      style={rowContainerStyle}
    >
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.deleteAction, deleteActionStyle]}>
          <Pressable onPress={handleDeletePress} style={styles.deleteButton}>
            <Ionicons name="trash" size={22} color="#FFF" />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </Animated.View>

        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.historyCard, cardAnimStyle]}>
            <View style={styles.historyCardHeader}>
              <View style={styles.historyCardTitleRow}>
                <Text style={styles.historyCardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.styleBadge, { backgroundColor: `${catColor}20` }]}>
                  <Text style={[styles.styleBadgeText, { color: catColor }]}>
                    {catLabel}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyCardType}>
                {getSubTypeLabel(item.topCategory, item.subType)}
              </Text>
            </View>

            <View style={styles.historyCardStats}>
              {isJustRun ? (
                <>
                  <View style={styles.historyStatItem}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.historyStatText}>{runDist ?? "--"}</Text>
                  </View>
                  <View style={styles.historyStatItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.historyStatText}>{runTime ?? "--"}</Text>
                  </View>
                  <View style={styles.historyStatItem}>
                    <Ionicons name="footsteps-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.historyStatText}>GPS Run</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.historyStatItem}>
                    <Ionicons name="barbell-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.historyStatText}>
                      {item.exercises.length} exercises
                    </Text>
                  </View>
                  <View style={styles.historyStatItem}>
                    <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.historyStatText}>{totalSets} sets</Text>
                  </View>
                  <View style={styles.historyStatItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.historyStatText}>{item.durationMinutes} min</Text>
                  </View>
                </>
              )}
            </View>

            {item.topCategory === "circuit" && item.elapsedSeconds != null && (
              <View style={styles.swTimeRow}>
                <Ionicons name="stopwatch-outline" size={12} color={Colors.circuit} />
                <Text style={styles.swTimeText}>{formatRunTime(item.elapsedSeconds)}</Text>
              </View>
            )}

            <View style={styles.historyCardFooter}>
              <Text style={styles.historyDateText}>{dateStr} at {timeStr}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const ALL_CATEGORIES: { key: TopCategory; label: string; color: string; icon: string }[] = [
  { key: "weight_lifting", label: "Weights",  color: Colors.primary,  icon: "barbell" },
  { key: "circuit",        label: "Circuit",  color: Colors.circuit,  icon: "flash" },
  { key: "yoga",           label: "Yoga",     color: Colors.yoga,     icon: "leaf" },
  { key: "cardio",         label: "Cardio",   color: Colors.cardio,   icon: "heart" },
  { key: "mobility",       label: "Mobility", color: Colors.mobility, icon: "body" },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Set<TopCategory>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<TopCategory>>(new Set());
  const webTopPad = Platform.OS === "web" ? 67 : 0;

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, []),
  );

  const loadWorkouts = async () => {
    const data = await getWorkouts();
    setWorkouts(data);
  };

  const handleDelete = async (id: string) => {
    await deleteWorkout(id);
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  const togglePending = (key: TopCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingFilters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const openFilter = () => {
    setPendingFilters(new Set(activeFilters));
    setFilterOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyFilter = () => {
    setActiveFilters(new Set(pendingFilters));
    setFilterOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearFilter = () => {
    setPendingFilters(new Set());
    setActiveFilters(new Set());
    setFilterOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const isFiltered = activeFilters.size > 0;
  const displayedWorkouts = isFiltered
    ? workouts.filter((w) => activeFilters.has(w.topCategory as TopCategory))
    : workouts;

  const subtitleText = () => {
    if (workouts.length === 0) return "Your past workouts";
    if (isFiltered) {
      return `${displayedWorkouts.length} of ${workouts.length} workout${workouts.length !== 1 ? "s" : ""}`;
    }
    return `${workouts.length} workout${workouts.length !== 1 ? "s" : ""} generated`;
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="barbell-outline" size={48} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>{isFiltered ? "No matching workouts" : "No workouts yet"}</Text>
      <Text style={styles.emptySubtitle}>
        {isFiltered ? "Try adjusting your filters" : "Generate your first workout to see it here"}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>History</Text>
            <Text style={styles.headerSubtitle}>{subtitleText()}</Text>
          </View>
          <Pressable
            style={[styles.filterBtn, isFiltered && styles.filterBtnActive]}
            onPress={filterOpen ? () => setFilterOpen(false) : openFilter}
            testID="filter-btn"
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={isFiltered ? Colors.primary : Colors.textSecondary}
            />
            {isFiltered && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilters.size}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {filterOpen && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.dropdown}>
            {ALL_CATEGORIES.map((cat) => {
              const selected = pendingFilters.has(cat.key);
              return (
                <Pressable
                  key={cat.key}
                  style={[styles.dropdownRow, selected && { backgroundColor: `${cat.color}12` }]}
                  onPress={() => togglePending(cat.key)}
                >
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Ionicons name={cat.icon as any} size={16} color={selected ? cat.color : Colors.textMuted} />
                  <Text style={[styles.dropdownLabel, selected && { color: cat.color, fontFamily: "Rubik_600SemiBold" }]}>
                    {cat.label}
                  </Text>
                  <View style={[styles.checkbox, selected && { backgroundColor: cat.color, borderColor: cat.color }]}>
                    {selected && <Ionicons name="checkmark" size={11} color="#FFF" />}
                  </View>
                </Pressable>
              );
            })}
            <View style={styles.dropdownActions}>
              <Pressable style={styles.clearBtn} onPress={clearFilter}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={applyFilter}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>

      <FlatList
        data={displayedWorkouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SwipeableWorkoutItem
            item={item}
            index={index}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
          displayedWorkouts.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  swipeContainer: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: Colors.error,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
    height: "100%",
  },
  deleteText: {
    fontSize: 11,
    fontFamily: "Rubik_600SemiBold",
    color: "#FFF",
  },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyCardHeader: {
    marginBottom: 12,
  },
  historyCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyCardTitle: {
    fontSize: 17,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  styleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  styleBadgeText: {
    fontSize: 11,
    fontFamily: "Rubik_700Bold",
    letterSpacing: 0.5,
  },
  historyCardType: {
    fontSize: 13,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    marginTop: 3,
  },
  historyCardStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  historyStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyStatText: {
    fontSize: 12,
    fontFamily: "Rubik_500Medium",
    color: Colors.textMuted,
  },
  historyCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  historyDateText: {
    fontSize: 12,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  swTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: `${Colors.circuit}15`,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  swTimeText: {
    fontSize: 12,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.circuit,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    gap: 6,
  },
  filterBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  filterBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: "Rubik_700Bold",
    color: "#FFF",
  },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 12,
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Rubik_400Regular",
    color: Colors.text,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownActions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearBtnText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  applyBtnText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 14,
    color: "#FFF",
  },
});
