import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { getTokenForAccount } from "@/lib/auth-storage";
import { getAccountScope, assertAccountScope } from './account-scope';
import { withRequestTimeout } from './request-timeout';
import { useAuth } from "@/contexts/AuthContext";
import type { CustomExerciseData } from "@/lib/exercises";

const QUERY_KEY = ["/api/exercises"];

async function apiRequest(userId: string | undefined, method: string, path: string, body?: unknown) {
  const scope = getAccountScope();
  if (scope.userId !== userId) throw new Error('Your account changed. Please try again.');
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);
  const token = await getTokenForAccount(scope);
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await withRequestTimeout(signal => fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  }));
  assertAccountScope(scope);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error((err as any).message ?? "Request failed");
  }
  const data = await res.json(); assertAccountScope(scope); return data;
}

export function useCustomExercises() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = [...QUERY_KEY, user?.id ?? ''];

  const query = useQuery<CustomExerciseData[]>({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const data = await apiRequest(user.id, "GET", "/api/exercises");
      return (data.exercises ?? []) as CustomExerciseData[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: async (exercise: Omit<CustomExerciseData, "id">) => {
      const data = await apiRequest(user?.id, "POST", "/api/exercises", exercise);
      return data.exercise as CustomExerciseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(user?.id, "DELETE", `/api/exercises/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    customExercises: query.data ?? [],
    isLoading: query.isLoading,
    createExercise: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteExercise: deleteMutation.mutateAsync,
  };
}
