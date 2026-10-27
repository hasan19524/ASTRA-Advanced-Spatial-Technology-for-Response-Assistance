/**
 * Typed fetch client (AD-1: direct calls to FastAPI, no BFF).
 *
 * - Attaches `Authorization: Bearer <access>` when a token is supplied.
 * - One silent refresh on 401 (AD-2) then retries once.
 * - If the API is unreachable OR the endpoint is not implemented yet
 *   (backend currently only serves /auth), falls back to the in-memory
 *   mock layer so every screen renders (task 1.4). Auth never mocks —
 *   login/register always hit the real API.
 */
import { API_URL } from "@/lib/constants";
import { mockRequest } from "@/lib/mocks/handlers";
import type { ApiError } from "./types";

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

  const doFetch = (tok: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res: Response;
  try {
    res = await doFetch(token ?? null);
  } catch {
    // API down → mock fallback (auth must fail loudly instead)
    if (path.startsWith("/api/v1/auth")) {
      throw new HttpError(0, {
        detail: "API unreachable — start it with: docker compose up -d",
      });
    }
    return mockRequest<T>(path, method, body);
  }

  // silent refresh once on 401 (AD-2)
  if (res.status === 401 && token && refreshFn && !path.includes("/auth/")) {
    const fresh = await refreshFn();
    if (fresh) {
      try {
        res = await doFetch(fresh);
      } catch {
        return mockRequest<T>(path, method, body);
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
    // 501/404 on a not-yet-built endpoint → serve the mock so UI keeps working
    if (
      res.status === 501 ||
      (res.status === 404 && !path.startsWith("/api/v1/auth"))
    ) {
      return mockRequest<T>(path, method, body);
    }
    throw new HttpError(res.status, (parsed as ApiError) ?? { detail: text });
  }

  return parsed as T;
}
