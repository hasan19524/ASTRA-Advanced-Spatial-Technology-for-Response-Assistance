"use client";
/**
 * Incidents store — list + filters + selected detail, backed by the real API
 * with mock fallback. Subscribes to the /ws/map channel so a fresh public
 * incident prepends itself onto the list (AD-10 / task 2).
 */
import { create } from "zustand";
import { request } from "@/api/client";
import { API_URL } from "@/lib/constants";
import type {
  IncidentDetailOut,
  IncidentOut,
  IncidentPageOut,
} from "@/api/types";

interface IncidentsState {
  items: IncidentOut[];
  total: number;
  selected: IncidentDetailOut | null;
  loading: boolean;
  error: string | null;
  filters: {
    category: string;
    assessment: string;
    verification: string;
    phase: string;
  };
  /** one WS connection shared by list + map pages */
  ws: WebSocket | null;

  load: (params?: {
    category?: string;
    assessment?: string;
    verification?: string;
    phase?: string;
    region?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  loadOne: (id: string) => Promise<void>;
  setFilter: (key: keyof IncidentsState["filters"], value: string) => void;
  /** open / close the live-map WS channel (token from useAuthSession) */
  connectWS: (token: string | null) => void;
  disconnectWS: () => void;
  /** prepend a WS-pushed incident into the list */
  prepend: (inc: IncidentOut) => void;
}

const EMPTY_FILTERS = {
  category: "all",
  assessment: "all",
  verification: "all",
  phase: "all",
};

export const useIncidents = create<IncidentsState>((set, get) => ({
  items: [],
  total: 0,
  selected: null,
  loading: false,
  error: null,
  filters: { ...EMPTY_FILTERS },
  ws: null,

  async load(params = {}) {
    const { category, assessment, verification, region, limit = 20, offset = 0 } = params;
    set({ loading: true, error: null });
    const search = new URLSearchParams();
    if (category && category !== "all") search.set("category", category);
    if (assessment && assessment !== "all") search.set("assessment", assessment);
    if (verification && verification !== "all") search.set("verification", verification);
    if (region && region !== "all") search.set("region", region);
    search.set("limit", String(limit));
    search.set("offset", String(offset));
    try {
      const res = await request<IncidentPageOut>(
        `/api/v1/incidents?${search.toString()}`,
      );
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
      const res = await request<IncidentDetailOut>(`/api/v1/incidents/${id}`);
      set({ selected: res, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load incident",
        selected: null,
      });
    }
  },

  setFilter(key, value) {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
  },

  connectWS(token) {
    const { ws } = get();
    if (ws) return; // one connection only
    if (!token) return;
    const wsUrl = API_URL.replace(/^http/, "ws").replace(/\/$/, "") + `/ws/map?token=${token}`;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      // connection envelope arrives automatically from the server
    };
    socket.onmessage = (ev) => {
      let parsed: { channel: string; type: string; data: IncidentOut };
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (parsed.channel !== "incidents:map") return;
      if (parsed.type === "incident.created" && parsed.data) {
        get().prepend(parsed.data);
      }
    };
    socket.onerror = () => {
      // WS is a live enhancement; never fail a page because of it
    };
    socket.onclose = () => {
      set({ ws: null });
    };
    set({ ws: socket });
  },

  disconnectWS() {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null });
    }
  },

  prepend(inc) {
    set((s) => {
      if (s.items.some((i) => i.id === inc.id)) return s;
      return {
        items: [inc, ...s.items],
        total: s.total + 1,
      };
    });
  },
}));
