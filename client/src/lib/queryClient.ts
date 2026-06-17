import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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

let unauthorizedHandlerInstalled = false;
let unauthorizedRedirectStarted = false;

function isApiRequest(input: RequestInfo | URL) {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.pathname
      : input.url;

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.startsWith("/api/");
  } catch {
    return String(url).startsWith("/api/");
  }
}

function shouldHandleUnauthorized(input: RequestInfo | URL) {
  if (!isApiRequest(input)) return false;

  const url = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.pathname
      : input.url;
  const parsed = new URL(url, window.location.origin);

  return ![
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/accept-invitation",
    "/api/auth/google",
    "/api/auth/google/callback",
  ].includes(parsed.pathname);
}

export function installUnauthorizedFetchHandler() {
  if (unauthorizedHandlerInstalled || typeof window === "undefined") return;

  unauthorizedHandlerInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);

    if (
      response.status === 401 &&
      shouldHandleUnauthorized(input) &&
      window.location.pathname !== "/login" &&
      !unauthorizedRedirectStarted
    ) {
      unauthorizedRedirectStarted = true;
      queryClient.clear();
      sessionStorage.setItem("session-expired", "true");
      window.location.assign("/login?error=session_expired");
    }

    return response;
  };
}
