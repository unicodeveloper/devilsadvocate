"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutAction } from "@/lib/auth-actions";
import { useSignIn } from "./sign-in-provider";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui";
import { cn } from "./ui/cn";

type Role = "fund_manager" | "cio";

type ShellUser = {
  name?: string | null;
  email: string;
  role: Role;
} | null;

const FM_NAV = [
  { href: "/memos", label: "Memos" },
  { href: "/review", label: "Review" },
  { href: "/funds", label: "Funds" },
  { href: "/exposure", label: "Exposure" },
  { href: "/house-view", label: "House View" },
  { href: "/rules", label: "CIO Rules" },
];

const PUBLIC_NAV = [
  { href: "/memos", label: "Memos" },
  { href: "/funds", label: "Funds" },
  { href: "/house-view", label: "House View" },
];

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const navItems = user ? FM_NAV : PUBLIC_NAV;
  const pathname = usePathname() ?? "";

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link
              href="/memos"
              className="text-sm font-semibold tracking-tight text-text transition-all hover:[text-shadow:0_0_24px_var(--accent-glow)]"
            >
              Mandate
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "text-text"
                        : "text-text-muted hover:text-text",
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-3 -bottom-[13px] h-px bg-accent shadow-[var(--accent-bloom)]"
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? <SignedInBlock user={user} /> : <SignedOutBlock />}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SignedInBlock({ user }: { user: NonNullable<ShellUser> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.refresh();
    });
  }

  const initials = (user.name ?? user.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent"
      >
        {initials || "FM"}
      </span>
      <span
        className="hidden text-xs text-text-muted sm:inline"
        title={user.email}
      >
        {user.name ?? user.email.split("@")[0]}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        disabled={isPending}
        className="text-xs text-text-subtle transition-colors hover:text-text disabled:opacity-50"
      >
        {isPending ? "…" : "Sign out"}
      </button>
    </div>
  );
}

function SignedOutBlock() {
  const { requireAuth } = useSignIn();
  return (
    <Button size="sm" variant="primary" onClick={() => requireAuth()}>
      Sign in
    </Button>
  );
}

/**
 * Section header used at the top of routed pages. Builds page rhythm —
 * import and use on each surface to get title + description + actions in
 * the same relative position every time.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
