"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6 md:gap-8">
            <Link
              href="/memos"
              className="text-sm font-semibold tracking-tight text-text transition-all hover:[text-shadow:0_0_24px_var(--accent-glow)]"
            >
              Mandate
            </Link>
            {/* Desktop nav */}
            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 md:flex"
            >
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                      active ? "text-text" : "text-text-muted hover:text-text",
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
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:border-border-strong hover:text-text md:hidden"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 md:hidden"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-overlay backdrop-blur-sm overlay-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[78%] max-w-xs flex-col border-l border-border bg-surface shadow-2xl drawer-slide-in-right">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
                Navigate
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  ×
                </span>
              </button>
            </div>
            <nav
              aria-label="Mobile primary"
              className="flex-1 overflow-y-auto px-2 py-3"
            >
              <ul className="flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-surface-2 text-text"
                            : "text-text-muted hover:bg-surface-2 hover:text-text",
                        )}
                      >
                        <span>{item.label}</span>
                        {active ? (
                          <span
                            aria-hidden="true"
                            className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {user ? (
              <div className="border-t border-border px-3 py-3">
                <div
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-text-muted"
                  title={user.email}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent"
                  >
                    {(user.name ?? user.email)
                      .split(/[\s@]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0]?.toUpperCase() ?? "")
                      .join("") || "FM"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-text">
                      {user.name ?? user.email.split("@")[0]}
                    </span>
                    <span className="truncate text-[11px] text-text-subtle">
                      {user.email}
                    </span>
                  </div>
                </div>
                <MobileSignOut />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
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
    <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 sm:flex">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent"
      >
        {initials || "FM"}
      </span>
      <span
        className="hidden text-xs text-text-muted lg:inline"
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

function MobileSignOut() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          await signOutAction();
          router.refresh();
        });
      }}
      disabled={isPending}
      className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:opacity-50"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
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
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
