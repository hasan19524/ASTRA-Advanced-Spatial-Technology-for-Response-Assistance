"use client";
/** Landing — send people to the dashboard (guard bounces to /login if needed). */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--background)]">
      <p className="text-xs text-[var(--muted)]">Opening ASTRA…</p>
    </div>
  );
}
