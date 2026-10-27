"use client";
/**
 * Auth API (task 2.1) — thin wrappers over the real FastAPI auth endpoints.
 * Logic lives in useAuth; these functions only speak HTTP.
 */
import { request } from "@/api/client";
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserOut,
} from "./types";

export const authApi = {
  login: (payload: LoginRequest) =>
    request<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: payload,
    }),

  register: (payload: RegisterRequest) =>
    request<TokenResponse>("/api/v1/auth/register", {
      method: "POST",
      body: payload,
    }),

  refresh: (refresh_token: string) =>
    request<TokenResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: { refresh_token },
    }),

  me: (token: string) => request<UserOut>("/api/v1/auth/me", { token }),

  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
};
