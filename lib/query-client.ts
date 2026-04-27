import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken } from "@/lib/auth-storage";

/**
 * Gets the base URL for the Express API server
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

/**
 * Translates raw network/HTTP errors into user-friendly messages.
 * Pass either an Error thrown by fetch or a Response status code.
 */
export function getFriendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("network request failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed")
    ) {
      return "Unable to reach the server. Check your connection and try again.";
    }
    if (msg.startsWith("401")) {
      return "Your session has expired. Please sign in again.";
    }
    if (msg.startsWith("403")) {
      return "You don't have permission to do this.";
    }
    if (msg.startsWith("404")) {
      return "The requested resource was not found.";
    }
    if (msg.startsWith("429")) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (msg.startsWith("5")) {
      return "The server encountered an error. Please try again in a moment.";
    }
  }
  return "Something went wrong. Please try again.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const raw = new Error(`${res.status}: ${text}`);
    throw new Error(getFriendlyErrorMessage(raw));
  }
}

function wrapNetworkError(err: unknown): never {
  throw new Error(getFriendlyErrorMessage(err));
}

async function buildAuthHeaders(hasBody: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  const token = await getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);
  const headers = await buildAuthHeaders(!!data);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  } catch (err) {
    wrapNetworkError(err);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);
    const headers = await buildAuthHeaders(false);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers,
        credentials: "include",
      });
    } catch (err) {
      wrapNetworkError(err);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Global staleTime is Infinity so static/config data is never re-fetched unnecessarily.
// Queries that return frequently-changing or permission-sensitive data (e.g. admin status,
// user feedback history) should override this with an explicit, shorter staleTime such as
// 5 * 60 * 1000 (5 minutes). Always invalidate manually after mutations that change the data.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
