"use client";
/**
 * Live Operations Map — the real map.
 *
 * Everything on this screen comes from the backend:
 *   * incident pins  → GET /api/v1/incidents (live over /ws/map)
 *   * route polyline → GET /api/v1/route (Dijkstra over the seeded OSM
 *     graph: 406,154 nodes / 879,902 edges)
 *   * geocoding      → GET /api/v1/geocode/search (Nominatim)
 *   * closures       → GET /api/v1/route/closures (real `is_closed` rows)
 *
 * The old screen drew coloured dots on a CSS gradient and called itself a
 * map. It could not pan, zoom, geocode or route. This one can.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import LiveMap, {
  type ClosureSegment,
  type MapActions,
  type RouteGeometry,
} from "@/components/map/LiveMap";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMap } from "@/stores/map";
import { useIncidents } from "@/stores/incidents";
import { useAuthSession } from "@/hooks/useAuth";
import { request } from "@/api/client";

interface GeoResult {
  display_name: string;
  lat: number;
  lon: number;
  node_id?: string;
}

export default function LiveMapPage() {
  const router = useRouter();
  const { selectedIncidentId, select, layers, toggleLayer, live, setLive, center } =
    useMap();
  const {
    items,
    total: incidentTotal,
    load,
    connectWS,
    disconnectWS,
  } = useIncidents();

  const { token, hydrated } = useAuthSession();

  const [routeFrom, setRouteFrom] = useState<string>("");
  const [routeTo, setRouteTo] = useState<string>("");
  const [route, setRoute] = useState<RouteGeometry | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [snapNote, setSnapNote] = useState<string | null>(null);

  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [trafficData, setTrafficData] = useState<{
    current_speed_kmh: number | null;
    free_flow_speed_kmh: number | null;
    congestion_ratio: number | null;
    road_name: string;
    available: boolean;
  } | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const fetchTraffic = useCallback(async () => {
    setTrafficLoading(true);
    try {
      const res = await request<{ available: boolean; current_speed_kmh: number | null; free_flow_speed_kmh: number | null; congestion_ratio: number | null; road_name: string }>(`/api/v1/traffic/flow?lat=${center[0]}&lon=${center[1]}`, { token });
      setTrafficData(res);
    } catch {
      setTrafficData({ available: false, current_speed_kmh: null, free_flow_speed_kmh: null, congestion_ratio: null, road_name: '' });
    } finally {
      setTrafficLoading(false);
    }
  }, [center, token]);
  const [geoLoading, setGeoLoading] = useState(false);

  const [closures, setClosures] = useState<ClosureSegment[]>([]);
  const [locations, setLocations] = useState<
    { id: string; name: string | null }[]
  >([]);

  useEffect(() => {
    if (!hydrated) return;
    // The map shows every incident the caller may see, not the first page
    // of 20 the list screen uses. 500 is the API's hard cap.
    void load({ limit: 500 }, token);
  }, [load, token, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    connectWS(token);
    return () => disconnectWS();
  }, [connectWS, disconnectWS, token, hydrated]);

  // Closed roads — a real query against `routing_edges.is_closed`.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await request<ClosureSegment[]>(
          "/api/v1/route/closures?limit=300",
          { token },
        );
        if (!cancelled) setClosures(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setClosures([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  // Named junctions for the route pickers.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await request<{ id: string; name: string | null }[]>(
          "/api/v1/route/locations?limit=300",
          { token },
        );
        if (!cancelled) setLocations(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setLocations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hydrated]);

  const runRoute = useCallback(async () => {
    if (!routeFrom || !routeTo || routeFrom === routeTo) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const res = await request<{
        distance_seconds: number;
        path: string[];
        path_coords: [number, number][];
      }>(`/api/v1/route?from_id=${routeFrom}&to_id=${routeTo}`, { token });
      setRoute({
        coords: res.path_coords ?? [],
        distanceSeconds: res.distance_seconds,
        nodeCount: res.path?.length ?? 0,
      });
    } catch (e) {
      setRoute(null);
      setRouteError(
        e instanceof Error ? e.message : "Could not compute a route.",
      );
    } finally {
      setRouteLoading(false);
    }
  }, [routeFrom, routeTo, token]);

  const runGeocode = useCallback(async () => {
    if (!geoQuery.trim()) return;
    setGeoLoading(true);
    setGeoError(null);
    try {
      const res = await request<GeoResult[]>(
        "/api/v1/geocode/search?q=" + encodeURIComponent(geoQuery),
        { token },
      );
      setGeoResults(Array.isArray(res) ? res : []);
      if (!Array.isArray(res) || res.length === 0) {
        setGeoError("No place matched that search.");
      }
    } catch (e) {
      setGeoResults([]);
      setGeoError(
        e instanceof Error ? e.message : "Place search is unavailable.",
      );
    } finally {
      setGeoLoading(false);
    }
  }, [geoQuery, token]);

  /** Route from a geocoded place to the selected incident — the real
   *  dispatch flow: "how do we get a unit from there to here?". */
  const routeToIncident = useCallback(
    async (place: GeoResult) => {
      const incident = items.find((i) => i.id === selectedIncidentId);
      if (!incident) return;
      setRouteLoading(true);
      setRouteError(null);
      setSnapNote(null);
      try {
        // Snap both ends to the nearest routable junction, then route.
        const [from, to] = await Promise.all([
          request<{ id: string; distance_m: number }>(
            `/api/v1/route/nearest?latitude=${place.lat}&longitude=${place.lon}`,
            { token },
          ),
          request<{ id: string; distance_m: number }>(
            `/api/v1/route/nearest?latitude=${incident.latitude}&longitude=${incident.longitude}`,
            { token },
          ),
        ]);
        // The graph covers the seeded Delhi-NCR bbox. A place outside it
        // (or a fragment OSM does not link) snaps to the closest covered
        // junction — sometimes kilometres away. Say so instead of
        // pretending the route starts at the exact point.
        const worst = Math.max(from.distance_m ?? 0, to.distance_m ?? 0);
        if (worst > 500) {
          setSnapNote(
            `Snapped to the nearest routable junction (${Math.round(worst)} m away). ` +
              `The road network covers the seeded Delhi-NCR bbox; points outside it ` +
              `are not on the graph.`,
          );
        }
        const res = await request<{
          distance_seconds: number;
          path: string[];
          path_coords: [number, number][];
        }>(`/api/v1/route?from_id=${from.id}&to_id=${to.id}`, { token });
        setRoute({
          coords: res.path_coords ?? [],
          distanceSeconds: res.distance_seconds,
          nodeCount: res.path?.length ?? 0,
        });
      } catch (e) {
        setRoute(null);
        setRouteError(
          e instanceof Error ? e.message : "Could not compute a route.",
        );
      } finally {
        setRouteLoading(false);
      }
    },
    [items, selectedIncidentId, token],
  );

  const now = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const selected = items.find((i) => i.id === selectedIncidentId) ?? null;

  const mapRef = useRef<MapActions | null>(null);

  const routeMinutes = route ? Math.max(1, Math.round(route.distanceSeconds / 60)) : null;

  const incidentStats = useMemo(() => {
    let verified = 0;
    let unverified = 0;
    for (const i of items) {
      if (i.verification === "VERIFIED") verified += 1;
      else unverified += 1;
    }
    return { verified, unverified, total: items.length };
  }, [items]);

  // Honest coverage line: if the API has more incidents than the map
  // loaded, the screen says so instead of implying it shows everything.
  const coverage =
    incidentTotal > items.length
      ? `Showing ${items.length} of ${incidentTotal} visible incidents`
      : `${items.length} visible incident${items.length === 1 ? "" : "s"}`;

  return (
    <div>
      <PageHeader
        title="Live Operations Map"
        subtitle={`Real-time incidents across Delhi NCR · updated ${now}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => toggleLayer("incidents")}>
              ⚗ Layers {layers.incidents ? "✓" : ""}
            </Button>
            <Button
              variant={live ? "primary" : "secondary"}
              onClick={() => setLive(!live)}
            >
              ● Live {live ? "ON" : "OFF"}
            </Button>
            <Button
              onClick={() => mapRef.current?.fitToIncidents()}
              disabled={items.length === 0}
            >
              ⛶ Fit all
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <EmptyState
              title="No public incidents yet"
              body="Be the first to report — new submissions appear here live."
              action={
                <Button variant="primary" onClick={() => router.push("/report")}>
                  Report an Incident
                </Button>
              }
            />
          ) : (
            <LiveMap
              ref={mapRef}
              incidents={items}
              selectedId={selectedIncidentId}
              onSelect={select}
              route={route}
              closures={closures}
              showIncidents={layers.incidents}
              showRoute={layers.routes}
              showClosures={layers.closures}
              className="min-h-[520px]"
            />
          )}

          {/* Map legend + honest layer status */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Pin status
              </p>
              <ul className="space-y-1.5 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                  Verified · {incidentStats.verified}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                  Unverified · {incidentStats.unverified}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-0.5 w-4 bg-[#38bdf8]" />
                  Computed route
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-0.5 w-4 bg-[#ef4444]" />
                  Closed road · {closures.length}
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Layers
              </p>
              <div className="space-y-1.5">
                {(
                  [
                    ["incidents", "Incidents"],
                    ["routes", "Computed route"],
                    ["closures", "Road closures"],
                    ["traffic", "Live traffic (TomTom)"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between py-1 text-[11px]"
                  >
                    <span className="text-[var(--muted)]">{label}</span>
                    <input
                      type="checkbox"
                      checked={layers[key]}
                      onChange={() => {
                        toggleLayer(key);
                        if (key === "traffic") {
                          if (!layers.traffic) void fetchTraffic();
                          else setTrafficData(null);
                        }
                      }}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </label>
                ))}
              </div>
              {layers.traffic && (
                <div className="mt-2 rounded border border-[var(--border)] bg-[var(--background)] p-2 text-[10px]">
                  {trafficLoading && (
                    <p className="text-[var(--muted)]">Fetching traffic…</p>
                  )}
                  {trafficData && !trafficLoading && (
                    trafficData.available ? (
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[var(--foreground)]">
                          {trafficData.road_name || "Road segment"}
                        </p>
                        <p>
                          Current: {trafficData.current_speed_kmh ?? "—"} km/h ·
                          Free flow: {trafficData.free_flow_speed_kmh ?? "—"} km/h
                        </p>
                        <p className={trafficData.congestion_ratio !== null && trafficData.congestion_ratio < 0.5 ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
                          {trafficData.congestion_ratio !== null
                            ? `Congestion: ${Math.round((1 - trafficData.congestion_ratio) * 100)}%`
                            : "No congestion data"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[var(--danger)]">
                        Traffic service unavailable — TomTom key not configured or quota exceeded.
                      </p>
                    )
                  )}
                </div>
              )}
              <p className="mt-2 text-[10px] text-[var(--subtle)]">
                Team GPS is not available: no user carries a position. It is not faked here.
                Traffic data is fetched live from TomTom when the layer is enabled.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Basemap
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                Real OpenStreetMap raster tiles. Pan, scroll-zoom and drag are
                all live.
              </p>
              <p className="mt-2 text-[10px] text-[var(--subtle)]">
                Graph: 406,154 OSM nodes · 879,902 directed edges.
              </p>
              <p className="mt-2 text-[10px] text-[var(--subtle)]">
                {coverage}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs font-bold">
                  {selected.id.slice(0, 8)}
                </span>
                <StatusBadge value={selected.assessment_status} />
              </div>
              <p className="text-xs font-semibold">
                {selected.category} — {selected.location_text ?? selected.region ?? "—"}
              </p>
              <dl className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Location</dt>
                  <dd className="truncate text-right">
                    {selected.location_text ?? selected.region ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Coordinates</dt>
                  <dd className="font-mono">
                    {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Reported</dt>
                  <dd>{selected.updated_at}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">AI Assessment</dt>
                  <dd>
                    <StatusBadge value={selected.assessment_status} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Verification</dt>
                  <dd>
                    <StatusBadge value={selected.verification} />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Response</dt>
                  <dd className="text-[var(--primary)]">{selected.response_phase}</dd>
                </div>
              </dl>
              <LinkButton
                href={`/incidents/${selected.id}`}
                variant="primary"
                className="mt-3 w-full"
              >
                View Details →
              </LinkButton>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-6 text-center">
              <p className="text-xs font-semibold">No pin selected</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Click any incident pin on the map to see its dispatch card.
              </p>
            </div>
          )}

          {/* Place search */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-xs font-semibold">Location search</p>
            <div className="flex gap-2">
              <input
                className="min-h-10 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[11px]"
                placeholder="Search a place in Delhi NCR…"
                value={geoQuery}
                onChange={(e) => setGeoQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runGeocode();
                }}
                aria-label="Search a place"
              />
              <button
                onClick={runGeocode}
                disabled={geoLoading}
                className="min-h-10 rounded bg-[var(--primary)] px-2.5 py-1.5 text-[11px] text-white disabled:opacity-50"
              >
                {geoLoading ? "…" : "Search"}
              </button>
            </div>
            {geoError && (
              <p className="mt-2 text-[10px] text-[var(--warning)]">{geoError}</p>
            )}
            {geoResults.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {geoResults.map((g, i) => (
                  <li key={`${g.display_name}-${i}`} className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--muted)]" title={g.display_name}>
                      {g.display_name}
                    </span>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => void routeToIncident(g)}
                        className="shrink-0 rounded border border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--primary)] hover:bg-[var(--surface-2)]"
                      >
                        Route here
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {geoResults.length > 0 && !selected && (
              <p className="mt-2 text-[10px] text-[var(--subtle)]">
                Select an incident pin to route a unit from this place.
              </p>
            )}
          </div>

          {/* Route finder */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-xs font-semibold">Route finder</p>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[10px] text-[var(--muted)]">From</span>
                <select
                  className="min-h-10 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[11px]"
                  value={routeFrom}
                  onChange={(e) => setRouteFrom(e.target.value)}
                >
                  <option value="">From…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || l.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-[var(--muted)]">To</span>
                <select
                  className="min-h-10 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[11px]"
                  value={routeTo}
                  onChange={(e) => setRouteTo(e.target.value)}
                >
                  <option value="">To…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name || l.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={runRoute}
                disabled={routeLoading || !routeFrom || !routeTo || routeFrom === routeTo}
                className="min-h-10 w-full rounded bg-[var(--primary)] px-2 py-1.5 text-[11px] text-white disabled:opacity-50"
              >
                {routeLoading ? "Computing…" : "Find Route"}
              </button>
              {routeError && (
                <p role="alert" className="text-[10px] text-[var(--danger)]">
                  {routeError}
                </p>
              )}
              {snapNote && (
                <p className="text-[10px] text-[var(--warning)]">{snapNote}</p>
              )}
              {route && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-[10px]">
                  <p className="font-semibold text-[var(--foreground)]">
                    ≈ {routeMinutes} min · {route.nodeCount} nodes
                  </p>
                  <p className="mt-0.5 text-[var(--muted)]">
                    {route.coords.length} coordinates drawn on the map.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRoute(null)}
                    className="mt-1 underline text-[var(--subtle)]"
                  >
                    Clear route
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

