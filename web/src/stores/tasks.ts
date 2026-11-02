"use client";
/**
 * Tasks store — dispatch tasks for an incident, backed by the real API.
 * Endpoints (contracts/openapi.json):
 *   GET    /api/v1/incidents/{id}/tasks   -> TaskOut[]
 *   POST   /api/v1/incidents/{id}/tasks   -> TaskOut (201)
 *   PATCH  /api/v1/tasks/{id}             -> TaskOut
 *   POST   /api/v1/tasks/{id}/updates     -> TaskUpdateOut (201)
 */
import { create } from "zustand";
import { request } from "@/api/client";
import type {
  TaskCreateIn,
  TaskOut,
  TaskPatchIn,
  TaskUpdateIn,
  TaskUpdateOut,
} from "@/api/openapi-types";

interface TasksState {
  items: TaskOut[];
  total: number;
  loading: boolean;
  error: string | null;
  loadByIncident: (id: string, token?: string | null) => Promise<void>;
  create: (incidentId: string, payload: TaskCreateIn, token?: string | null) => Promise<TaskOut | null>;
  patch: (id: string, payload: TaskPatchIn, token?: string | null) => Promise<TaskOut | null>;
  addUpdate: (id: string, payload: TaskUpdateIn, token?: string | null) => Promise<TaskUpdateOut | null>;
}

export const useTasks = create<TasksState>((set) => ({
  items: [],
  total: 0,
  loading: false,
  error: null,

  async loadByIncident(id, token) {
    set({ loading: true, error: null });
    try {
      const items = await request<TaskOut[]>(`/api/v1/incidents/${id}/tasks`, { token });
      set({ items, total: items.length, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load tasks",
      });
    }
  },

  async create(incidentId, payload, token) {
    set({ loading: true, error: null });
    try {
      const created = await request<TaskOut>(
        `/api/v1/incidents/${incidentId}/tasks`,
        { method: "POST", body: payload, token },
      );
      set((s) => ({
        items: [created, ...s.items],
        total: s.total + 1,
        loading: false,
        error: null,
      }));
      return created;
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to create task" });
      return null;
    }
  },

  async patch(id, payload, token) {
    set({ loading: true, error: null });
    try {
      const updated = await request<TaskOut>(`/api/v1/tasks/${id}`, {
        method: "PATCH",
        body: payload,
        token,
      });
      set((s) => ({
        items: s.items.map((t) => (t.id === id ? updated : t)),
        loading: false,
        error: null,
      }));
      return updated;
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to update task" });
      return null;
    }
  },

  async addUpdate(id, payload, token) {
    set({ loading: true, error: null });
    try {
      const update = await request<TaskUpdateOut>(
        `/api/v1/tasks/${id}/updates`,
        { method: "POST", body: payload, token },
      );
      set({ loading: false, error: null });
      return update;
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to add update" });
      return null;
    }
  },
}));
