import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { SignInProvider, type SessionShape } from "@/components/sign-in-provider";
import { SignInModal } from "@/components/sign-in-modal";

/**
 * Defense-in-depth: every route under the (app) group renders
 * `<meta name="robots" content="noindex, nofollow, nocache">`. Combined
 * with the robots.txt disallow rules, this keeps crawlers off the
 * authenticated surfaces even if robots.txt is ignored or cached stale.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      "max-image-preview": "none",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const safeSession: SessionShape = session?.user
    ? {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name ?? null,
          role: session.user.role,
        },
      }
    : null;

  return (
    <SignInProvider session={safeSession}>
      <AppShell user={safeSession?.user ?? null}>{children}</AppShell>
      <SignInModal />
    </SignInProvider>
  );
}
