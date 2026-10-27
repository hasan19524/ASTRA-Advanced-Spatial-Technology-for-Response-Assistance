"use client";
/**
 * Citizen report form (endpoint #6 — POST /incidents, multipart when backend ready).
 * Category picker (AD-15) + sensitivity preview + photo/voice affordances.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAlerts } from "@/stores/alerts";
import { CATEGORIES, SEVERITIES } from "@/lib/constants";

export default function ReportPage() {
  const router = useRouter();
  const toast = useAlerts((s) => s.toast);

  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("Moderate");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [sensitivity, setSensitivity] = useState<"PUBLIC" | "RESTRICTED">("PUBLIC");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!category) {
      setError("Pick a category so the right department can be suggested.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Describe the incident in at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      // real endpoint lands with Module 1 (contract #6); until then succeed locally
      toast({
        title: "Report submitted",
        body: "AI assessment runs next — you'll see it move to the public map if Maybe-True.",
        tone: "success",
      });
      router.push("/incidents");
    } catch {
      setError("Could not submit the report — check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Report an Incident"
        subtitle="Text, photo or voice — every report is assessed before it goes public"
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-2.5 text-xs text-[#fee2e2]"
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Card title="What happened?">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">
                Category <span className="text-[var(--danger)]">*</span>
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      category === c
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[#dbeafe]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">Severity</span>
              <div className="flex gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                      severity === s
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[#dbeafe]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">
                Location <span className="text-[var(--danger)]">*</span>
              </span>
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lajpat Nagar, New Delhi"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">
                Description <span className="text-[var(--danger)]">*</span>
              </span>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What do you see? How many people are involved? What help is needed?"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          </div>
        </Card>

        <Card title="Evidence" subtitle="Photo + voice attach when the upload endpoint lands (contract #6)">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--background)] px-3 py-5 text-[11px] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
            >
              <span className="text-lg">📷</span>
              Attach photo
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--background)] px-3 py-5 text-[11px] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
            >
              <span className="text-lg">🎙</span>
              Record voice (Indian languages)
            </button>
          </div>
        </Card>

        <Card title="Sensitivity (AD-15)">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["PUBLIC", "Shown on the public map, poll opens", "normal Maybe-True flow"],
                ["RESTRICTED", "Withheld from the public map", "only authorized roles see it"],
              ] as const
            ).map(([value, good, note]) => (
              <button
                type="button"
                key={value}
                onClick={() => setSensitivity(value)}
                className={`rounded-lg border p-3 text-left ${
                  sensitivity === value
                    ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                    : "border-[var(--border)] bg-[var(--background)]"
                }`}
              >
                <p className="text-[11px] font-bold">{value}</p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">{good}</p>
                <p className="text-[10px] text-[var(--subtle)]">{note}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-[var(--subtle)]">
            Response is never blocked by secrecy — restricted reports are still
            assessed, verified and responded to normally.
          </p>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
