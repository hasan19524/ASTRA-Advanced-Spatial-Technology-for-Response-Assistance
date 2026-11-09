"use client";
/**
 * Citizen report form — wired to the real POST /api/v1/incidents (multipart).
 * Fields: title*, description*, category* (8), optional region, optional
 * location (geolocation → lat/lng; declined → NCR center default, shown), 
 * optional location_text, optional photo (preview + client type/size check).
 * Voice slot visible but disabled ("coming soon", AD-16 → ships Day 7).
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAlerts } from "@/stores/alerts";
import { CATEGORIES } from "@/lib/constants";
import { request } from "@/api/client";
import { useAuthSession } from "@/hooks/useAuth";
import {
  EvidenceAnalysisCard,
  type EvidenceAnalysisResult,
} from "@/components/evidence/EvidenceAnalysisCard";
import { useVoiceLanguage } from "@/stores/voiceLanguage";

const MAX_BYTES = 5 * 1024 * 1024; // mirror backend MAX_UPLOAD_BYTES (AD-8)
const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const NCR_LAT = 28.61;
const NCR_LON = 77.21;

type LocationSource = "browser" | "default";

export default function ReportPage() {
  const router = useRouter();
  const toast = useAlerts((s) => s.toast);
  const { token } = useAuthSession();
  // The microphone language comes from Settings (AD-16) — one selection,
  // persisted, shared by the settings screen and this form.
  const voiceLanguage = useVoiceLanguage();

  // Fetch the language list once (the store caches it for Settings too).
  useEffect(() => {
    void voiceLanguage.load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [locationText, setLocationText] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locSource, setLocSource] = useState<LocationSource | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<EvidenceAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisUnavailable, setAnalysisUnavailable] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The actual MIME type the browser recorded — used for the filename and
  // content type sent to the STT endpoint (Gnani supports OGG/WAV/MP3/...;
  // WebM is not documented and is sent as video/webm by default).
  const recordedMimeRef = useRef<string>("audio/ogg");

  const setFallback = useCallback(() => {
    setLat(NCR_LAT);
    setLng(NCR_LON);
    setLocSource("default");
  }, []);

  const coordsText = useCallback(() => {
    if (lat == null || lng == null) return "—";
    const la = Math.abs(lat).toFixed(4);
    const lo = Math.abs(lng).toFixed(4);
    const ns = lat >= 0 ? "N" : "S";
    const ew = lng >= 0 ? "E" : "W";
    const src =
      locSource === "browser" ? "browser" : locSource === "default" ? "NCR center (default)" : "—";
    return `${la}° ${ns}, ${lo}° ${ew}  ·  ${src}`;
  }, [lat, lng, locSource]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setFallback();
      return;
    }
    setLocSource("browser");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocSource("browser");
      },
      () => {
        setFallback();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [setFallback]);

  const clearPhoto = useCallback(() => {
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoErr(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisUnavailable(false);
    if (photoInput.current) photoInput.current.value = "";
  }, []);

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoErr(null);
    if (!file) return;
    if (!ALLOWED[file.type as keyof typeof ALLOWED]) {
      setPhotoErr("Photo must be a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhotoErr("Photo exceeds the 5 MB limit.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, []);

  const analyzeEvidence = useCallback(async () => {
    if (!photo) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setAnalysisUnavailable(false);
    try {
      const form = new FormData();
      form.append("image", photo);
      form.append(
        "incident_description",
        description.trim().length >= 10 ? description.trim() : title.trim() || "incident",
      );
      form.append("category", category || "Hazard/Other");
      const res = await request<EvidenceAnalysisResult>("/api/v1/evidence/analyze", {
        method: "POST",
        body: form,
        token,
      });
      setAnalysisResult(res);
      if (
        res.explanation &&
        res.explanation.toLowerCase().includes("unavailable")
      ) {
        setAnalysisUnavailable(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Evidence analysis failed.";
      if (msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("503")) {
        setAnalysisUnavailable(true);
      } else {
        setAnalysisError(msg);
      }
    } finally {
      setAnalyzing(false);
    }
  }, [photo, description, title, category, token]);

  const sendToSTT = useCallback(async (blob: Blob) => {
    const form = new FormData();
    const ext = recordedMimeRef.current === "audio/ogg" ? "ogg" : "webm";
    form.append("audio", blob, `recording.${ext}`);
    form.append("language_code", voiceLanguage.selected);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await request<{ transcript?: string }>("/api/v1/voice/stt", {
          method: "POST",
          body: form,
          token,
        });
        const transcript = res?.transcript;
        if (transcript) {
          setVoiceTranscript(transcript);
          setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setVoiceErr(null);
          return;
        }
        lastError = new Error("No transcript returned.");
      } catch (e) {
        lastError = e;
        const http = e as { status?: number };
        if (http.status !== 504 || attempt === 1) break;
      }
    }
    setVoiceErr(lastError instanceof Error ? lastError.message : "Speech-to-text failed.");
  }, [voiceLanguage.selected, token]);

  const startRecording = useCallback(async () => {
    setVoiceErr(null);
    setVoiceTranscript(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer OGG — Gnani documents OGG/WAV/MP3/FLAC/AAC/M4A support, not
      // WebM. Fall back to WebM only if the browser cannot do OGG.
      const mime =
        MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "audio/webm";
      recordedMimeRef.current = mime;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        rec.stop();
        setVoiceErr("Microphone error.");
        setRecording(false);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mime });
        await sendToSTT(blob);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      }, 60000);
    } catch (e) {
      setVoiceErr(e instanceof Error ? e.message : "Microphone access failed.");
      setRecording(false);
    }
  }, [sendToSTT]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPhotoErr(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!category) {
      setError("Pick a category so the right department can be suggested.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Describe the incident in at least 10 characters.");
      return;
    }

    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append("category", category);
    if (region.trim()) form.append("region", region.trim());
    if (lat != null) form.append("latitude", String(lat));
    if (lng != null) form.append("longitude", String(lng));
    if (locationText.trim()) form.append("location_text", locationText.trim());
    // The description came from Gnani STT — mark the report's origin (audit G5).
    if (voiceTranscript) form.append("source", "VOICE");
    if (photo) form.append("photo", photo);

    setSubmitting(true);
    try {
      const res = await request<{ id: string; grouped: boolean }>("/api/v1/incidents", {
        method: "POST",
        body: form,
        token,
      });
      toast({
        title: "Report submitted",
        body: res.grouped
          ? "Filed under an existing report for the same event — you'll land on the parent."
          : "AI assessment runs next — it moves to the public map if Maybe-True.",
        tone: "success",
      });
      router.push(`/incidents/${res.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      setError(msg);
      toast({ title: "Submission failed", body: msg, tone: "critical" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Report an Incident"
        subtitle="Text + optional photo — every report is assessed before it goes public"
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
                Title <span className="text-[var(--danger)]">*</span>
              </span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief title of the incident"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
              />
            </label>

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
              <span className="mb-1 block text-[11px] text-[var(--muted)]">
                Region (optional)
              </span>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. South Delhi, Gurugram, Noida"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-[var(--subtle)]">
                Used to detect duplicate reports and the Delhi-NCR geo check.
              </p>
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

        <Card title="Location">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={useMyLocation}
                disabled={submitting}
              >
                {locSource === null ? "Use my location" : "📍 Set from my location"}
              </Button>
              <span className="ml-auto text-[10px] text-[var(--muted)]">
                {locSource ? coordsText() : "Coordinates not set — Delhi NCR center will be used."}
              </span>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] text-[var(--muted)]">
                Location text (optional)
              </span>
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="e.g. Lajpat Nagar market complex"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          </div>
        </Card>

        <Card title="Photo (optional)">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhoto}
                disabled={submitting}
                className="sr-only"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => photoInput.current?.click()}
                disabled={submitting || !!photo}
              >
                {photo ? "Change photo" : "Attach photo"}
              </Button>
              {photo && (
                <Button type="button" variant="ghost" onClick={clearPhoto}>
                  Remove
                </Button>
              )}
            </div>
            {photoPreview && (
              <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {/* local object: URL — next/image cannot optimise blob: sources */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Photo preview"
                  className="h-32 w-32 object-cover"
                />
              </div>
            )}
            {photo && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={analyzeEvidence}
                  disabled={analyzing || submitting}
                >
                  {analyzing ? "Analyzing…" : "Analyze evidence"}
                </Button>
              </div>
            )}
            <EvidenceAnalysisCard
              loading={analyzing}
              error={analysisError}
              result={analysisResult}
              unavailable={analysisUnavailable}
            />
            {photoErr && (
              <p className="text-[10px] text-[var(--danger)]">{photoErr}</p>
            )}
            <p className="text-[10px] text-[var(--subtle)]">
              JPEG / PNG / WebP · max 5 MB
            </p>
          </div>
        </Card>

        <div className="bg-[var(--surface-2)] rounded-lg border border-[var(--border)] p-3 text-left">
          <p className="text-[11px] font-bold text-[var(--foreground)]">Sensitivity (AD-15)</p>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Citizens file as <span className="font-medium">PUBLIC</span> by default — shown on the
            public map with a poll. An authorized user can restrict it later; response is never
            blocked by secrecy.
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
            <span
              className={`w-3 h-3 rounded-full ${recording ? "bg-[var(--danger)] animate-pulse" : "bg-[var(--muted)]"}`}
            />
            Voice input (STT)
          </div>
          <div className="flex items-center gap-2 ml-4 sm:ml-0">
            <select
              value={voiceLanguage.selected}
              onChange={(e) => voiceLanguage.select(e.target.value)}
              aria-label="Voice input language"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[10px] focus:border-[var(--primary)] focus:outline-none"
            >
              {voiceLanguage.languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant={recording ? "danger" : "secondary"}
              disabled={submitting}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? "Stop recording" : "🎙 Record voice"}
            </Button>
            {recording && (
              <span className="text-[10px] font-mono text-[var(--foreground)]">{elapsed}s</span>
            )}
          </div>
          {voiceErr && <p className="text-[10px] text-[var(--danger)]">{voiceErr}</p>}
          {voiceTranscript && (
            <div className="rounded-lg border border-[var(--border)]/40 bg-[var(--primary-soft)]/30 p-2 text-[10px]">
              <span className="text-[var(--primary)] font-bold text-[10px]">Transcript:</span>{" "}
              {voiceTranscript}
              <p className="mt-1 text-[9px] text-[var(--subtle)]">
                Speech-to-text by Gnani AI Prisma — editable above before you submit.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
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
