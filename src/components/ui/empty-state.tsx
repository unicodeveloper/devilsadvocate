import type { ReactNode } from "react";
import { cn } from "./cn";

type EmptyStateProps = {
  /** Optional decorative icon node, ~32px square. */
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Primary action — pass a <Button> or <Link>. */
  action?: ReactNode;
  /** Secondary action shown next to primary. */
  secondaryAction?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  body,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-text-muted">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-text">{title}</p>
        {body ? (
          <p className="max-w-md text-xs leading-5 text-text-muted">{body}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="mt-1 flex items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
