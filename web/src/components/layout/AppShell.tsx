"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AlertBanner } from "@/components/alert/AlertBanner";
import { ToastHost } from "@/components/ui/Toast";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full w-64" onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      )}
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <AlertBanner />
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}