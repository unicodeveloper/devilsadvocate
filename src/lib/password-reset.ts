import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { passwordResetTokens, users } from "./db/schema";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const TOKEN_TTL_MINUTES = 60;

/**
 * Hash a raw token with SHA-256 for storage. SHA-256 (not bcrypt) is fine
 * because the token itself is high-entropy (256 bits of randomness) — we
 * don't need a slow KDF to defeat brute force.
 */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Create a single-use reset token for the given email. Returns the raw
 * token (to be emailed) — the raw token is never stored. If the email
 * doesn't match any user, returns null silently (we don't leak that
 * information to the caller; the caller still reports "if your email is
 * on file, you'll receive a reset link").
 */
export async function createPasswordResetToken(
  email: string,
): Promise<{ rawToken: string; userId: string } | null> {
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  const user = userRows[0];
  if (!user) return null;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return { rawToken, userId: user.id };
}

/**
 * Verify a raw token and, if valid, set the user's new password hash and
 * mark the token used. Returns the user id on success, or an error code.
 */
export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: "invalid" | "expired" | "used" | "weak_password" }
> {
  if (newPassword.length < 8) {
    return { ok: false, error: "weak_password" };
  }
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  const token = rows[0];
  if (!token) return { ok: false, error: "invalid" };
  if (token.usedAt) return { ok: false, error: "used" };
  if (token.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, token.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, token.id));
  });

  return { ok: true, userId: token.userId };
}

/**
 * Cheap precheck used by the GET /reset-password page so we can show
 * "token invalid / expired" before the user types a new password. Does
 * NOT consume the token.
 */
export async function peekPasswordResetToken(
  rawToken: string,
): Promise<"valid" | "invalid" | "expired" | "used"> {
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  const token = rows[0];
  if (!token) return "invalid";
  if (token.usedAt) return "used";
  if (token.expiresAt.getTime() < Date.now()) return "expired";
  return "valid";
}

