"use client";
/**
 * Toast — global toast host backed by the alerts store (task 2.5).
 * Mount once in the app shell: <ToastHost />
 * Push: useAlerts.getState().toast({ title, tone: "success" })
 */
import { useAlerts } from "@/stores/alerts";

const TONE_STYLES: Record<string, string> = {
  info: "border-l-[var(--info)]",
  success: "border-l-[var(--success)]",
  warning: "border-l-[var(--warning)]",
  critical: "border-l-[var(--danger)]",
};

export function ToastHost() {
  const toasts = useAlerts((s) => s.toasts);
  const dismiss = useAlerts((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg border border-[var(--border-strong)] border-l-4 bg-[var(--surface-2)] px-3 py-2.5 shadow-xl ${
            TONE_STYLES[t.tone] ?? TONE_STYLES.info
          }`}
          onClick={() => dismiss(t.id)}
        >
          <p className="text-xs font-semibold text-[var(--foreground)]">{t.title}</p>
          {t.body && (
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t.body}</p>
          )}
        </div>
      ))}
    </div>
  );
}
