import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

const TONE: Record<Tone, string> = {
  neutral:
    "bg-surface-2 text-text-muted border border-border",
  accent:
    "bg-accent-soft text-accent border border-[color-mix(in_oklab,var(--accent)_30%,transparent)]",
  success:
    "bg-success-soft text-success border border-[color-mix(in_oklab,var(--success)_30%,transparent)]",
  warning:
    "bg-warning-soft text-warning border border-[color-mix(in_oklab,var(--warning)_30%,transparent)]",
  danger:
    "bg-danger-soft text-danger border border-[color-mix(in_oklab,var(--danger)_30%,transparent)]",
  info:
    "bg-info-soft text-info border border-[color-mix(in_oklab,var(--info)_30%,transparent)]",
  purple:
    "bg-[color-mix(in_oklab,#a855f7_12%,transparent)] text-[#c084fc] border border-[color-mix(in_oklab,#a855f7_30%,transparent)]",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}
