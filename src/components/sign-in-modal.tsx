"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/lib/auth-actions";
import { useSignIn } from "./sign-in-provider";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function SignInModal() {
  const { isOpen, close, request, onSignedIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Capture the focused element when the modal opens; restore on close.
  // Auto-focus the email field once the modal is rendered.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setEmail("");
      setPassword("");
      setError(null);
      setTimeout(() => emailRef.current?.focus(), 0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      triggerRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC closes the modal; basic focus trap on Tab.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    startTransition(async () => {
      const result = await signInAction(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onSignedIn();
    });
  }

  if (!isOpen) return null;

  const headerId = "sign-in-modal-title";
  const descId = "sign-in-modal-desc";
  const errorId = "sign-in-error";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headerId}
        aria-describedby={descId}
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg sm:p-8"
      >
        <button
          ref={closeBtnRef}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>

        <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          Authenticate
        </div>
        <h2
          id={headerId}
          className="mt-1 text-lg font-semibold tracking-tight text-text"
        >
          Sign in to continue
        </h2>
        <p id={descId} className="mt-1 text-sm leading-6 text-text-muted">
          {request?.reason ?? "Use the credentials issued by your firm administrator."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="signin-email"
              className="text-[11px] font-medium uppercase tracking-wider text-text-subtle"
            >
              Email
            </label>
            <input
              id="signin-email"
              ref={emailRef}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="signin-password"
              className="text-[11px] font-medium uppercase tracking-wider text-text-subtle"
            >
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
