"use client";
/**
 * Citizen report form — wired to the real POST /api/v1/incidents (multipart).
 * Fields: title*, description*, category* (8), optional region, optional
 * location (geolocation → lat/lng; declined → NCR center default, shown), 
 * optional location_text, optional photo (preview + client type/size check).
 * Voice slot visible but disabled ("coming soon", AD-16 → ships Day 7).
 */
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAlerts } from "@/stores/alerts";
import { CATEGORIES } from "@/lib/constants";
import { request } from "@/api/client";
import { useAuthSession } from "@/hooks/useAuth";

const MAX_BYTES = 5 * 1024 * 1024; // mirror backend MAX_UPLOAD_BYTES (AD-8)
const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const NCR_LAT = 28.61;
const NCR_LON = 77.21;

type LocationSource = "browser" | "default";

export default function ReportPage() {
  const router = useRouter();
  const toast = useAlerts((s) => s.toast);
  const { token } = useAuthSession();

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

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
                <img
                  src={photoPreview}
                  alt="Photo preview"
                  className="h-32 w-32 object-cover"
                />
              </div>
            )}
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
            <span className="w-3 h-3 rounded-full bg-[var(--muted)]" />
            Voice reporting coming soon (Day 7)
          </div>
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
