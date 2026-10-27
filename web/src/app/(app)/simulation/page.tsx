"use client";
/** Simulation Center (reference screen 6) — HAZUS-lite scenario controls. */
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { MapPlaceholder } from "@/components/map/MapPlaceholder";
import { useAlerts } from "@/stores/alerts";
import { useAuthSession } from "@/hooks/useAuth";
import { mockIncidents } from "@/lib/mocks/fixtures";

export default function SimulationPage() {
  const { can } = useAuthSession();
  const toast = useAlerts((s) => s.toast);
  const [scenario, setScenario] = useState("Flooding");
  const [location, setLocation] = useState("Yamuna Floodplain, Delhi");
  const [intensity, setIntensity] = useState(60);
  const [showAffected, setShowAffected] = useState(true);
  const [showDensity, setShowDensity] = useState(false);
  const [showInfra, setShowInfra] = useState(true);
  const [running, setRunning] = useState(false);

  // simulations write ONLY to sim_* tables (AD-3) — this is a UI preview
  const simPins = mockIncidents.slice(0, 6);

  function run() {
    setRunning(true);
    toast({
      title: "Simulation queued",
      body: `${scenario} @ ${location} — runs on isolated sim_* tables only.`,
      tone: "info",
    });
    setTimeout(() => setRunning(false), 2000);
  }

  return (
    <div>
      <PageHeader
        title="Simulation Center"
        subtitle="Model potential impact and response for disaster scenarios"
        actions={
          <>
            <Button>📂 Load Scenario</Button>
            <Button variant="primary" onClick={run} disabled={running}>
              {running ? "Running…" : "▶ Run Simulation"}
            </Button>
          </>
        }
      />

      {!can("simulation.public") && (
        <div className="mb-4 rounded-lg border border-[var(--warning)]/40 bg-[rgba(245,158,11,.1)] px-4 py-2.5 text-xs text-[#fef3c7]">
          Your role cannot run simulations — switching to read-only preview.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* controls */}
        <Card title="Scenario Controls">
          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">Scenario Type</span>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus:border-[var(--primary)] focus:outline-none"
              >
                {["Flooding", "Earthquake", "Structural collapse", "Fire spread", "Heat wave"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus:border-[var(--primary)] focus:outline-none"
              />
            </label>

            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-[var(--muted)]">Intensity Level</span>
                <span className="font-semibold text-[var(--primary)]">
                  {intensity < 33 ? "Low" : intensity < 66 ? "Moderate" : intensity < 90 ? "High" : "Extreme"}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-[var(--subtle)]">
                <span>Low</span><span>Moderate</span><span>High</span><span>Extreme</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {(
                [
                  ["Show Affected Area", showAffected, setShowAffected],
                  ["Show Population Density", showDensity, setShowDensity],
                  ["Show Key Infrastructure", showInfra, setShowInfra],
                ] as const
              ).map(([label, val, set]) => (
                <label key={label} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  <span className="text-[11px] text-[var(--muted)]">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* map */}
        <div className="lg:col-span-2">
          <Card title="Impact Preview" subtitle="Simulated overlay — never touches live data (AD-3)" padding={false}>
            <MapPlaceholder
              incidents={simPins}
              className="min-h-[340px] border-0 rounded-b-xl"
            />
            {showAffected && (
              <div className="pointer-events-none absolute" />
            )}
          </Card>
        </div>
      </div>

      {/* estimated impact */}
      <div className="mt-4">
        <Card title="Estimated Impact">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon="📐" value="12.5 km²" label="Affected Area" tone="critical" />
            <StatCard icon="👥" value="45,000+" label="People Affected" tone="moderate" />
            <StatCard icon="🏗" value="14" label="Key Infrastructure" tone="info" />
            <StatCard icon="💰" value="₹320 Cr" label="Estimated Damage" tone="high" />
          </div>
          <p className="mt-3 text-[10px] text-[var(--subtle)]">
            HAZUS-lite deterministic model — scenario params → impacted polygon,
            resource counts and affected route edges. Runs on isolated sim_* tables only.
          </p>
        </Card>
      </div>
    </div>
  );
}
