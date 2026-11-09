"use client";
/**
 * AlertPrefForm — choose monitored regions / categories for alert prefs.
 * POST /api/v1/alerts/preferences upserts; DELETE removes.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAlerts } from "@/stores/alerts";
import { useAuthSession } from "@/hooks/useAuth";
import { CATEGORIES } from "@/lib/constants";
import type { AlertPrefIn } from "@/api/openapi-types";

const SEVERITIES = ["Critical", "High", "Major", "Moderate", "Minor"] as const;

export function AlertPrefForm() {
  const { token } = useAuthSession();
  const { prefs, loadPrefs, upsertPref, deletePref, error } = useAlerts();
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    void loadPrefs(token);
  }, [loadPrefs, token]);

  const save = () => {
    const payload: AlertPrefIn = {
      region: region || undefined,
      category: category || undefined,
      enabled,
    };
    void upsertPref(payload, token);
  };

  const remove = (id: string) => {
    void deletePref(id, token);
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">Alert preferences</h3>
      <p className="mb-3 text-[10px] text-[var(--muted)]">
        Choose which regions/categories push alerts to your banner. The badge only
        increments while the alert socket is connected.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
        >
          <option value="">All regions</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
        >
          <option value="">All categories</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex items-end gap-2">
          <label className="text-[10px] text-[var(--muted)] flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Enabled
          </label>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-[10px] text-[var(--danger)]">{error}</p>}
      <div className="mt-4">
        <h4 className="text-[10px] font-bold text-[var(--foreground)] mb-2">Your preferences</h4>
        {prefs.length === 0 ? (
          <p className="text-[10px] text-[var(--muted)]">No preferences set.</p>
        ) : (
          <ul className="space-y-1 text-[10px]">
            {prefs.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {String(p.region ?? "all regions")} / {String(p.category ?? "all categories")}
                  {p.enabled ? "" : " · disabled"}
                </span>
                <Button variant="ghost" onClick={() => remove(p.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
