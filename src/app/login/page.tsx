import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export const metadata = {
  title: "Sign in · Devil's Advocate",
  description:
    "Sign in to Devil's Advocate — your AI CIO. Stress-tests every investment thesis against your firm's mandate before IC.",
  alternates: { canonical: "/login" },
};

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");
  await signIn("credentials", { email, password, redirectTo: from || "/" });
}

const INPUT_CLS =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const params = await searchParams;
  const from = params.from ?? "/";
  const error = params.error;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-12">
      {/* Subtle accent glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.07] blur-3xl"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-6 w-6 rounded bg-accent shadow-[0_0_24px_var(--accent-soft)]"
          />
          <span className="text-base font-semibold tracking-tight text-text">
            Devil&apos;s Advocate
          </span>
        </div>
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            Welcome back
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-text">
            Sign in to continue
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Your AI CIO is waiting to stress-test the next thesis.
          </p>
        </div>
        <form action={loginAction} className="flex flex-col gap-4">
          <input type="hidden" name="from" value={from} />
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@firm.com"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={INPUT_CLS}
            />
          </Field>
          <a
            href="/forgot-password"
            className="-mt-2 self-end text-[11px] text-text-muted transition-colors hover:text-text"
          >
            Forgot password?
          </a>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              Invalid credentials
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}
