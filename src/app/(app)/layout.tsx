import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { SignInProvider, type SessionShape } from "@/components/sign-in-provider";
import { SignInModal } from "@/components/sign-in-modal";

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
