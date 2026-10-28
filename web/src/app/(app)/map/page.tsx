"use client";
/**
 * Live Operations Map — placeholder map + popup card.
 * Subscribes to /ws/map so pins flow in as incidents are created (AD-10);
 * shows a proper empty state until the first public incident arrives.
 */
import { useEffect } from "react";
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

export default function LiveMapPage() {
  const router = useRouter();
  const { selectedIncidentId, select, layers, toggleLayer, live, setLive } = useMap();
  const {
    items,
    load,
    connectWS,
    disconnectWS,
  } = useIncidents();

  const { token } = useAuthSession();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    connectWS(token);
    return () => disconnectWS();
  }, [connectWS, disconnectWS, token]);

  const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const selected = items.find((i) => i.id === selectedIncidentId) ?? null;

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
