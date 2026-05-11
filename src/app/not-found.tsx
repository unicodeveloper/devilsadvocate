import Link from "next/link";

export const metadata = {
  title: "Page not found · Devil's Advocate",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-[0.06] blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-lg">
        <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          404 · Not found
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          The page may have moved, been deleted, or never existed. Try one
          of these instead.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/memos"
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
          >
            Go to memos
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-2 px-4 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
