/**
 * Typed fetch client (AD-1: direct calls to FastAPI, no BFF).
 *
 * - Attaches `Authorization: Bearer <access>` when a token is supplied.
 * - One silent refresh on 401 (AD-2) then retries once.
 * - Mock fallback is OFF by default. Set NEXT_PUBLIC_USE_MOCKS=1 to force
 *   in-memory fixtures when the backend is not yet built. Without the flag,
 *   real 404s → not-found state, 5xx/network → error state with retry.
 * - Auth never mocks — login/register always hit the real API.
 */
import { API_URL } from "@/lib/constants";
import { mockRequest } from "@/lib/mocks/handlers";
import type { ApiError } from "./types";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.detail || `HTTP ${status}`);
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  /** force mock even if the API is up (used by demo screens) */
  mock?: boolean;
  signal?: AbortSignal;
}

type RefreshFn = () => Promise<string | null>;
let refreshFn: RefreshFn | null = null;
/** registered by the auth store to avoid a circular import */
export function setRefreshHandler(fn: RefreshFn | null) {
  refreshFn = fn;
}

export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, token, mock, signal } = opts;

  if (mock) {
    return mockRequest<T>(path, method, body);
  }

  const isFormData = body instanceof FormData;
  const doFetch = (tok: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(!isFormData && body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: isFormData ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });

  let res: Response;
  try {
    res = await doFetch(token ?? null);
  } catch {
    // API down → mock fallback only when explicitly enabled
    if (path.startsWith("/api/v1/auth")) {
      throw new HttpError(0, {
        detail: "API unreachable — start it with: docker compose up -d",
      });
    }
    if (USE_MOCKS) {
      return mockRequest<T>(path, method, body);
    }
    throw new HttpError(0, {
      detail: "API unreachable — start it with: docker compose up -d",
    });
  }

  // silent refresh once on 401 (AD-2)
  if (res.status === 401 && token && refreshFn && !path.includes("/auth/")) {
    const fresh = await refreshFn();
    if (fresh) {
      try {
        res = await doFetch(fresh);
      } catch {
        if (USE_MOCKS) {
          return mockRequest<T>(path, method, body);
        }
        throw new HttpError(0, {
          detail: "API unreachable — start it with: docker compose up -d",
        });
      }
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { detail: text };
  }

  if (!res.ok) {
    // Real 404 → throw so the page renders a not-found state (never mock data).
    // Mock fallback only when NEXT_PUBLIC_USE_MOCKS=1 is explicitly set.
    if (USE_MOCKS && (res.status === 501 || res.status === 404)) {
      return mockRequest<T>(path, method, body);
    }
    throw new HttpError(res.status, (parsed as ApiError) ?? { detail: text });
  }

  return parsed as T;
}
