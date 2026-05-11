"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/app/stores/auth-store";
import { signInWithValyuAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

const OAUTH_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Module-level dedupe of processed OAuth codes. React Strict Mode (dev)
 * re-runs effects on mount → unmount → remount, which would otherwise fire
 * the callback handler twice — exchanging a single-use code a second time
 * (Valyu returns 400) and clearing `oauth_timestamp` between the two runs
 * (the second run then flashes "OAuth session expired"). OAuth codes are
 * always single-use, so deduping by code is the right key here.
 */
const processedCodes = new Set<string>();

function clearOAuthData() {
  localStorage.removeItem("oauth_code_verifier");
  localStorage.removeItem("oauth_state");
  localStorage.removeItem("oauth_timestamp");
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signIn = useAuthStore((state) => state.signIn);
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        clearOAuthData();
        setStatus("error");
        setErrorMessage("Authorization failed. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      if (!code || !state) {
        clearOAuthData();
        setStatus("error");
        setErrorMessage("Invalid callback parameters.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      // Dedupe across React Strict Mode's double-effect dev behaviour.
      // The first run owns the exchange; subsequent runs short-circuit so
      // they don't overwrite the success state with a stale error.
      if (processedCodes.has(code)) return;
      processedCodes.add(code);

      // Check expiration
      const timestamp = localStorage.getItem("oauth_timestamp");
      if (!timestamp || Date.now() - parseInt(timestamp, 10) > OAUTH_EXPIRY_MS) {
        clearOAuthData();
        setStatus("error");
        setErrorMessage("OAuth session expired. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      const storedState = localStorage.getItem("oauth_state");
      if (state !== storedState) {
        clearOAuthData();
        setStatus("error");
        setErrorMessage("Invalid state parameter. Possible CSRF attack.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      const codeVerifier = localStorage.getItem("oauth_code_verifier");
      if (!codeVerifier) {
        clearOAuthData();
        setStatus("error");
        setErrorMessage("Code verifier not found. Please try again.");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      try {
        const tokenResponse = await fetch("/api/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, codeVerifier }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error || "Token exchange failed");
        }

        const { access_token, refresh_token, expires_in, user } = await tokenResponse.json();

        clearOAuthData();

        // Bridge into NextAuth FIRST so server-side `auth()` consumers see
        // a session. If this fails we abort without touching Zustand —
        // leaving the user cleanly signed out rather than in a half-state
        // where the client thinks it's authed but every server call 401s.
        const bridge = await signInWithValyuAction({
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + (expires_in || 3600) * 1000,
          sub: user.sub || user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        });
        if (!bridge.ok) {
          throw new Error(bridge.error);
        }

        // Now mirror into Zustand for client-side consumers (the OAuth
        // proxy direct fetches, the sign-in panel, etc).
        signIn(
          {
            id: user.sub || user.id,
            name: user.name || user.email,
            email: user.email,
            picture: user.picture,
            email_verified: user.email_verified,
          },
          {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in || 3600,
          }
        );

        setStatus("success");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1000);
      } catch (error) {
        clearOAuthData();
        console.error("OAuth callback error:", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Authentication failed");
        setTimeout(() => router.push("/"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, router, signIn]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-lg shadow-lg p-8 text-center">
        {status === "processing" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 border-4 border-border border-t-accent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">
              Signing you in…
            </h2>
            <p className="text-sm text-text-muted">
              Please wait while we complete your authentication.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 bg-success-soft rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">
              Signed in
            </h2>
            <p className="text-sm text-text-muted">
              Redirecting you to the app…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 bg-danger-soft rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-danger"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">
              Sign-in failed
            </h2>
            <p className="text-sm text-text-muted">{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface border border-border rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 border-4 border-border border-t-accent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">
              Loading…
            </h2>
          </div>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
