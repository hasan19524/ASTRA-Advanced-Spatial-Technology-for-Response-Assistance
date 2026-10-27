"use client";
/** Live Operations Map (reference screen 4) — placeholder map + popup card. */
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapPlaceholder } from "@/components/map/MapPlaceholder";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useMap } from "@/stores/map";
import { useIncidents } from "@/stores/incidents";

export default function LiveMapPage() {
  const { selectedIncidentId, select, layers, toggleLayer, live, setLive } = useMap();
  const { items, load } = useIncidents();

  useEffect(() => {
    void load();
  }, [load]);

  const now = useMemo(
    () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    [],
  );

  const selected = items.find((i) => i.id === selectedIncidentId) ?? null;

  return (
    <div>
      <PageHeader
        title="Live Operations Map"
        subtitle={`Real-time incidents, response teams and routes across Delhi NCR · updated ${now}`}
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
          <MapPlaceholder
            incidents={items.length ? items : undefined}
            selectedId={selectedIncidentId}
            onSelect={select}
            className="min-h-[520px]"
          />
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-bold">{selected.id}</span>
                <StatusBadge value={selected.severity} />
              </div>
              <p className="text-xs font-semibold">
                {selected.category} — {selected.location}
              </p>
              <dl className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Location</dt>
                  <dd>{selected.location}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Reported</dt>
                  <dd>{selected.updated_at}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Status</dt>
                  <dd>
                    <StatusBadge value={selected.response_phase} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Assigned Team</dt>
                  <dd>T-3 (Ambulance)</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">ETA</dt>
                  <dd className="text-[var(--primary)]">12 minutes</dd>
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
