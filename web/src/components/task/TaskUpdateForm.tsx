"use client";
/**
 * TaskUpdateForm — append-only timeline update under a task row.
 * Never mutates history; posts to POST /tasks/{id}/updates.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TaskUpdateIn } from "@/api/openapi-types";

export type TaskUpdateFormProps = {
  taskId: string;
  onUpdate: (id: string, payload: TaskUpdateIn) => void;
  disabled?: boolean;
};

export function TaskUpdateForm({ taskId, onUpdate, disabled = false }: TaskUpdateFormProps) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    if (!note.trim()) return;
    setErr(null);
    void onUpdate(taskId, { status: undefined, note: note.trim() });
    setNote("");
  };

  return (
    <div className="mt-2 pt-2 border-t border-[var(--border)]">
      <div className="flex gap-2 mt-1.5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an update note…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
          disabled={disabled}
        />
        <Button variant="secondary" disabled={!note.trim() || disabled} onClick={add}>
          Add update
        </Button>
      </div>
      {err && <p className="text-[10px] text-[var(--danger)] mt-1">{err}</p>}
    </div>
  );
}
