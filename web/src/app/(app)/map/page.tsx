"use client";
/**
 * Live Operations Map — placeholder map + popup card.
 * Subscribes to /ws/map so pins flow in as incidents are created (AD-10);
 * shows a proper empty state until the first public incident arrives.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapPlaceholder } from "@/components/map/MapPlaceholder";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMap } from "@/stores/map";
import { useIncidents } from "@/stores/incidents";
import { useAuthSession } from "@/hooks/useAuth";
import { request } from "@/api/client";

export default function LiveMapPage() {
  const router = useRouter();
  const { selectedIncidentId, select, layers, toggleLayer, live, setLive } = useMap();
  const {
    items,
    load,
    connectWS,
    disconnectWS,
  } = useIncidents();

  const { token, hydrated } = useAuthSession();

  useEffect(() => {
    if (!hydrated) return;
    void load({}, token);
  }, [load, token, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    connectWS(token);
    return () => disconnectWS();
  }, [connectWS, disconnectWS, token, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        const locs = await request<{ id: string; name: string | null }[]>("/api/v1/route/locations?limit=200", { token });
        setLocations(locs);
      } catch { /* ignore */ }
    })();
  }, [token, hydrated]);

  const runRoute = async () => {
    if (!routeFrom || !routeTo || routeFrom === routeTo) return;
    setRouteLoading(true);
    try {
      const res = await request<{ distance_seconds: number; path: string[] }>(
        `/api/v1/route?from_id=${routeFrom}&to_id=${routeTo}`,
        { token },
      );
      setRouteResult(res);
    } catch {
      setRouteResult(null);
    } finally {
      setRouteLoading(false);
    }
  };

  const runGeocode = async () => {
    if (!geoQuery.trim()) return;
    try {
      const res = await request<{ display_name: string; lat: number; lon: number }[]>("/api/v1/geocode/search?q=" + encodeURIComponent(geoQuery), { token });
      setGeoResults(res);
    } catch {
      setGeoResults([]);
    }
  };

  const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const selected = items.find((i) => i.id === selectedIncidentId) ?? null;
  const [routeFrom, setRouteFrom] = useState<string>("");
  const [routeTo, setRouteTo] = useState<string>("");
  const [routeResult, setRouteResult] = useState<{ distance_seconds: number; path: string[] } | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<{ display_name: string; lat: number; lon: number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string | null }[]>([]);

  return (
    <div>
      <PageHeader
        title="Live Operations Map"
        subtitle={`Real-time incidents across Delhi NCR · updated ${now}`}
        actions={
          <div className="flex gap-2">
            <Button onClick={() => toggleLayer("incidents")}>
              ⚗ Layers {layers.incidents ? "✓" : ""}
            </Button>
            <Button
              variant={live ? "primary" : "secondary"}
              onClick={() => setLive(!live)}
            >
              ● Live {live ? "ON" : "OFF"}
            </Button>
            <Button>⚙ Filters</Button>
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
            <MapPlaceholder
              incidents={items}
              selectedId={selectedIncidentId}
              onSelect={select}
              className="min-h-[520px]"
            />
          )}
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-bold">{selected.id}</span>
                <StatusBadge value={selected.assessment_status} />
              </div>
              <p className="text-xs font-semibold">
                {selected.category} — {selected.location_text ?? selected.region ?? "—"}
              </p>
              <dl className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Location</dt>
                  <dd>{selected.location_text ?? selected.region ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Reported</dt>
                  <dd>{selected.updated_at}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">AI Assessment</dt>
                  <dd>
                    <StatusBadge value={selected.assessment_status} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Verification</dt>
                  <dd>
                    <StatusBadge value={selected.verification} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Response</dt>
                  <dd className="text-[var(--primary)]">{selected.response_phase}</dd>
                </div>
              </dl>
              <Link href={`/incidents/${selected.id}`}>
                <Button variant="primary" className="mt-3 w-full">
                  View Details →
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-6 text-center">
              <p className="text-xs font-semibold">No pin selected</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Click any incident pin on the map to see its dispatch card.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-xs font-semibold">Location search</p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px]"
                placeholder="Search location…"
                value={geoQuery}
                onChange={(e) => setGeoQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void runGeocode(); }}
              />
              <button onClick={runGeocode} className="rounded bg-[var(--primary)] px-2 py-1 text-[11px] text-white">Search</button>
            </div>
            {geoResults.length > 0 && (
              <ul className="mt-2 space-y-1 text-[10px]">
                {geoResults.map((g, i) => (
                  <li key={i} className="text-[var(--muted)] truncate" title={g.display_name}>{g.display_name}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-xs font-semibold">Route finder</p>
            <div className="space-y-2">
              <select className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px]" value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)}>
                <option value="">From…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name || l.id.slice(0, 8)}</option>)}
              </select>
              <select className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px]" value={routeTo} onChange={(e) => setRouteTo(e.target.value)}>
                <option value="">To…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name || l.id.slice(0, 8)}</option>)}
              </select>
              <button onClick={runRoute} disabled={routeLoading || !routeFrom || !routeTo} className="w-full rounded bg-[var(--primary)] px-2 py-1 text-[11px] text-white disabled:opacity-50">
                {routeLoading ? "Computing…" : "Find Route"}
              </button>
              {routeResult && (
                <p className="text-[10px] text-[var(--muted)]">
                  Distance: {Math.round(routeResult.distance_seconds)}s · {routeResult.path.length} nodes
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-xs font-semibold">Layer toggles</p>
            {(
              [
                ["incidents", "Incidents"],
                ["teams", "Response Team"],
                ["routes", "Selected Route"],
                ["closures", "Road Closure"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between py-1.5 text-[11px]"
              >
                <span className="text-[var(--muted)]">{label}</span>
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => toggleLayer(key)}
                  className="h-3.5 w-3.5 accent-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
