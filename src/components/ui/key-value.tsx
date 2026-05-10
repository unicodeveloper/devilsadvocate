import type { ReactNode } from "react";
import { cn } from "./cn";

type KeyValueProps = {
  label: ReactNode;
  value: ReactNode;
  /** Render the value in tabular monospaced figures. Default true. */
  mono?: boolean;
  className?: string;
};

/**
 * Compact label/value pair. Use for metadata strips on detail pages and
 * inside cards. Keeps numbers tabular by default so columns line up.
 */
export function KeyValue({
  label,
  value,
  mono = true,
  className,
}: KeyValueProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </span>
      <span
        className={cn(
          "text-sm text-text",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}
