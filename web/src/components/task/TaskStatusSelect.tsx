"use client";
/**
 * TaskStatusSelect — offers only LEGAL moves per PL-7:
 *   OPEN -> IN_PROGRESS | DONE,   IN_PROGRESS -> DONE,   DONE -> (terminal)
 * A backwards move is refused by the server (409) — we never optimistically
 * move the chip; the server's error is shown inline.
 */
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

const MOVES: Record<string, { label: string; next: string }[]> = {
  OPEN: [
    { label: "Start", next: "IN_PROGRESS" },
    { label: "Mark done", next: "DONE" },
  ],
  IN_PROGRESS: [{ label: "Mark done", next: "DONE" }],
  DONE: [],
};

export type TaskStatusSelectProps = {
  status: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: string | null;
};

export function TaskStatusSelect({ status, onChange, disabled, error }: TaskStatusSelectProps) {
  const [pending, setPending] = useState<string | null>(null);
  const moves = MOVES[status] ?? [];

  const pick = useCallback(
    (next: string) => {
      setPending(next);
      onChange(next);
    },
    [onChange],
  );

  if (moves.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <StatusBadge value={status} />
        <span className="text-[10px] text-[var(--muted)]">terminal</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <StatusBadge value={status} />
        {pending && (
          <span className="text-[10px] text-[var(--muted)] italic">moving to {pending}…</span>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {moves.map((m) => (
          <Button
            key={m.next}
            variant="secondary"
            disabled={disabled || pending !== null}
            onClick={() => pick(m.next)}
          >
            {m.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-[10px] text-[var(--danger)]">{error}</p>}
    </div>
  );
}
