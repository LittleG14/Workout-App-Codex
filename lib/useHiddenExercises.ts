import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCustomExercises } from "@/lib/useCustomExercises";
import { accountStorageKey, assertAccountScope, getAccountScope } from './account-scope';
import { useAuth } from '@/contexts/AuthContext';

const HIDDEN_KEY = "hidden_exercise_ids";
const RESET_KEY = "pr_reset_timestamps";

export function useHiddenExercises() {
  const { user } = useAuth();
  const captureScope = useCallback(() => {
    const scope = getAccountScope();
    if (scope.userId !== user?.id) throw new Error('Your account changed. Please try again.');
    return scope;
  }, [user?.id]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [resetTimestamps, setResetTimestamps] = useState<Record<string, string>>({});
  const { deleteExercise } = useCustomExercises();

  useEffect(() => {
    const load = async () => {
      const scope = captureScope();
      const [h, r] = await Promise.all([
        AsyncStorage.getItem(accountStorageKey(scope, HIDDEN_KEY)),
        AsyncStorage.getItem(accountStorageKey(scope, RESET_KEY)),
      ]);
      assertAccountScope(scope);
      if (h) setHiddenIds(JSON.parse(h));
      if (r) setResetTimestamps(JSON.parse(r));
    };
    void load().catch(() => { /* Keep corrupt/previous-account values out of active preferences. */ });
  }, [captureScope]);

  const hideExercise = useCallback(async (id: string) => {
    const scope = captureScope();
    const next = [...hiddenIds.filter(x => x !== id), id];
    setHiddenIds(next);
    await AsyncStorage.setItem(accountStorageKey(scope, HIDDEN_KEY), JSON.stringify(next));
    assertAccountScope(scope);
    if (id.startsWith("cx_")) {
      try { await deleteExercise(id); } catch {}
    }
  }, [hiddenIds, deleteExercise, captureScope]);

  const resetExercise = useCallback(async (id: string) => {
    const scope = captureScope();
    const next = { ...resetTimestamps, [id]: new Date().toISOString() };
    setResetTimestamps(next);
    await AsyncStorage.setItem(accountStorageKey(scope, RESET_KEY), JSON.stringify(next));
    assertAccountScope(scope);
  }, [resetTimestamps, captureScope]);

  const unhideExercise = useCallback(async (id: string) => {
    const scope = captureScope();
    const next = hiddenIds.filter(x => x !== id);
    setHiddenIds(next);
    await AsyncStorage.setItem(accountStorageKey(scope, HIDDEN_KEY), JSON.stringify(next));
    assertAccountScope(scope);
  }, [hiddenIds, captureScope]);

  return { hiddenIds, resetTimestamps, hideExercise, resetExercise, unhideExercise };
}
