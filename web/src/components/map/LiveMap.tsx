"use client";
/**
 * LiveMap — the real operational map.
 *
 * This replaces the old `MapPlaceholder`, which drew coloured dots on a
 * CSS gradient and pretended to be a map. That was the single biggest
 * honesty problem in the product: the screen was called "Live Operations
 * Map" and could not pan, zoom, route or geocode.
 *
 * What is real here:
 *   * the basemap is real OpenStreetMap / CARTO raster tiles;
 *   * every pin is a real incident row from GET /api/v1/incidents;
 *   * the route polyline is the real Dijkstra path over the seeded OSM
 *     graph (879,902 edges) and is drawn from the node coordinates the
 *     API returns;
 *   * the closures layer is the real `routing_edges.is_closed` set;
 *   * "locate me" uses the browser's own geolocation.
 *
 * What is NOT here, and says so in the UI: live traffic (Phase 7 needs a
 * TomTom key) and response-team GPS (no field exists on a user — a layer
 * that pretended otherwise would be a lie).
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as LeafletMap, LayerGroup, Marker, Polyline } from "leaflet";
import type { IncidentOut } from "@/api/types";

export interface RouteGeometry {
  /** [[lat, lon], …] along the routed path. */
  coords: [number, number][];
  distanceSeconds: number;
  nodeCount: number;
}

export interface ClosureSegment {
  id: string;
  name: string | null;
  from_coords: [number, number] | null;
  to_coords: [number, number] | null;
}

