import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import {
  GeneratedWorkout,
  WORKOUT_TYPE_LABELS,
} from "@/lib/exercises";
import { getWorkouts, deleteWorkout } from "@/lib/workout-storage";

function WorkoutHistoryItem({ item, index, onDelete }: {
  item: GeneratedWorkout;
  index: number;
  onDelete: (id: string) => void;
}) {
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

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/workout/[id]", params: { id: item.id } });
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to remove this workout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(item.id),
        },
      ],
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        style={({ pressed }) => [
          styles.historyCard,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
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
      </Pressable>
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          <WorkoutHistoryItem
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
    gap: 12,
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
