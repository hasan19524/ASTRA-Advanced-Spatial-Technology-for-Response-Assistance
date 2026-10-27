/**
 * Button — shared primary/secondary/ghost button (matches reference design).
 */
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const STYLES: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white border-transparent",
  secondary:
    "bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground)] border-[var(--border-strong)]",
  ghost:
    "bg-transparent hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)] border-transparent",
  danger:
    "bg-[var(--danger)]/15 hover:bg-[var(--danger)]/25 text-[var(--danger)] border-[var(--danger)]/30",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${STYLES[variant]} ${className}`}
      {...props}
    />
  );
}
