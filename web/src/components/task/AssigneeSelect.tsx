"use client";
/**
 * AssigneeSelect — picks one or more assignees from users grouped by department.
 * usersByDept may be empty (no live /users endpoint yet) — then the field is
 * left optional and the task is created unassigned. Honest: no fabricated users.
 */
import { useState } from "react";
import type { UserOut } from "@/api/openapi-types";

export type AssigneeSelectProps = {
  usersByDept: Record<string, UserOut[]>;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
};

export function AssigneeSelect({
  usersByDept,
  value,
  onChange,
  disabled = false,
  label = "Assignees",
}: AssigneeSelectProps) {
  const allUsers = Object.values(usersByDept).flat();
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  if (allUsers.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-[var(--muted)]">{label}</span>
        <span className="text-[10px] text-[var(--muted)] italic">(no users in directory)</span>
      </div>
    );
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const baseBox =
    "shrink-0 h-2 w-2 rounded-full border border-[var(--border)]";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium text-[var(--muted)]">{label}</span>
      <div
        onClick={() => setOpen(!open)}
        className={
          open
            ? "min-h-10 rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-[11px] cursor-pointer"
            : "min-h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[11px] cursor-pointer hover:border-[var(--border-strong)]"
        }
      >
        <span>
          {value.length === 0 ? "Choose assignee…" : value.length === 1 ? "1 assignee" : `${value.length} assignees`}
        </span>
        <span className="ml-auto text-[10px]">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] max-h-48 overflow-y-auto z-10">
          {Object.entries(usersByDept).map(([dept, users]) => (
            <div key={dept} className="px-2 py-1">
              <span className="block text-[9px] text-[var(--muted)] font-bold uppercase mb-1">{dept}</span>
              {users.map((u) => {
                const isSelected = selected.has(u.id);
                const dot = `${baseBox} ${isSelected ? "bg-[var(--primary)]" : "bg-[var(--surface-3)]"}`;
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`flex items-center gap-2 w-full min-h-10 px-2 py-1.5 text-[10px] transition-colors ${
                      isSelected ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                    }`}
                    disabled={disabled}
                  >
                    <span className={dot} />
                    {u.full_name} ({u.role})
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
