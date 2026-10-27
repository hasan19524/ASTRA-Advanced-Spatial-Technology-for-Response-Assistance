"use client";
/**
 * AppShell — sidebar + topbar frame for every authenticated page (task 1.2).
 * Also hosts the global ToastHost.
 */
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ToastHost } from "@/components/ui/Toast";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
