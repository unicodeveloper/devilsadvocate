"use server";

import { signIn as authSignIn, signOut as authSignOut } from "./auth";
import { AuthError } from "next-auth";

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string };

export async function signInAction(
  email: string,
  password: string,
): Promise<SignInResult> {
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  try {
    await authSignIn("credentials", { email, password, redirect: false });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Invalid email or password" };
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
