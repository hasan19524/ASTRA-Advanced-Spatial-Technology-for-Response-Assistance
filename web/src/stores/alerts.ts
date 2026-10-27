"use client";
/** Alerts store — toast queue + subscribed alert feeds (WS /ws/alerts later). */
import { create } from "zustand";

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warning" | "critical";
  at: number;
}

export interface AlertItem {
  id: string;
  event: string;
  severity: string;
  area: string;
  onset: string;
}

interface AlertsState {
  toasts: ToastItem[];
  alerts: AlertItem[];
  unread: number;

  toast: (t: Omit<ToastItem, "id" | "at">) => void;
  dismiss: (id: string) => void;
  setAlerts: (a: AlertItem[]) => void;
  markRead: () => void;
}

let seq = 0;

export const useAlerts = create<AlertsState>((set) => ({
  toasts: [],
  alerts: [],
  unread: 0,

  toast(t) {
    const id = `t${++seq}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id, at: Date.now() }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 5000);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setAlerts: (alerts) => set({ alerts, unread: alerts.length }),
  markRead: () => set({ unread: 0 }),
}));
