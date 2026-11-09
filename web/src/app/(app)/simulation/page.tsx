"use client";
/**
 * Simulation Center — HAZUS-lite scenario planner.
 *
 * The screen runs the REAL backend model (POST /api/v1/simulations) and
 * renders whatever it returns. It used to show fixed cards ("12.5 km²",
 * "45,000+ people", "₹320 Cr") no matter what you selected — a simulation
 * that does not react to its inputs is decoration. Now every figure below
 * comes from the run's summary, and the "estimate" label stays visible
 * because that is exactly what the model produces.
 *
 * Simulations write only to the isolated sim_* tables (AD-3) — they never
 * touch a live incident.
 */
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuthSession } from "@/hooks/useAuth";
import { request } from "@/api/client";

const SCENARIOS = [
  "Flooding",
  "Earthquake",
  "Structural collapse",
  "Fire spread",
  "Heat wave",
];

const CATEGORIES = [
  "Fire",
  "Accident",
  "Flood/Waterlogging",
  "Structural collapse",
  "Medical emergency",
  "Crime/Safety",
  "Utility outage",
  "Hazard/Other",
];

interface SimSummary {
  scenario: string;
  category: string;
  radius_km: number;
  intensity: number;
  affected_area_km2: number;
  affected_population_estimate: number;
  key_infrastructure_estimate: number;
  damage_estimate_inr: number;
  note?: string;
}

interface SimRun {
  id: string;
  mode: string;
  scenario: string;
  status: string;
  summary: SimSummary | null;
  created_at: string;
}

/** 12345678 → "1.2 Cr" (Indian numbering, what a Delhi reader expects). */
function inr(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "₹0";
  const crore = value / 10_000_000;
  if (crore >= 1) return `₹${crore.toFixed(1)} Cr`;
  const lakh = value / 100_000;
  if (lakh >= 1) return `₹${lakh.toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function SimulationPage() {
  const { can, token } = useAuthSession();
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [category, setCategory] = useState("Flood/Waterlogging");
  const [location, setLocation] = useState("Yamuna Floodplain, Delhi");
  const [radiusKm, setRadiusKm] = useState(5);
  const [intensity, setIntensity] = useState(60);
  const [run, setRun] = useState<SimRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await request<SimRun>("/api/v1/simulations", {
        method: "POST",
        token,
        body: {
          scenario,
          mode: "PUBLIC",
          params: {
            category,
            radius_km: radiusKm,
            intensity,
            location,
          },
        },
      });
      setRun(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
      setRun(null);
    } finally {
      setRunning(false);
    }
  }, [scenario, category, radiusKm, intensity, location, token]);

  // Load the most recent run on mount so the screen is never blank.
  useEffect(() => {
    let cancelled = false;
    request<SimRun[]>("/api/v1/simulations", { token })
      .then((runs) => {
        if (!cancelled && Array.isArray(runs) && runs.length > 0) {
          request<SimRun>(`/api/v1/simulations/${runs[0].id}`, { token })
            .then((r) => {
              if (!cancelled) setRun(r);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const summary = run?.summary ?? null;
  const allowed = can("simulation.public");

  return (
    <div>
      <PageHeader
        title="Simulation Center"
        subtitle="Model potential impact and response for disaster scenarios"
        actions={
          <Button
            variant="primary"
            onClick={runSimulation}
            disabled={running || !allowed}
          >
            {running ? "Running…" : "▶ Run Simulation"}
          </Button>
        }
      />

      {!allowed && (
        <div className="mb-4 rounded-lg border border-[var(--warning)]/40 bg-[rgba(245,158,11,.1)] px-4 py-2.5 text-xs text-[#fef3c7]">
          Your role cannot run simulations — switching to read-only preview.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-3 text-xs text-[#fee2e2]"
        >
          {error}
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
                disabled={!allowed}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus:border-[var(--primary)] focus:outline-none disabled:opacity-60"
              >
                {SCENARIOS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">Hazard Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!allowed}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus:border-[var(--primary)] focus:outline-none disabled:opacity-60"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!allowed}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 focus:border-[var(--primary)] focus:outline-none disabled:opacity-60"
              />
            </label>

            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-[var(--muted)]">Impact Radius</span>
                <span className="font-semibold text-[var(--primary)]">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={25}
                value={radiusKm}
                disabled={!allowed}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full accent-[var(--primary)] disabled:opacity-60"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-[var(--subtle)]">
                <span>1 km</span>
                <span>25 km</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-[var(--muted)]">Intensity Level</span>
                <span className="font-semibold text-[var(--primary)]">
                  {intensity < 33
                    ? "Low"
                    : intensity < 66
                      ? "Moderate"
                      : intensity < 90
                        ? "High"
                        : "Extreme"}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={intensity}
                disabled={!allowed}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-[var(--primary)] disabled:opacity-60"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-[var(--subtle)]">
                <span>Low</span>
                <span>Moderate</span>
                <span>High</span>
                <span>Extreme</span>
              </div>
            </div>
          </div>
        </Card>

        {/* run summary */}
        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Scenario Run"
            subtitle="Simulated overlay — never touches live data (AD-3)"
          >
            {!run ? (
              <EmptyState
                title="No simulation yet"
                body="Set the parameters and run a simulation. The estimates below appear once the model answers."
                icon="◐"
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <StatusBadge value={run.status} />
                  <span className="font-semibold">{run.scenario}</span>
                  {summary && <span className="text-[var(--muted)]">{summary.category}</span>}
                  {summary && (
                    <span className="text-[var(--muted)]">
                      {summary.radius_km} km radius · intensity {summary.intensity}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-[var(--subtle)]">
                    {new Date(run.created_at).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    icon="📐"
                    value={
                      summary ? `${summary.affected_area_km2} km²` : "—"
                    }
                    label="Affected Area"
                    tone="critical"
                  />
                  <StatCard
                    icon="👥"
                    value={
                      summary
                        ? summary.affected_population_estimate.toLocaleString("en-IN")
                        : "—"
                    }
                    label="People Affected"
                    tone="moderate"
                  />
                  <StatCard
                    icon="🏗"
                    value={
                      summary
                        ? String(summary.key_infrastructure_estimate)
                        : "—"
                    }
                    label="Key Infrastructure"
                    tone="info"
                  />
                  <StatCard
                    icon="💰"
                    value={summary ? inr(summary.damage_estimate_inr) : "—"}
                    label="Estimated Damage"
                    tone="high"
                  />
                </div>

                <p className="text-[10px] text-[var(--subtle)]">
                  {summary?.note ??
                    "HAZUS-lite deterministic model — scenario params → impacted area, population and damage."}{" "}
                  Runs on isolated sim_* tables only and never modifies a live
                  incident.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
