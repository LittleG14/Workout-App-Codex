import React, { useCallback } from "react";
import { View, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

interface DragState {
  active: boolean;
  fromIdx: number;
  toIdx: number;
  translateY: number;
}

interface SortableItemProps {
  index: number;
  count: number;
  dragState: ReturnType<typeof useSharedValue<DragState>>;
  itemHeights: ReturnType<typeof useSharedValue<number[]>>;
  itemPositions: ReturnType<typeof useSharedValue<number[]>>;
  onDragStart: (index: number) => void;
  onDragEnd: (from: number, to: number) => void;
  onMeasure: (index: number, height: number, y: number) => void;
  children: React.ReactNode;
}

const TIMING_CONFIG = { duration: 200, easing: Easing.out(Easing.cubic) };

function SortableItem({
  index,
  count,
  dragState,
  itemHeights,
  itemPositions,
  onDragStart,
  onDragEnd,
  onMeasure,
  children,
}: SortableItemProps) {
  const visualOffset = useSharedValue(0);

  useAnimatedReaction(
    () => {
      const ds = dragState.value;
      const { active, fromIdx, toIdx, translateY } = ds;

      if (active && index === fromIdx) return null;
      if (!active) return 0;

      // Only tiles in the displaced range (between fromIdx and toIdx) can shift
      const inRange =
        (fromIdx < toIdx && index > fromIdx && index <= toIdx) ||
        (fromIdx > toIdx && index < fromIdx && index >= toIdx);
      if (!inRange) return 0;

      const positions = itemPositions.value;
      const heights = itemHeights.value;
      const n = count;

      // Per-tile center check: this tile only visually shifts when the dragged tile's
      // center has physically crossed this tile's center. This guarantees only one tile
      // displaces at a time — tall tiles (supersets) can no longer skip over a regular
      // tile's threshold and displace two tiles simultaneously in one pan event.
      const draggedCenter =
        (positions[fromIdx] ?? 0) + (heights[fromIdx] ?? 100) / 2 + translateY;
      const thisMid = (positions[index] ?? 0) + (heights[index] ?? 100) / 2;
      const crossed =
        fromIdx < toIdx ? draggedCenter > thisMid : draggedCenter < thisMid;
      if (!crossed) return 0;

      // Slot height of the dragged tile (distance from its top to the next tile's top,
      // which includes the gap/margin automatically).
      const pFrom = positions[fromIdx];
      const pNext = positions[fromIdx + 1];
      const pPrev = positions[fromIdx - 1];
      let slotHeight: number;
      if (fromIdx + 1 < n && pNext !== undefined && pFrom !== undefined) {
        slotHeight = pNext - pFrom;
      } else if (fromIdx > 0 && pFrom !== undefined && pPrev !== undefined) {
        const ownHeight = heights[fromIdx] ?? 100;
        const gapAbove = pFrom - pPrev - (heights[fromIdx - 1] ?? 0);
        slotHeight = ownHeight + Math.max(0, gapAbove);
      } else {
        slotHeight = heights[fromIdx] ?? 100;
      }

      return fromIdx < toIdx ? -slotHeight : slotHeight;
    },
    (target, prev) => {
      "worklet";
      if (target === null) return;
      if (target !== prev) {
        visualOffset.value = withTiming(target, TIMING_CONFIG);
      }
    }
  );

  const animatedStyle = useAnimatedStyle(() => {
    const ds = dragState.value;

    if (ds.active && index === ds.fromIdx) {
      return {
        transform: [{ translateY: ds.translateY }],
        zIndex: 100,
        opacity: 0.9,
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 10,
      };
    }

    return {
      transform: [{ translateY: visualOffset.value }],
      zIndex: 1,
      opacity: 1,
      shadowOpacity: 0,
    };
  });

  const gesture = React.useMemo(() => {
    const longPress = Gesture.LongPress()
      .minDuration(400)
      .onStart(() => {
        "worklet";
        runOnJS(onDragStart)(index);
        dragState.value = {
          active: true,
          fromIdx: index,
          toIdx: index,
          translateY: 0,
        };
      });

    const pan = Gesture.Pan()
      .activateAfterLongPress(400)
      .onChange((e) => {
        "worklet";
        const ds = dragState.value;
        if (!ds.active || ds.fromIdx !== index) return;

        const newTranslateY = ds.translateY + e.changeY;
        const heights = itemHeights.value;
        const positions = itemPositions.value;
        const n = count;
        const fromIdx = ds.fromIdx;
        const fromPos = positions[fromIdx] ?? 0;

        // Use dragged tile's center for threshold — consistent with the visual shift check.
        const draggedCenter = fromPos + (heights[fromIdx] ?? 100) / 2 + newTranslateY;

        let desiredToIdx = fromIdx;
        if (newTranslateY > 0) {
          for (let i = fromIdx + 1; i < n; i++) {
            const tileMid = (positions[i] ?? 0) + (heights[i] ?? 100) / 2;
            if (draggedCenter > tileMid) desiredToIdx = i;
          }
        } else if (newTranslateY < 0) {
          for (let i = fromIdx - 1; i >= 0; i--) {
            const tileMid = (positions[i] ?? 0) + (heights[i] ?? 100) / 2;
            if (draggedCenter < tileMid) desiredToIdx = i;
          }
        }

        // Clamp to ±1 step from current toIdx so the drop target advances one slot at a
        // time even if a very fast swipe crosses multiple tile-center thresholds in one
        // pan event. The visual shift (via the center-crossing check above) is independent
        // of this and will only displace tiles one by one as the drag physically reaches them.
        const newToIdx = Math.max(
          ds.toIdx - 1,
          Math.min(ds.toIdx + 1, desiredToIdx)
        );

        dragState.value = { ...ds, translateY: newTranslateY, toIdx: newToIdx };
      })
      .onEnd(() => {
        "worklet";
        const ds = dragState.value;
        if (!ds.active || ds.fromIdx !== index) return;
        const { fromIdx, toIdx } = ds;
        dragState.value = { active: false, fromIdx: -1, toIdx: -1, translateY: 0 };
        if (fromIdx !== toIdx) runOnJS(onDragEnd)(fromIdx, toIdx);
        else runOnJS(onDragEnd)(fromIdx, fromIdx);
      })
      .onFinalize(() => {
        "worklet";
        const ds = dragState.value;
        if (ds.active && ds.fromIdx === index) {
          dragState.value = { active: false, fromIdx: -1, toIdx: -1, translateY: 0 };
        }
      });

    return Gesture.Simultaneous(longPress, pan);
  }, [index, count, dragState, itemHeights, itemPositions, onDragStart, onDragEnd]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onMeasure(index, e.nativeEvent.layout.height, e.nativeEvent.layout.y);
    },
    [index, onMeasure]
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[animatedStyle, { overflow: "visible" }]} onLayout={handleLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export interface SortableListItem {
  key: string;
  element: React.ReactNode;
}

interface SortableExerciseListProps {
  items: SortableListItem[];
  onReorder: (from: number, to: number) => void;
  onDragActive: (active: boolean) => void;
}

export default function SortableExerciseList({
  items,
  onReorder,
  onDragActive,
}: SortableExerciseListProps) {
  const dragState = useSharedValue<DragState>({
    active: false,
    fromIdx: -1,
    toIdx: -1,
    translateY: 0,
  });
  const itemHeights = useSharedValue<number[]>([]);
  const itemPositions = useSharedValue<number[]>([]);

  const handleDragStart = useCallback(
    (index: number) => {
      onDragActive(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    [onDragActive]
  );

  const handleDragEnd = useCallback(
    (from: number, to: number) => {
      onDragActive(false);
      if (from !== to) onReorder(from, to);
    },
    [onDragActive, onReorder]
  );

  const handleMeasure = useCallback(
    (index: number, height: number, y: number) => {
      const nextH = [...itemHeights.value];
      nextH[index] = height;
      itemHeights.value = nextH;

      const nextP = [...itemPositions.value];
      nextP[index] = y;
      itemPositions.value = nextP;
    },
    [itemHeights, itemPositions]
  );

  return (
    <View style={{ overflow: "visible" }}>
      {items.map((item, index) => (
        <SortableItem
          key={item.key}
          index={index}
          count={items.length}
          dragState={dragState}
          itemHeights={itemHeights}
          itemPositions={itemPositions}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onMeasure={handleMeasure}
        >
          {item.element}
        </SortableItem>
      ))}
    </View>
  );
}
