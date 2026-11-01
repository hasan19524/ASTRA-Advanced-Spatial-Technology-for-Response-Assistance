/**
 * Auth store — AD-2: access token IN MEMORY (this store), refresh token in localStorage.
 * On reload the access token is gone → silent refresh via POST /auth/refresh
 * before the first API call (registered with setRefreshHandler).
 */
"use client";

import { create } from "zustand";
import { request, setRefreshHandler } from "@/api/client";
import type { LoginRequest, RegisterRequest, TokenResponse, UserOut } from "@/api/types";
import { DEMO_EMAILS, type Role } from "@/lib/constants";

const REFRESH_KEY = "astra.refresh_token";

interface AuthState {
  user: UserOut | null;
  accessToken: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
  /** true once the initial silent-refresh attempt has finished */
  hydrated: boolean;

  login: (payload: LoginRequest) => Promise<boolean>;
  register: (payload: RegisterRequest) => Promise<boolean>;
  /** one-click demo login: tries real API, falls back to a mock session */
  demoLogin: (role: string) => Promise<boolean>;
  logout: () => void;
  /** silent refresh — called on mount and on 401 (via client.ts) */
  refresh: () => Promise<string | null>;
  clearError: () => void;
}

function persistRefresh(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

function readRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  error: null,
  hydrated: false,

  async login(payload) {
    set({ status: "loading", error: null });
    try {
      const res = await request<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        body: payload,
      });
      persistRefresh(res.refresh_token);
      set({ user: res.user, accessToken: res.access_token, status: "authenticated" });
      return true;
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Login failed",
      });
      return false;
    }
  },

  async register(payload) {
    set({ status: "loading", error: null });
    try {
      const res = await request<TokenResponse>("/api/v1/auth/register", {
        method: "POST",
        body: payload,
      });
      persistRefresh(res.refresh_token);
      set({ user: res.user, accessToken: res.access_token, status: "authenticated" });
      return true;
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Registration failed",
      });
      return false;
    }
  },

  /** one-click demo login: POST /api/v1/auth/demo-login {email} (no client password) */
  async demoLogin(role) {
    set({ status: "loading", error: null });
    const email = DEMO_EMAILS[role as Role] ?? `${role.toLowerCase().replace(/_/g, ".")}@astra.dev`;
    try {
      const res = await request<TokenResponse>("/api/v1/auth/demo-login", {
        method: "POST",
        body: { email },
      });
      persistRefresh(res.refresh_token);
      set({ user: res.user, accessToken: res.access_token, status: "authenticated" });
      return true;
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Demo login failed — is the backend up?",
      });
      return false;
    }
  },

  logout() {
    persistRefresh(null);
    set({ user: null, accessToken: null, status: "idle", error: null });
  },

  async refresh() {
    const rt = readRefresh();
    if (!rt) {
      set({ hydrated: true });
      return null;
    }
    try {
      const res = await request<TokenResponse>("/api/v1/auth/refresh", {
        method: "POST",
        body: { refresh_token: rt },
      });
      persistRefresh(res.refresh_token);
      set({
        user: res.user,
        accessToken: res.access_token,
        status: "authenticated",
        hydrated: true,
      });
      return res.access_token;
    } catch {
      persistRefresh(null);
      set({ user: null, accessToken: null, status: "idle", hydrated: true });
      return null;
    }
  },

  clearError() {
    set({ error: null });
  },
}));

// wire silent refresh into the fetch client (avoids circular import)
setRefreshHandler(() => useAuth.getState().refresh());
