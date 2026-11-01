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
  /** live-feed socket state: connected | reconnecting | offline | null */
  wsStatus: "connected" | "reconnecting" | "offline" | null;
  /** backoff counter for exponential reconnect */
  wsReconnectAttempts: number;
  /** latest token used for the WS connection */
  wsToken: string | null;

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
  loadVerificationQueue: (params?: {
    assessment?: string;
    min_age_minutes?: string;
    urgency?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  setFilter: (key: keyof IncidentsState["filters"], value: string) => void;
  /** open / close the live-map WS channel (token from useAuthSession) */
  connectWS: (token: string | null) => void;
  disconnectWS: () => void;
  /** internal: schedule a WS reconnect with exponential backoff */
  scheduleReconnect: () => void;
  /** prepend a WS-pushed incident into the list */
  prepend: (inc: IncidentOut) => void;
  /** replace an existing incident in the list (incident.updated envelope) */
  replace: (inc: IncidentOut) => void;
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
  wsStatus: null,
  wsReconnectAttempts: 0,
  wsToken: null,

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

  async loadVerificationQueue(params?: {
    assessment?: string;
    min_age_minutes?: string;
    urgency?: string;
    limit?: number;
    offset?: number;
  }) {
    const { assessment, min_age_minutes, urgency, limit = 20, offset = 0 } = params ?? {};
    set({ loading: true, error: null });
    const search = new URLSearchParams();
    if (assessment && assessment !== "all") search.set("assessment", assessment);
    if (min_age_minutes && min_age_minutes !== "all") search.set("min_age_minutes", min_age_minutes);
    if (urgency && urgency !== "all") search.set("urgency", urgency);
    search.set("limit", String(limit));
    search.set("offset", String(offset));
    try {
      const res = await request<IncidentPageOut>(
        `/api/v1/verification/queue?${search.toString()}`,
      );
      set({ items: res.items, total: res.total, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load verification queue",
      });
    }
  },

  setFilter(key, value) {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
  },

  connectWS(token) {
    const { ws, wsToken } = get();
    if (ws) return; // one connection only
    if (!token) return;
    // don't reconnect with the same token after a 4401 close
    if (wsToken === token && get().wsStatus === "offline") return;

    set({ wsStatus: "reconnecting", wsToken: token });
    const wsUrl = API_URL.replace(/^http/, "ws").replace(/\/$/, "") + `/ws/map?token=${token}`;
    const socket = new WebSocket(wsUrl);

    const clear = () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
    };

    socket.onopen = () => {
      set({ wsStatus: "connected", wsReconnectAttempts: 0 });
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
      if (parsed.type === "incident.updated" && parsed.data) {
        get().replace(parsed.data);
      }
    };

    socket.onerror = () => {
      // WS is a live enhancement; never fail a page because of it
    };

    socket.onclose = (event) => {
      clear();
      set((s) => (s.ws === socket ? { ws: null } : s));
      // 4401 = unauthorized → wait for a fresh token before retrying
      if (event.code === 4401) {
        set({ wsStatus: "offline", wsReconnectAttempts: 0 });
        return;
      }
      // otherwise exponential backoff reconnect (cap ~30s)
      get().scheduleReconnect();
    };

    set({ ws: socket });
  },

  disconnectWS() {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, wsStatus: "offline", wsReconnectAttempts: 0 });
    }
  },

  scheduleReconnect() {
    const { wsReconnectAttempts, wsToken, ws } = get();
    if (!wsToken || ws) return; // no token or already connected
    const attempts = wsReconnectAttempts + 1;
    const delayMs = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
    set({ wsStatus: "reconnecting", wsReconnectAttempts: attempts });
    setTimeout(() => {
      const current = get();
      if (current.wsStatus === "reconnecting" && current.wsToken) {
        current.connectWS(current.wsToken);
      }
    }, delayMs);
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

  replace(inc) {
    set((s) => ({
      items: s.items.map((i) => (i.id === inc.id ? inc : i)),
    }));
  },
}));
