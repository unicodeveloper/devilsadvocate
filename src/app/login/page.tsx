import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginButton } from "./login-button";

export const metadata = {
  title: "Sign in · Devil's Advocate",
  description:
    "Sign in to Devil's Advocate — your AI CIO. Stress-tests every investment thesis against your firm's mandate before IC.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.07] blur-3xl"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-center">
          <span className="text-base font-semibold tracking-tight text-text">
            Devil&apos;s Advocate
          </span>
        </div>
        <div className="mb-6 space-y-3">
          <p className="text-lg font-semibold leading-snug tracking-tight text-text">
            Your AI Chief Investment Officer.
          </p>
          <p className="text-sm leading-6 text-text-muted">
            Every thesis goes through a multi-agent debate, gets stress-tested
            against your firm&apos;s House View, and earns a binding verdict
            — before the memo ever reaches IC. Sign in to put yours on the table.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-xs text-danger"
          >
            Sign-in failed. Please try again.
          </p>
        ) : null}

        <LoginButton />

        <p className="mt-4 text-center text-[11px] text-text-subtle">
          Don&apos;t have a Valyu account? You can create one during sign-in.
        </p>
      </div>
    </div>
  );
}
