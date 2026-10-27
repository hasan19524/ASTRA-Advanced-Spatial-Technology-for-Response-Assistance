"use client";
/**
 * MapPlaceholder — dark NCR map surface with pin dots (Leaflet lands Day 6).
 * Renders real mock incident positions so the screen never looks broken.
 */
import { mockIncidents } from "@/lib/mocks/fixtures";
import { SEVERITY_TONE } from "@/lib/constants";

const SEV_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  Major: "#f97316",
  Moderate: "#f59e0b",
  Minor: "#22c55e",
};

/** project lat/lng into the placeholder's fixed viewport (rough NCR bounds) */
function project(lat: number, lng: number) {
  const minLat = 28.35,
    maxLat = 28.85,
    minLng = 76.85,
    maxLng = 77.55;
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return { left: `${Math.max(2, Math.min(96, x))}%`, top: `${Math.max(4, Math.min(92, y))}%` };
}

export function MapPlaceholder({
  incidents = mockIncidents.filter((i) => i.visibility === "PUBLIC_UNVERIFIED"),
  onSelect,
  selectedId,
  className = "",
}: {
  incidents?: typeof mockIncidents;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[#0a1322] ${className}`}
      style={{ minHeight: 260 }}
      aria-label="Live operations map (Delhi NCR)"
    >
      {/* grid + water/road suggestion lines */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-30" aria-hidden>
        <path
          d="M10 80 Q 40 40 70 60 T 130 30"
          stroke="#1d4ed8"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M0 50 Q 50 70 100 45 T 200 55"
          stroke="#334155"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M60 0 L 75 100"
          stroke="#334155"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>

      {/* city labels + pins (pure functions of fixtures — hydration-safe) */}
      <>
          <span className="absolute left-[42%] top-[42%] text-[10px] font-semibold text-[var(--muted)]">
            New Delhi
          </span>
          <span className="absolute left-[68%] top-[30%] text-[9px] text-[var(--subtle)]">
            Ghaziabad
          </span>
          <span className="absolute left-[70%] top-[52%] text-[9px] text-[var(--subtle)]">
            Noida
          </span>
          <span className="absolute left-[30%] top-[68%] text-[9px] text-[var(--subtle)]">
            Gurgaon
          </span>
          <span className="absolute left-[55%] top-[82%] text-[9px] text-[var(--subtle)]">
            Faridabad
          </span>

          {/* incident pins */}
          {incidents.map((i) => {
            const { left, top } = project(i.lat, i.lng);
            const color = SEV_COLOR[i.severity] ?? SEV_COLOR.Minor;
            const selected = selectedId === i.id;
            return (
              <button
                key={i.id}
                onClick={() => onSelect?.(i.id)}
                title={`${i.id} · ${i.category} · ${i.location}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 shadow-lg transition-transform hover:scale-125"
                style={{
                  left,
                  top,
                  width: selected ? 16 : 12,
                  height: selected ? 16 : 12,
                  background: color,
                  boxShadow: `0 0 ${selected ? 14 : 8}px ${color}`,
                }}
              />
            );
          })}
      </>

      {/* legend */}
      <div className="absolute bottom-3 left-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-2 text-[10px] text-[var(--muted)]">
        <p className="mb-1 font-semibold text-[var(--foreground)]">Legend</p>
        {Object.entries(SEV_COLOR).map(([k, v]) => (
          <p key={k} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: v }}
            />
            {k}
          </p>
        ))}
      </div>

      {/* zoom affordance */}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
        <button className="px-2.5 py-1 text-xs hover:bg-[var(--surface-2)]">+</button>
        <button className="border-t border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface-2)]">
          −
        </button>
      </div>
    </div>
  );
}

export { SEVERITY_TONE };
