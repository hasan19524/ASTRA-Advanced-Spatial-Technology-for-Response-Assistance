"use client";
/**
 * TaskRow — one incident task: title, status (legal moves only), department,
 * assignees, and an append-only update timeline.
 */
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskStatusSelect } from "./TaskStatusSelect";
import { TaskUpdateForm } from "./TaskUpdateForm";
import type { TaskOut, TaskPatchIn, TaskUpdateIn } from "@/api/openapi-types";

export type TaskRowProps = {
  task: TaskOut;
  canUpdate: boolean;
  canAssign: boolean;
  onPatch: (id: string, payload: TaskPatchIn) => void;
  onUpdate: (id: string, payload: TaskUpdateIn) => void;
};

export function TaskRow({
  task,
  canUpdate,
  canAssign,
  onPatch,
  onUpdate,
}: TaskRowProps) {
  const [editTitle, setEditTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [patchErr, setPatchErr] = useState<string | null>(null);

  const handlePatch = useCallback(
    (payload: TaskPatchIn) => {
      setPatchErr(null);
      void onPatch(task.id, payload);
      if (payload.title !== undefined) setEditTitle(false);
    },
    [task.id, onPatch],
  );

  const assigneeNames = (task.assignee_names ?? []).join(", ") || "—";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          {editTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft !== task.title) {
                  handlePatch({ title: titleDraft.trim() });
                }
                setEditTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (titleDraft.trim()) handlePatch({ title: titleDraft.trim() });
                  setEditTitle(false);
                }
                if (e.key === "Escape") {
                  setEditTitle(false);
                  setTitleDraft(task.title);
                }
              }}
              className="w-full text-xs font-semibold text-[var(--foreground)] bg-transparent border-b border-[var(--border)] focus:ring-0 px-0 py-0.5"
            />
          ) : (
            <h3 className="text-xs font-semibold text-[var(--foreground)] truncate" onDoubleClick={() => setEditTitle(true)} title={task.title}>
              {task.title}
            </h3>
          )}
          {task.description && (
            <p className="mt-0.5 text-[10px] text-[var(--muted)] truncate" title={String(task.description)}>
              {String(task.description)}
            </p>
          )}
          <p className="mt-1 text-[10px] text-[var(--muted)] flex items-center gap-1.5">
            <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
            {assigneeNames}
          </p>
        </div>
        {canAssign && (
          <Button variant="secondary" onClick={() => {}} title="Assign via create form">
            Assign
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[var(--muted)] uppercase font-bold">{task.department}</span>
        </div>
        <StatusBadge value={String(task.status)} />
      </div>

      {canUpdate && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          <TaskStatusSelect
            status={task.status}
            onChange={(next) => handlePatch({ status: next })}
            error={patchErr}
          />
          <TaskUpdateForm taskId={task.id} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}
