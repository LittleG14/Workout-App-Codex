import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/lib/auth-storage";
import { useAuth } from "@/contexts/AuthContext";
import type { CustomExerciseData } from "@/lib/exercises";

const QUERY_KEY = ["/api/exercises"];

async function apiRequest(method: string, path: string, body?: unknown) {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error((err as any).message ?? "Request failed");
  }
  return res.json();
}

export function useCustomExercises() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<CustomExerciseData[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!user) return [];
      const data = await apiRequest("GET", "/api/exercises");
      return (data.exercises ?? []) as CustomExerciseData[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: async (exercise: Omit<CustomExerciseData, "id">) => {
      const data = await apiRequest("POST", "/api/exercises", exercise);
      return data.exercise as CustomExerciseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/exercises/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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
