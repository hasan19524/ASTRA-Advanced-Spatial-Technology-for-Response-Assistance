"use client";
/**
 * TaskCreateForm — create a new task under an incident.
 * Department routes the task; assignees are optional (no live /users dir yet).
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AssigneeSelect } from "./AssigneeSelect";
import type { TaskCreateIn, UserOut } from "@/api/openapi-types";
export type TaskCreateFormProps = {
  departments: string[];
  usersByDept: Record<string, UserOut[]>;
  onCreate: (payload: TaskCreateIn) => void;
  disabled?: boolean;
};

export function TaskCreateForm({
  departments,
  usersByDept,
  onCreate,
  disabled = false,
}: TaskCreateFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }
    if (!department) {
      setErr("Pick a department to route the task.");
      return;
    }
    const payload: TaskCreateIn = {
      title: title.trim(),
      description: description.trim() || undefined,
      department,
      assignee_ids: assigneeIds.length ? assigneeIds : undefined,
    };
    void onCreate(payload);
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 mb-3">
      <h3 className="text-xs font-semibold text-[var(--foreground)] mb-2">New task</h3>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
          disabled={disabled}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
          disabled={disabled}
        />
        <div className="flex gap-2">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={disabled}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="">Route to department…</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <AssigneeSelect
            usersByDept={usersByDept}
            value={assigneeIds}
            onChange={setAssigneeIds}
            disabled={disabled}
          />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" disabled={disabled || !title.trim() || !department} onClick={submit}>
            Create task
          </Button>
        </div>
        {err && <p className="text-[10px] text-[var(--danger)] mt-1">{err}</p>}
      </div>
    </div>
  );
}
