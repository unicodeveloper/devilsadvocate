"use client";

import { useEffect, useRef, useState } from "react";
import { useSignIn } from "./sign-in-provider";
import { initiateOAuthFlow, isOAuthConfigured } from "@/app/lib/oauth";

export function SignInModal() {
  const { isOpen, close } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => primaryBtnRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      triggerRef.current?.focus?.();
    };
  }, [isOpen]);

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

  async function onValyuSignIn() {
    setError(null);
    if (!isOAuthConfigured()) {
      setError(
        "Valyu sign-in is not configured. Contact your administrator.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await initiateOAuthFlow();
      // initiateOAuthFlow redirects — control should not return here.
    } catch (err) {
      console.error("OAuth initiation error:", err);
      setError("Failed to start sign-in. Please try again.");
      setIsLoading(false);
    }
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
        className="absolute inset-0 bg-bg/40 backdrop-blur-md"
        aria-hidden="true"
      />

      {/* Card + halo wrapper */}
      <div className="relative animate-in zoom-in-95 fade-in duration-300">
        {/* Soft accent halo behind the card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-20 rounded-[3rem] bg-accent opacity-[0.08] blur-3xl"
        />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headerId}
          aria-describedby={descId}
          className="relative w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]"
        >
          {/* Top edge highlight — the light catching the bevel */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--accent)_50%,transparent)] to-transparent"
          />

          <button
            ref={closeBtnRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
          >
            <span aria-hidden="true" className="text-base leading-none">
              ×
            </span>
          </button>

          <div className="px-8 pb-7 pt-10">
            {/* Header */}
            <h2
              id={headerId}
              className="text-center text-[26px] font-semibold leading-tight tracking-tight text-text"
            >
              Devil&apos;s Advocate
            </h2>

            {/* Decorative rule — a thin accent line that echoes the
                institutional/financial-document aesthetic */}
            <div className="mx-auto mt-3 h-px w-12 bg-gradient-to-r from-transparent via-border-strong to-transparent" />

            {/* Body */}
            <p
              id={descId}
              className="mt-5 text-center text-[13px] leading-[1.7] text-text-muted"
            >
              Every thesis goes through a multi-agent debate, gets
              stress-tested against your firm&apos;s House View, and earns a
              binding verdict — before the memo ever reaches IC. Sign in to
              put yours on the table.
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-5 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                {error}
              </p>
            ) : null}

            <button
              ref={primaryBtnRef}
              type="button"
              onClick={onValyuSignIn}
              disabled={isLoading}
              className="group mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-fg shadow-[0_0_32px_var(--accent-glow)] transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_56px_var(--accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Redirecting to Valyu…
                </>
              ) : (
                <>
                  Sign in with Valyu
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {/* Footer — small institutional touch */}
            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-text-subtle">
              <svg
                aria-hidden="true"
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Secure OAuth via Valyu</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
