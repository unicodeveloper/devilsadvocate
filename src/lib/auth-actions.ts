"use server";

import { signIn as authSignIn, signOut as authSignOut } from "./auth";
import { AuthError } from "next-auth";

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string };

export type ValyuSignInInput = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

/**
 * Creates a NextAuth session from a completed Valyu OAuth PKCE exchange.
 * Called by the OAuth callback page after tokens are obtained client-side,
 * so existing server-side `auth()` consumers (memos, runs, agents) see a
 * session and can read the user's Valyu access token off the JWT.
 */
export async function signInWithValyuAction(
  input: ValyuSignInInput,
): Promise<SignInResult> {
  if (!input.accessToken || !input.email) {
    return { ok: false, error: "Missing required fields" };
  }
  try {
    await authSignIn("valyu-oauth", {
      ...input,
      expiresAt: input.expiresAt ? String(input.expiresAt) : undefined,
      redirect: false,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Sign-in failed" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sign-in failed",
    };
  }
}

export async function signOutAction(): Promise<void> {
  await authSignOut({ redirect: false });
}