interface LiveMapProps {
  incidents: IncidentOut[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  route: RouteGeometry | null;
  closures: ClosureSegment[];
  showIncidents: boolean;
  showRoute: boolean;
  showClosures: boolean;
  /** Hide the basemap theme switcher (the dashboard card is too small for it). */
  showBasemapSwitcher?: boolean;
  className?: string;
}

/** Pin colour keys off the verification status (AD-9 / vision §C):
 *  UNVERIFIED amber · VERIFIED green · REJECTED grey. */
const VERIFICATION_COLOR: Record<string, string> = {
  UNVERIFIED: "#f59e0b",
  VERIFIED: "#22c55e",
  REJECTED: "#9ca3af",
  RESTRICTED: "#a855f7",
};

/**
 * Basemaps.
 *
 * The raster tiles come from the public OpenStreetMap tile server, which
 * needs no API key and is the licence-compatible choice for a deployed
 * app. CARTO's `basemaps.cartocdn.com` now answers every request with an
 * "API KEY REQUIRED" placeholder, so it is not used here.
 *
 * The "dark" layer is the SAME real OSM tiles with a CSS filter — no
 * second provider, no key, no broken tile. The attribution stays visible
 * because OSM requires it.
 */
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type BasemapKey = "dark" | "street";

/** NCR bounds — used to clamp the "fit to incidents" view. */
const NCR_BOUNDS: [[number, number], [number, number]] = [
  [28.35, 76.85],
  [28.85, 77.55],
];

/** Imperative controls the parent page can trigger. */
export interface MapActions {
  fitToIncidents: () => void;
  locate: () => void;
  clearError: () => void;
}

const LiveMap = forwardRef<MapActions, LiveMapProps>(function LiveMap(
  {
    incidents,
    selectedId,
    onSelect,
    route,
    closures,
    showIncidents,
    showRoute,
    showClosures,
    showBasemapSwitcher = true,
    className = "",
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const incidentLayerRef = useRef<LayerGroup | null>(null);
  const closureLayerRef = useRef<LayerGroup | null>(null);
  const routeLayerRef = useRef<Polyline | null>(null);
  const markerIndexRef = useRef<Map<string, Marker>>(new Map());
  const [basemap, setBasemap] = useState<BasemapKey>("dark");
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Leaflet touches `window` at import time, so it must only ever be
  // imported inside the browser. A dynamic import inside the effect keeps
  // it out of the server bundle and out of the module graph entirely.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    // Captured here (not read from the ref in the cleanup) so the lint rule
    // can see the value is stable for the lifetime of this effect.
    const markers = markerIndexRef.current;

    async function boot() {
      if (!containerRef.current) return;
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;

        map = L.map(containerRef.current, {
          center: [28.6139, 77.209],
          zoom: 11,
          zoomControl: false,
          attributionControl: true,
          maxBounds: L.latLngBounds(NCR_BOUNDS).pad(0.35),
        });

        L.tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "topright" }).addTo(map);

        incidentLayerRef.current = L.layerGroup().addTo(map);
        closureLayerRef.current = L.layerGroup().addTo(map);

        mapRef.current = map;
        setReady(true);
        setMapError(null);
      } catch (e) {
        if (!cancelled) {
          setMapError(
            e instanceof Error
              ? `Map failed to load: ${e.message}`
              : "Map failed to load.",
          );
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      incidentLayerRef.current = null;
      closureLayerRef.current = null;
      routeLayerRef.current = null;
      markers.clear();
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  // Toggle the dark treatment of the (unchanged) real OSM tiles.
  // A data attribute, not a class: Tailwind's class parser reads a `--`
  // suffix as a variant and drops the rule.
  useEffect(() => {
    if (!ready) return;
    const el = containerRef.current;
    if (!el) return;
    el.dataset.basemap = basemap;
  }, [basemap, ready]);

  // Incident pins. Rebuilt when the incident set or the visibility flag
  // changes; the selected pin is drawn larger so it stays visible.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const group = incidentLayerRef.current;
      if (!group) return;
      group.clearLayers();
      markerIndexRef.current.clear();

      if (!showIncidents) return;

      for (const inc of incidents) {
        const color =
          VERIFICATION_COLOR[inc.verification] ?? VERIFICATION_COLOR.UNVERIFIED;
        const selected = inc.id === selectedId;
        const icon = L.divIcon({
          className: "astra-pin-wrap",
          html: `<span class="astra-pin" style="background:${color};${
            selected ? "transform:translate(-50%,-50%) scale(1.4);z-index:60;" : ""
          }"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([inc.latitude, inc.longitude], {
          icon,
          keyboard: true,
          title: inc.title,
          alt: inc.title,
          zIndexOffset: selected ? 1000 : 0,
        });
        // The incident id lives on the marker element as a data attribute:
        // the `title` attribute carries the human-readable incident title
        // (it is the marker's accessible name), and the id is what the
        // browser tests and the WebSocket fan-out match on.
        marker.on("add", () => {
          marker.getElement()?.setAttribute("data-incident-id", inc.id);
        });
        marker.on("click", () => onSelect(inc.id));
        // Built as DOM nodes, not an HTML string — incident titles come
        // from the public and must never be interpolated into markup.
        const tip = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = inc.category;
        const span = document.createElement("span");
        span.textContent = inc.location_text ?? inc.region ?? "Delhi NCR";
        tip.append(strong, document.createElement("br"), span);
        marker.bindTooltip(tip, { direction: "top", offset: [0, -8] });
        marker.addTo(group);
        markerIndexRef.current.set(inc.id, marker);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incidents, ready, selectedId, showIncidents, onSelect]);

  // The route polyline.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) return;
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      if (!showRoute || !route || route.coords.length < 2) return;

      const line = L.polyline(route.coords, {
        color: "#38bdf8",
        weight: 4,
        opacity: 0.9,
        lineJoin: "round",
      }).addTo(map);
      routeLayerRef.current = line;
      map.fitBounds(line.getBounds(), { padding: [48, 48], maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
    };
  }, [route, ready, showRoute]);

  // Closed-road segments.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const group = closureLayerRef.current;
      if (!group) return;
      group.clearLayers();
      if (!showClosures) return;
      for (const c of closures) {
        if (!c.from_coords || !c.to_coords) continue;
        const tip = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = "Closed";
        const span = document.createElement("span");
        span.textContent = c.name ?? "Unnamed road";
        tip.append(strong, document.createElement("br"), span);
        L.polyline([c.from_coords, c.to_coords], {
          color: "#ef4444",
          weight: 6,
          opacity: 0.85,
          dashArray: "6 8",
        })
          .bindTooltip(tip)
          .addTo(group);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [closures, ready, showClosures]);

  // Pan to the selected pin.
  useEffect(() => {
    if (!ready || !selectedId) return;
    const marker = markerIndexRef.current.get(selectedId);
    const map = mapRef.current;
    if (!marker || !map) return;
    map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 });
  }, [selectedId, ready]);

  const actions = useMemo<MapActions>(
    () => ({
      fitToIncidents: () => {
        const map = mapRef.current;
        if (!map || incidents.length === 0) return;
        void (async () => {
          const L = await import("leaflet");
          const bounds = L.latLngBounds(
            incidents.map((i) => [i.latitude, i.longitude] as [number, number]),
          );
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        })();
      },
      locate: () => {
        const map = mapRef.current;
        if (!map) return;
        if (!navigator.geolocation) {
          setMapError("This browser has no geolocation API.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 14);
            void (async () => {
              const L = await import("leaflet");
              const marker = L.marker(
                [pos.coords.latitude, pos.coords.longitude],
                {
                  icon: L.divIcon({
                    className: "astra-pin-wrap",
                    html: '<span class="astra-pin astra-pin--me"></span>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                  }),
                },
              ).addTo(map);
              marker.bindTooltip("You are here").openTooltip();
            })();
          },
          (err) => {
            setMapError(
              err.code === err.PERMISSION_DENIED
                ? "Location permission denied — the map still works, but it cannot centre on you."
                : `Could not get your location: ${err.message}`,
            );
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      },
      clearError: () => setMapError(null),
    }),
    [incidents],
  );

  // Expose the actions to the parent through the imperative handle.
  useImperativeHandle(ref, () => actions, [actions]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="astra-map h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-3)]"
        role="application"
        aria-label="Operational map of Delhi NCR"
      />

      {!ready && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--surface)]/80 text-xs text-[var(--muted)]">
          Loading the operational map…
        </div>
      )}

      {mapError && (
        <div
          role="alert"
          className="absolute left-1/2 top-3 z-[700] w-[min(92%,420px)] -translate-x-1/2 rounded-lg border border-[var(--danger)]/50 bg-[var(--surface)] px-3 py-2 text-[11px] text-[#fecaca] shadow-lg"
        >
          {mapError}
          <button
            type="button"
            onClick={() => setMapError(null)}
            className="ml-2 underline"
          >
            dismiss
          </button>
        </div>
      )}

      {/* basemap switcher */}
      {showBasemapSwitcher && (
        <div className="absolute bottom-2 left-2 z-[500] flex overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface)]/95">
          {(["dark", "street"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              aria-pressed={basemap === key}
              className={`min-h-10 px-3 py-2 text-[10px] font-semibold capitalize transition-colors ${
                basemap === key
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {key === "street" ? "street" : "dark"}
            </button>
          ))}
        </div>
      )}

      <div className="absolute right-2 bottom-2 z-[500] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => actions.fitToIncidents()}
          disabled={incidents.length === 0}
          title="Fit the map to every visible incident"
          className="min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)]/95 px-3 py-2 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40"
        >
          Fit
        </button>
        <button
          type="button"
          onClick={() => actions.locate()}
          title="Centre the map on your location"
          className="min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)]/95 px-3 py-2 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Locate me
        </button>
      </div>
    </div>
  );
});

export default LiveMap;
