import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    // Paper-white primary: subtle vertical gradient catches "light", hover
    // adds a cinematic bloom + 1px lift. Pressed state pulls back hard.
    "bg-gradient-to-b from-accent-hover to-accent text-accent-fg shadow-sm hover:shadow-[var(--accent-bloom)] hover:-translate-y-px active:translate-y-0",
  secondary:
    "bg-surface-2 text-text border border-border hover:border-border-strong hover:bg-surface-3",
  outline:
    "bg-transparent text-text border border-border hover:border-border-strong hover:bg-surface",
  ghost:
    "bg-transparent text-text-muted hover:text-text hover:bg-surface-2",
  destructive:
    "bg-danger text-white hover:opacity-90 shadow-sm",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      iconLeft,
      iconRight,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium will-change-transform",
          // transition-all so colors, shadow, AND transform animate together.
          "transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm",
          "active:scale-[0.98]",
          VARIANT[variant],
          SIZE[size],
          className,
        )}
        {...rest}
      >
        {loading ? <Spinner /> : iconLeft}
        {children}
        {!loading ? iconRight : null}
      </button>
    );
  },
);

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
