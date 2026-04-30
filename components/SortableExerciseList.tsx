import React, { useCallback } from "react";
import { View, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
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
  onDragStart: (index: number) => void;
  onDragEnd: (from: number, to: number) => void;
  onMeasure: (index: number, height: number) => void;
  children: React.ReactNode;
}

function SortableItem({
  index,
  count,
  dragState,
  itemHeights,
  onDragStart,
  onDragEnd,
  onMeasure,
  children,
}: SortableItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const ds = dragState.value;
    if (!ds.active) {
      return {
        transform: [{ translateY: withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }) }],
        zIndex: 1,
        opacity: 1,
        shadowOpacity: 0,
      };
    }

    const { fromIdx, toIdx, translateY } = ds;
    const heights = itemHeights.value;

    if (index === fromIdx) {
      return {
        transform: [{ translateY }],
        zIndex: 100,
        opacity: 0.9,
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 10,
      };
    }

    const shifted =
      (fromIdx < toIdx && index > fromIdx && index <= toIdx) ||
      (fromIdx > toIdx && index < fromIdx && index >= toIdx);

    if (shifted) {
      const draggedHeight = heights[fromIdx] ?? 100;
      const offset = fromIdx < toIdx ? -draggedHeight : draggedHeight;
      return {
        transform: [{ translateY: withTiming(offset, { duration: 220, easing: Easing.out(Easing.cubic) }) }],
        zIndex: 1,
        opacity: 1,
      };
    }

    return {
      transform: [{ translateY: withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }) }],
      zIndex: 1,
      opacity: 1,
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
        const n = count;
        const fromIdx = ds.fromIdx;
        let newToIdx = fromIdx;

        if (newTranslateY > 0) {
          let cumDist = 0;
          for (let i = fromIdx + 1; i < n; i++) {
            const h = heights[i] ?? 100;
            if (newTranslateY > cumDist + h * 0.4) newToIdx = i;
            cumDist += h;
          }
        } else if (newTranslateY < 0) {
          let cumDist = 0;
          for (let i = fromIdx - 1; i >= 0; i--) {
            const h = heights[i] ?? 100;
            if (-newTranslateY > cumDist + h * 0.4) newToIdx = i;
            cumDist += h;
          }
        }

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
  }, [index, count, dragState, itemHeights, onDragStart, onDragEnd]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => onMeasure(index, e.nativeEvent.layout.height),
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
    (index: number, height: number) => {
      const next = [...itemHeights.value];
      next[index] = height;
      itemHeights.value = next;
    },
    [itemHeights]
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
