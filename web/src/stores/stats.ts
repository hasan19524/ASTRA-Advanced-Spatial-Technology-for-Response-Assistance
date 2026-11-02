"use client";
/**
 * Stats store — dashboard KPIs from the real GET /api/v1/stats/overview.
 * Never falls back to fixtures: a 404/5xx surfaces UnavailableState on the page.
 */
import { create } from "zustand";
import { request } from "@/api/client";
import type { StatsOut } from "@/api/openapi-types";

export interface Async<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface StatsState {
  stats: Async<StatsOut>;
  load: (token?: string | null) => Promise<void>;
}

export const useStats = create<StatsState>((set) => ({
  stats: { data: null, loading: false, error: null },

  async load(token) {
    set((s) => ({ stats: { ...s.stats, loading: true, error: null } }));
    try {
      const data = await request<StatsOut>("/api/v1/stats/overview", { token });
      set({ stats: { data, loading: false, error: null } });
    } catch (e) {
      set({
        stats: {
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : "Stats unavailable",
        },
      });
    }
  },
}));
