"use client";

import { useSignIn } from "./sign-in-provider";

/**
 * Drop-in replacement for `<form action={serverAction}>` that intercepts
 * submission when the user is not signed in. Shows the sign-in modal with
 * the supplied reason; otherwise lets the server action run normally.
 */
export function GatedForm({
  action,
  reason,
  requireRole,
  children,
  className,
  ...rest
}: {
  action: (formData: FormData) => void | Promise<void>;
  reason?: string;
  /** If specified, also block the submit when the signed-in user has the wrong role. */
  requireRole?: "fund_manager" | "cio";
  children: React.ReactNode;
  className?: string;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action">) {
  const { isAuthed, requireAuth, user } = useSignIn();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!isAuthed) {
          e.preventDefault();
          requireAuth({ reason });
          return;
        }
        if (requireRole && user?.role !== requireRole) {
          e.preventDefault();
          requireAuth({
            reason: `This action requires the ${
              requireRole === "fund_manager" ? "Fund Manager" : "CIO"
            } role. Sign in with the correct account.`,
          });
        }
      }}
      className={className}
      {...rest}
    >
      {children}
    </form>
  );
}
