"use client";
/**
 * TaskList — presentational task board for one incident.
 * Pages own fetching via stores/tasks.ts; this component only renders + calls
 * the callbacks it receives. Permission-gated: a role that cannot act sees an
 * honest empty/locked state, never a dead button.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCreateForm } from "./TaskCreateForm";
import { TaskRow } from "./TaskRow";
import type { TaskCreateIn, TaskOut, TaskPatchIn, TaskUpdateIn, UserOut } from "@/api/openapi-types";

export type TaskListProps = {
  tasks: TaskOut[];
  canAssign: boolean;
  canUpdate: boolean;
  departments: string[];
  usersByDept: Record<string, UserOut[]>;
  onCreate: (payload: TaskCreateIn) => void;
  onPatch: (id: string, payload: TaskPatchIn) => void;
  onUpdate: (id: string, payload: TaskUpdateIn) => void;
};

export function TaskList({
  tasks,
  canAssign,
  canUpdate,
  departments,
  usersByDept,
  onCreate,
  onPatch,
  onUpdate,
}: TaskListProps) {
  const [creating, setCreating] = useState(false);

  if (tasks.length === 0) {
    // The create form must render here too — previously `creating` was set but
    // this early return never rendered it, so the "Create task" button did
    // nothing on an incident with zero tasks.
    if (creating && canAssign) {
      return (
        <TaskCreateForm
          departments={departments}
          usersByDept={usersByDept}
          onCreate={onCreate}
          disabled={false}
        />
      );
    }
    return (
      <EmptyState
        title={canAssign || canUpdate ? "No tasks yet" : "Tasks not available"}
        body={
          canAssign || canUpdate
            ? "Create the first dispatch task for this incident."
            : "Your role cannot create or update tasks on this incident."
        }
        action={
          canAssign ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create task
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Tasks</h2>
        {canAssign && (
          <Button variant="secondary" onClick={() => setCreating(true)}>
            + Create task
          </Button>
        )}
      </div>
      {creating && (
        <TaskCreateForm
          departments={departments}
          usersByDept={usersByDept}
          onCreate={onCreate}
          disabled={false}
        />
      )}
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            canUpdate={canUpdate}
            onPatch={onPatch}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
