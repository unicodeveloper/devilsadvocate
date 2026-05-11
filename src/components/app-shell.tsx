"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/lib/auth-actions";
import { useAuthStore } from "@/app/stores/auth-store";
import { useSignIn } from "./sign-in-provider";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui";
import { cn } from "./ui/cn";

type Role = "fund_manager" | "cio";

type ShellUser = {
  name?: string | null;
  email: string;
  role: Role;
  picture?: string | null;
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
              Devil&apos;s Advocate
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
                  className="flex items-center gap-2.5 px-2 py-1.5 text-xs text-text-muted"
                  title={user.email}
                >
                  <UserAvatar user={user} size={28} />
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

function initialsFor(user: { name?: string | null; email: string }): string {
  return (
    (user.name ?? user.email)
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "FM"
  );
}

function InitialsBadge({
  initials,
  size,
}: {
  initials: string;
  size: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initials}
    </span>
  );
}

/**
 * Module-scope cache of "this URL is bad" decisions, keyed by URL string.
 * Survives component remounts so we don't re-attempt a known-broken avatar
 * (which would flash the broken-image icon every render).
 */
const knownBadAvatars = new Set<string>();

/**
 * User avatar: renders the picture URL when present and verified to load,
 * otherwise an initials badge. We preload the image with `new Image()` and
 * only commit to rendering the `<img>` in the DOM after a successful
 * `onload`. This avoids the broken-image flash that happens when an `<img>`
 * is rendered first and only falls back after the network failure — which
 * is unreliable anyway, because CSP-blocked loads sometimes never fire
 * `onerror` in Chrome.
 */
function UserAvatar({
  user,
  size,
}: {
  user: NonNullable<ShellUser>;
  size: number;
}) {
  const initials = initialsFor(user);
  const pictureUrl = user.picture ?? null;

  // Three states: "checking" (preloading), "ok" (use img), "bad" (use initials).
  // We start optimistically: if we've already proven this URL is bad in this
  // session, skip straight to "bad". Otherwise we start at "checking" and
  // render the initials badge while preloading. If preload succeeds, we swap
  // to the image; if it fails, we mark the URL bad and stay on initials.
  const initialStatus: "checking" | "ok" | "bad" =
    !pictureUrl
      ? "bad"
      : knownBadAvatars.has(pictureUrl)
        ? "bad"
        : "checking";
  const [status, setStatus] = useState<"checking" | "ok" | "bad">(initialStatus);

  useEffect(() => {
    if (!pictureUrl) {
      setStatus("bad");
      return;
    }
    if (knownBadAvatars.has(pictureUrl)) {
      setStatus("bad");
      return;
    }
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setStatus("ok");
    };
    img.onerror = () => {
      if (!cancelled) {
        knownBadAvatars.add(pictureUrl);
        setStatus("bad");
      }
    };
    img.src = pictureUrl;
    return () => {
      cancelled = true;
    };
  }, [pictureUrl]);

  if (status !== "ok" || !pictureUrl) {
    return <InitialsBadge initials={initials} size={size} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={pictureUrl}
      alt={user.name ?? user.email}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function SignedInBlock({ user }: { user: NonNullable<ShellUser> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const zustandSignOut = useAuthStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function onSignOut() {
    startTransition(async () => {
      zustandSignOut();
      await signOutAction();
      router.refresh();
    });
  }

  // Close on outside click + Escape. Both are required for a real menu —
  // a hover-only menu fails for touch + keyboard users.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayName = user.name ?? user.email.split("@")[0];

  return (
    <div ref={menuRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-muted transition-colors",
          "hover:border-border-strong hover:text-text",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
        )}
      >
        <UserAvatar user={user} size={24} />
        <span className="hidden lg:inline">{displayName}</span>
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "hidden text-text-subtle transition-transform lg:inline",
            open && "rotate-180",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 origin-top-right overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar user={user} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-text">
                  {displayName}
                </span>
                <span className="truncate text-[11px] text-text-subtle">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            disabled={isPending}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MobileSignOut() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const zustandSignOut = useAuthStore((s) => s.signOut);

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          zustandSignOut();
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
