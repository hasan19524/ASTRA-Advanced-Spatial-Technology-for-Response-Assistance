/**
 * LinkButton — an anchor that looks like a Button.
 *
 * Why this exists: the codebase had eight places doing
 *
 *     <Link href="…"><Button>…</Button></Link>
 *
 * which is invalid HTML (interactive content inside an anchor) and
 * produced a double-focus stop plus a 16 px-tall invisible tap target,
 * because the anchor only wrapped the inline text of the button.
 *
 * This renders ONE anchor with the button's visual language, so the
 * whole box is the hit area and there is exactly one focusable element.
 */
import Link from "next/link";
import type { ReactNode } from "react";

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

export function LinkButton({
  href,
  variant = "secondary",
  className = "",
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[2rem] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-0 [@media(pointer:coarse)]:min-h-10 [@media(pointer:coarse)]:py-2 ${STYLES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
