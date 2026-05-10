import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

/**
 * A toggleable chip. Used for filterable values, suggestion lists, etc.
 * Renders as a button so it inherits keyboard activation for free.
 */
export function Chip({ active = false, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
        active
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-transparent text-text-muted hover:border-border-strong hover:bg-surface-2 hover:text-text",
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">{active ? "✓" : "+"}</span>
      <span>{children}</span>
    </button>
  );
}
