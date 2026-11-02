"use client";
/**
 * Alerts store — toast queue + subscribed alert feeds backed by the real API.
 * Endpoints (contracts/openapi.json):
 *   GET    /api/v1/alerts                 -> AlertOut[]
 *   POST   /api/v1/alerts                 -> AlertOut (201)
 *   GET    /api/v1/alerts/preferences     -> AlertPrefOut[]
 *   POST   /api/v1/alerts/preferences     -> AlertPrefOut (201)
 *   DELETE /api/v1/alerts/preferences/{id}-> 204
 * WS /ws/alerts is not built yet (Day 8+) — connectWs() is an honest no-op
 * that never increments unread while the socket is down.
 */
import { create } from "zustand";
import { request } from "@/api/client";
import type { AlertCreateIn, AlertOut, AlertPrefIn, AlertPrefOut } from "@/api/openapi-types";

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warning" | "critical";
  at: number;
}

interface AlertsState {
  // toast queue (existing)
  toasts: ToastItem[];
  // real alert feed (NEW)
  items: AlertOut[];
  prefs: AlertPrefOut[];
  loading: boolean;
  error: string | null;
  wsStatus: "connected" | "reconnecting" | "offline" | null;
  unread: number;

  toast: (t: Omit<ToastItem, "id" | "at">) => void;
  dismiss: (id: string) => void;
  markRead: () => void;
  load: (token?: string | null) => Promise<void>;
  loadPrefs: (token?: string | null) => Promise<void>;
  createAlert: (payload: AlertCreateIn, token?: string | null) => Promise<AlertOut | null>;
  upsertPref: (payload: AlertPrefIn, token?: string | null) => Promise<AlertPrefOut | null>;
  deletePref: (id: string, token?: string | null) => Promise<void>;
  connectWs: () => void;
  unsubscribe: (region: string) => void;
}

export interface AlertItem {
  id: string;
  event: string;
  severity: string;
  area: string;
  onset: string;
}

let seq = 0;

export const useAlerts = create<AlertsState>((set) => ({
  toasts: [],
  items: [],
  prefs: [],
  loading: false,
  error: null,
  wsStatus: null,
  unread: 0,

  toast(t) {
    const id = `t${++seq}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id, at: Date.now() }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 5000);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markRead: () => set({ unread: 0 }),

  async load(token) {
    set({ loading: true, error: null });
    try {
      const items = await request<AlertOut[]>("/api/v1/alerts", { token });
      set({ items, unread: items.length, loading: false, error: null, wsStatus: "offline" });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load alerts",
        wsStatus: "offline",
      });
    }
  },

  async loadPrefs(token) {
    set({ error: null });
    try {
      const prefs = await request<AlertPrefOut[]>("/api/v1/alerts/preferences", { token });
      set({ prefs });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load alert preferences" });
    }
  },

  async createAlert(payload, token) {
    set({ error: null });
    try {
      const created = await request<AlertOut>("/api/v1/alerts", {
        method: "POST",
        body: payload,
        token,
      });
      set((s) => ({ items: [created, ...s.items], unread: s.items.length + 1 }));
      return created;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to create alert" });
      return null;
    }
  },

  async upsertPref(payload, token) {
    set({ error: null });
    try {
      const pref = await request<AlertPrefOut>("/api/v1/alerts/preferences", {
        method: "POST",
        body: payload,
        token,
      });
      set((s) => {
        const exists = s.prefs.find((p) => p.region === payload.region && p.category === payload.category);
        const updated = exists
          ? s.prefs.map((p) => (p.region === payload.region && p.category === payload.category ? pref : p))
          : [...s.prefs, pref];
        return { prefs: updated };
      });
      return pref;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to save alert preference" });
      return null;
    }
  },

  async deletePref(id, token) {
    set({ error: null });
    try {
      await request<never>(`/api/v1/alerts/preferences/${id}`, { method: "DELETE", token });
      set((s) => ({ prefs: s.prefs.filter((p) => p.id !== id) }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to delete alert preference" });
    }
  },

  connectWs() {
    // WS /ws/alerts not built yet — honest offline state, never inflate unread.
    set({ wsStatus: "offline" });
  },

  unsubscribe(region) {
    set((s) => ({ prefs: s.prefs.filter((p) => p.region !== region) }));
  },
}));
