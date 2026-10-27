/**
 * Auth layout — centered card for login/signup (no sidebar).
 */
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
