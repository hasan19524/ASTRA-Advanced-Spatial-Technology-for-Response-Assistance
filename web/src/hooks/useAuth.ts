"use client";
/**
 * useAuth hook (task 2.1) — the one entry point pages use for auth state.
 * Handles the AD-2 silent refresh on first mount (access token is memory-only).
 */
import { useEffect } from "react";
import { useAuth } from "@/stores/auth";
import { hasPermission } from "@/lib/permissions";

export function useAuthSession() {
  const {
    user,
    accessToken,
    status,
    error,
    hydrated,
    login,
    register,
    demoLogin,
    logout,
    refresh,
    clearError,
  } = useAuth();

  // first mount: try silent refresh from the persisted refresh token
  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  const can = (permission: string) => hasPermission(user?.permissions, permission);

  return {
    user,
    token: accessToken,
    isLoading: status === "loading",
    isAuthenticated: !!user && !!accessToken,
    error,
    hydrated,
    can,
    login,
    register,
    demoLogin,
    logout,
    clearError,
  };
}
