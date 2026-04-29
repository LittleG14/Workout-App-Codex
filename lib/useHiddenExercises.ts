import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCustomExercises } from "@/lib/useCustomExercises";

const HIDDEN_KEY = "hidden_exercise_ids";
const RESET_KEY = "pr_reset_timestamps";

export function useHiddenExercises() {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [resetTimestamps, setResetTimestamps] = useState<Record<string, string>>({});
  const { deleteExercise } = useCustomExercises();

  useEffect(() => {
    const load = async () => {
      const [h, r] = await Promise.all([
        AsyncStorage.getItem(HIDDEN_KEY),
        AsyncStorage.getItem(RESET_KEY),
      ]);
      if (h) setHiddenIds(JSON.parse(h));
      if (r) setResetTimestamps(JSON.parse(r));
    };
    load();
  }, []);

  const hideExercise = useCallback(async (id: string) => {
    const next = [...hiddenIds.filter(x => x !== id), id];
    setHiddenIds(next);
    await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    if (id.startsWith("cx_")) {
      try { await deleteExercise(id); } catch {}
    }
  }, [hiddenIds, deleteExercise]);

  const resetExercise = useCallback(async (id: string) => {
    const next = { ...resetTimestamps, [id]: new Date().toISOString() };
    setResetTimestamps(next);
    await AsyncStorage.setItem(RESET_KEY, JSON.stringify(next));
  }, [resetTimestamps]);

  const unhideExercise = useCallback(async (id: string) => {
    const next = hiddenIds.filter(x => x !== id);
    setHiddenIds(next);
    await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  }, [hiddenIds]);

  return { hiddenIds, resetTimestamps, hideExercise, resetExercise, unhideExercise };
}
