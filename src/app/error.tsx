"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in browser console for dev; in production, Railway logs
    // capture the server-side stack. No-op error tracker here intentionally
    // — wire Sentry/PostHog/etc. if you decide to later.
    console.error("Caught by error boundary:", error);
  }, [error]);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger opacity-[0.08] blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-danger">
          Error · Something broke
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          We hit an unexpected error
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Try the action again. If it keeps happening, the team has been
          notified through the server logs.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-text-subtle">
            Error ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
          >
            Try again
          </button>
          <Link
            href="/memos"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-2 px-4 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            Back to memos
          </Link>
        </div>
      </div>
    </div>
  );
}
