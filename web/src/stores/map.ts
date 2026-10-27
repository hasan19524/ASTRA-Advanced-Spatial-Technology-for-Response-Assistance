"use client";
/** Map store — viewport, visible layers, selected pin (Leaflet comes later). */
import { create } from "zustand";

interface MapState {
  /** Delhi NCR centre (AD-13) */
  center: [number, number];
  zoom: number;
  layers: { incidents: boolean; teams: boolean; routes: boolean; closures: boolean };
  selectedIncidentId: string | null;
  live: boolean;

  setCenter: (c: [number, number]) => void;
  setZoom: (z: number) => void;
  toggleLayer: (key: keyof MapState["layers"]) => void;
  select: (id: string | null) => void;
  setLive: (v: boolean) => void;
}

export const useMap = create<MapState>((set) => ({
  center: [28.6139, 77.209], // New Delhi
  zoom: 11,
  layers: { incidents: true, teams: true, routes: true, closures: false },
  selectedIncidentId: null,
  live: true,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  select: (id) => set({ selectedIncidentId: id }),
  setLive: (live) => set({ live }),
}));
