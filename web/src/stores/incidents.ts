"use client";
/**
 * Incidents store — list + filters + selected detail.
 * Data comes from the API with mock fallback (backend incidents endpoint TBD).
 */
import { create } from "zustand";
import { request } from "@/api/client";
import type { MockIncident } from "@/lib/mocks/fixtures";
import type { Paged } from "@/api/types";

interface IncidentsState {
  items: MockIncident[];
  total: number;
  selected: MockIncident | null;
  loading: boolean;
  error: string | null;
  filters: { category: string; severity: string; verification: string; phase: string };

  load: () => Promise<void>;
  loadOne: (id: string) => Promise<void>;
  setFilter: (key: keyof IncidentsState["filters"], value: string) => void;
}

export const useIncidents = create<IncidentsState>((set) => ({
  items: [],
  total: 0,
  selected: null,
  loading: false,
  error: null,
  filters: { category: "all", severity: "all", verification: "all", phase: "all" },

  async load() {
    set({ loading: true, error: null });
    try {
      const res = await request<Paged<MockIncident>>("/api/v1/incidents");
      set({ items: res.items, total: res.total, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load incidents",
      });
    }
  },

  async loadOne(id) {
    set({ loading: true, error: null, selected: null });
    try {
      const res = await request<MockIncident>(`/api/v1/incidents/${id}`);
      set({ selected: res, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load incident",
      });
    }
  },

  setFilter(key, value) {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
  },
}));

/** client-side filter applied on top of whatever the API returned */
export function applyFilters(items: MockIncident[], f: IncidentsState["filters"]) {
  return items.filter(
    (i) =>
      (f.category === "all" || i.category === f.category) &&
      (f.severity === "all" || i.severity === f.severity) &&
      (f.verification === "all" || i.verification === f.verification) &&
      (f.phase === "all" || i.response_phase === f.phase),
  );
}
