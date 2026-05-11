"use client";

import { useState } from "react";
import { initiateOAuthFlow, isOAuthConfigured } from "@/app/lib/oauth";

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    if (!isOAuthConfigured()) {
      setError("Valyu sign-in is not configured. Contact your administrator.");
      return;
    }
    setIsLoading(true);
    try {
      await initiateOAuthFlow();
    } catch (err) {
      console.error("OAuth initiation error:", err);
      setError("Failed to start sign-in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
          "Sign in with Valyu"
        )}
      </button>
    </>
  );
}
