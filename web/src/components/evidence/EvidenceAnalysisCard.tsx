"use client";

export type EvidenceAnalysisResult = {
  image_quality: "PASS" | "FAIL";
  image_relevance: "RELEVANT" | "IRRELEVANT" | "UNCERTAIN";
  detected_objects: string[];
  incident_consistency: "CONSISTENT" | "INCONSISTENT" | "UNCERTAIN";
  authenticity_assessment:
    | "UNDETERMINED"
    | "SUSPICIOUS"
    | "POTENTIALLY_MANIPULATED";
  confidence: number;
  explanation: string;
  human_review_required: boolean;
};

type Props = {
  loading?: boolean;
  error?: string | null;
  result?: EvidenceAnalysisResult | null;
  unavailable?: boolean;
};

function badge(label: string, tone: "ok" | "warn" | "bad" | "neutral") {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : tone === "bad"
          ? "bg-red-500/15 text-red-300 border-red-500/30"
          : "bg-slate-500/15 text-slate-300 border-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

export function EvidenceAnalysisCard({
  loading,
  error,
  result,
  unavailable,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
        Analyzing evidence…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-3 py-2 text-xs text-[#fee2e2]"
      >
        {error}
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Evidence analysis service is unavailable. The image was not evaluated;
        human review is required. Authenticity is not determined.
      </div>
    );
  }

  if (!result) return null;

  const relevanceTone =
    result.image_relevance === "RELEVANT"
      ? "ok"
      : result.image_relevance === "IRRELEVANT"
        ? "bad"
        : "neutral";
  const consistencyTone =
    result.incident_consistency === "CONSISTENT"
      ? "ok"
      : result.incident_consistency === "INCONSISTENT"
        ? "bad"
        : "neutral";
  const authTone =
    result.authenticity_assessment === "UNDETERMINED"
      ? "neutral"
      : "warn";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted)]">Image quality:</span>
          {badge(result.image_quality, result.image_quality === "PASS" ? "ok" : "bad")}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted)]">Relevance:</span>
          {badge(result.image_relevance, relevanceTone as "ok" | "warn" | "bad" | "neutral")}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted)]">Consistency:</span>
          {badge(result.incident_consistency, consistencyTone as "ok" | "warn" | "bad" | "neutral")}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--muted)]">Authenticity:</span>
          {badge(result.authenticity_assessment, authTone as "ok" | "warn" | "bad" | "neutral")}
        </div>
      </div>

      {result.detected_objects.length > 0 && (
        <div className="text-[11px]">
          <span className="text-[var(--muted)]">Detected objects: </span>
          <span className="text-[var(--foreground)]">
            {result.detected_objects.join(", ")}
          </span>
        </div>
      )}

      <div className="text-[11px]">
        <span className="text-[var(--muted)]">Confidence: </span>
        <span className="text-[var(--foreground)]">
          {(result.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <p className="text-[11px] text-[var(--foreground)]">{result.explanation}</p>

      {result.human_review_required && (
        <p className="text-[10px] text-amber-300">
          Human review required — authenticity is not proven by this system.
        </p>
      )}
    </div>
  );
}