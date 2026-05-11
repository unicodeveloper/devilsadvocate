import Link from "next/link";
import { z } from "zod";
import { createPasswordResetToken, TOKEN_TTL_MINUTES } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";

export const metadata = {
  title: "Forgot password · Devil's Advocate",
  description:
    "Reset your Devil's Advocate password. We'll email a one-time link if your account is on file.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

const emailSchema = z.string().email().max(254);

const INPUT_CLS =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

async function forgotPasswordAction(formData: FormData) {
  "use server";
  const raw = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(raw);
  // Even on validation failure we silently return — we don't want this
  // endpoint to be a user-enumeration oracle.
  if (!parsed.success) return;
  const result = await createPasswordResetToken(parsed.data);
  if (!result) return;
  const resetUrl = `${siteUrl()}/reset-password?token=${encodeURIComponent(result.rawToken)}`;
  await sendPasswordResetEmail({
    to: parsed.data,
    resetUrl,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  });
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.07] blur-3xl"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            Account recovery
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-text">
            {sent ? "Check your email" : "Forgot password?"}
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            {sent
              ? `If an account exists for that email, we sent a reset link. It expires in ${TOKEN_TTL_MINUTES} minutes.`
              : "Enter your email and we'll send you a link to set a new password."}
          </p>
        </div>

        {sent ? (
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-surface-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            Back to sign in
          </Link>
        ) : (
          <form
            action={async (fd) => {
              "use server";
              await forgotPasswordAction(fd);
              const { redirect } = await import("next/navigation");
              redirect("/forgot-password?sent=1");
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
                Email
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@firm.com"
                className={INPUT_CLS}
              />
            </label>
            <button
              type="submit"
              className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Email me a reset link
            </button>
            <Link
              href="/login"
              className="text-center text-xs text-text-muted transition-colors hover:text-text"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
