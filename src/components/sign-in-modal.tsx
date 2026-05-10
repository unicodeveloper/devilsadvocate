"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/lib/auth-actions";
import { useSignIn } from "./sign-in-provider";

type Role = "fund_manager" | "cio";

const ROLE_META: Record<Role, { title: string; sub: string }> = {
  fund_manager: {
    title: "Continue as Fund Manager",
    sub: "Compose memos, run multi-agent stress-tests, send to CIO for review.",
  },
  cio: {
    title: "Continue as CIO",
    sub: "Read submitted memos, approve or reject with comment.",
  },
};

export function SignInModal() {
  const { isOpen, close, request, onSignedIn } = useSignIn();
  const [step, setStep] = useState<"choose" | "credentials">("choose");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
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
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      // Reset state on open
      setStep("choose");
      setSelectedRole(null);
      setEmail("");
      setPassword("");
      setError(null);
      // Defer focus until after render
      setTimeout(() => closeBtnRef.current?.focus(), 0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      triggerRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Auto-focus the email field when transitioning to credentials step.
  useEffect(() => {
    if (isOpen && step === "credentials") {
      setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [isOpen, step]);

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

  function pickRole(role: Role) {
    setSelectedRole(role);
    setStep("credentials");
  }

  function back() {
    setStep("choose");
    setSelectedRole(null);
    setError(null);
  }

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
          <span aria-hidden="true" className="text-base leading-none">×</span>
        </button>

        {step === "choose" ? (
          <ChooseRoleStep
            request={request}
            headerId={headerId}
            descId={descId}
            onPick={pickRole}
          />
        ) : (
          <CredentialsStep
            role={selectedRole!}
            email={email}
            password={password}
            error={error}
            isPending={isPending}
            headerId={headerId}
            descId={descId}
            emailRef={emailRef}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={onSubmit}
            onBack={back}
          />
        )}
      </div>
    </div>
  );
}

function ChooseRoleStep({
  request,
  headerId,
  descId,
  onPick,
}: {
  request: { reason?: string } | null;
  headerId: string;
  descId: string;
  onPick: (role: Role) => void;
}) {
  return (
    <div>
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
        {request?.reason ??
          "Two roles operate this system. Choose the one that matches your work."}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <RoleButton role="fund_manager" onClick={() => onPick("fund_manager")} />
        <RoleButton role="cio" onClick={() => onPick("cio")} />
      </div>
    </div>
  );
}

function RoleButton({ role, onClick }: { role: Role; onClick: () => void }) {
  const meta = ROLE_META[role];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
    >
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-text">{meta.title}</span>
        <span className="mt-0.5 text-xs leading-snug text-text-muted">
          {meta.sub}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-text-subtle transition-all group-hover:translate-x-0.5 group-hover:text-accent"
      >
        →
      </span>
    </button>
  );
}

function CredentialsStep({
  role,
  email,
  password,
  error,
  isPending,
  headerId,
  descId,
  emailRef,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onBack,
}: {
  role: Role;
  email: string;
  password: string;
  error: string | null;
  isPending: boolean;
  headerId: string;
  descId: string;
  emailRef: React.RefObject<HTMLInputElement | null>;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const errorId = "sign-in-error";
  const inputCls =
    "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text focus:outline-none focus-visible:underline"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>
      <h2
        id={headerId}
        className="text-lg font-semibold tracking-tight text-text"
      >
        Sign in as {role === "fund_manager" ? "Fund Manager" : "CIO"}
      </h2>
      <p id={descId} className="mt-1 text-sm text-text-muted">
        Use the credentials issued by your firm administrator.
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
            onChange={(e) => onEmailChange(e.target.value)}
            className={inputCls}
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
            onChange={(e) => onPasswordChange(e.target.value)}
            className={inputCls}
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
  );
}
