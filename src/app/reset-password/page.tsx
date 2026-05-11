import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consumePasswordResetToken,
  peekPasswordResetToken,
} from "@/lib/password-reset";

export const metadata = {
  title: "Reset password · Devil's Advocate",
  description: "Set a new password for your Devil's Advocate account.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

const INPUT_CLS =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

type SearchParams = {
  token?: string;
  error?: "invalid" | "expired" | "used" | "weak_password";
  done?: string;
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  if (sp.done === "1") {
    return (
      <ShellCard
        eyebrow="Success"
        title="Password updated"
        body="You can now sign in with your new password."
        action={
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
          >
            Go to sign in
          </Link>
        }
      />
    );
  }

  // Server-side peek so we can show a clear error before the form even
  // renders if the token is bad. The token itself is verified again on POST.
  const status = token ? await peekPasswordResetToken(token) : "invalid";

  if (status !== "valid") {
    const messages = {
      invalid:
        "This reset link is invalid. Request a new one and try again.",
      expired: "This reset link has expired. Request a new one and try again.",
      used: "This reset link has already been used. Request a new one if you need to reset again.",
    } satisfies Record<"invalid" | "expired" | "used", string>;
    return (
      <ShellCard
        eyebrow="Account recovery"
        title="Link no longer valid"
        body={messages[status]}
        action={
          <Link
            href="/forgot-password"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
          >
            Request a new link
          </Link>
        }
      />
    );
  }

  const errorMessage =
    sp.error === "weak_password"
      ? "Password must be at least 8 characters."
      : sp.error === "expired"
        ? "This link has expired. Request a new one."
        : sp.error === "used"
          ? "This link has already been used."
          : sp.error === "invalid"
            ? "This link is invalid."
            : null;

  return (
    <ShellCard
      eyebrow="Account recovery"
      title="Set a new password"
      body="Pick a new password — at least 8 characters."
    >
      <form
        action={async (fd) => {
          "use server";
          const raw = String(fd.get("password") ?? "");
          const t = String(fd.get("token") ?? "");
          const result = await consumePasswordResetToken(t, raw);
          if (!result.ok) {
            redirect(`/reset-password?token=${encodeURIComponent(t)}&error=${result.error}`);
          }
          redirect("/reset-password?done=1");
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="token" value={token} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            New password
          </span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
            className={INPUT_CLS}
          />
        </label>
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-xs text-danger"
          >
            {errorMessage}
          </p>
        ) : null}
        <button
          type="submit"
          className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Save new password
        </button>
        <Link
          href="/login"
          className="text-center text-xs text-text-muted transition-colors hover:text-text"
        >
          Back to sign in
        </Link>
      </form>
    </ShellCard>
  );
}

function ShellCard({
  eyebrow,
  title,
  body,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.07] blur-3xl"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            {eyebrow}
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-text">
            {title}
          </h1>
          <p className="mt-1 text-xs text-text-muted">{body}</p>
        </div>
        {action ? action : null}
        {children}
      </div>
    </div>
  );
}
