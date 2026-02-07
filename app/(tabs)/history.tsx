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
  WORKOUT_TYPE_LABELS,
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
  const isStrength = item.style === "strength";

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
        translateX.value = withSpring(SNAP_OPEN, { damping: 20, stiffness: 200 });
        isOpen.current = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        isOpen.current = false;
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (isOpen.current) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
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
      [0, -40, -80],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [0, -60, -90],
      [0.5, 0.8, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: actionOpacity,
      transform: [{ scale }],
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
                <View
                  style={[
                    styles.styleBadge,
                    {
                      backgroundColor: isStrength
                        ? "rgba(92, 124, 250, 0.15)"
                        : "rgba(255, 107, 53, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.styleBadgeText,
                      { color: isStrength ? Colors.strength : Colors.hypertrophy },
                    ]}
                  >
                    {isStrength ? "STR" : "HYP"}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyCardType}>
                {WORKOUT_TYPE_LABELS[item.workoutType]}
              </Text>
            </View>

            <View style={styles.historyCardStats}>
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
            </View>

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

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);
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

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="barbell-outline" size={48} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No workouts yet</Text>
      <Text style={styles.emptySubtitle}>
        Generate your first workout to see it here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>
          {workouts.length > 0
            ? `${workouts.length} workout${workouts.length !== 1 ? "s" : ""} generated`
            : "Your past workouts"}
        </Text>
      </View>

      <FlatList
        data={workouts}
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
          workouts.length === 0 && styles.emptyList,
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
});
