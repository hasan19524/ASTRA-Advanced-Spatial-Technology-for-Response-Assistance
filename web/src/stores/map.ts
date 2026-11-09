"use client";
/** Map store — viewport, visible layers, selected pin (Leaflet comes later). */
import { create } from "zustand";

interface MapState {
  /** Delhi NCR centre (AD-13) */
  center: [number, number];
  layers: { incidents: boolean; teams: boolean; routes: boolean; closures: boolean; traffic: boolean };
  selectedIncidentId: string | null;
  live: boolean;

  toggleLayer: (key: keyof MapState["layers"]) => void;
  select: (id: string | null) => void;
  setLive: (v: boolean) => void;
}

export const useMap = create<MapState>((set) => ({
  center: [28.6139, 77.209], // New Delhi
  layers: { incidents: true, teams: true, routes: true, closures: false, traffic: false },
  selectedIncidentId: null,
  live: true,

  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  select: (id) => set({ selectedIncidentId: id }),
  setLive: (live) => set({ live }),
}));
