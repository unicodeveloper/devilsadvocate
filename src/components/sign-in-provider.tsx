"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Role = "fund_manager" | "cio";

export type SessionShape = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    picture?: string | null;
  };
} | null;

type SignInRequest = {
  /** Hint shown in the modal explaining what's gated. */
  reason?: string;
};

type SignInContextValue = {
  isAuthed: boolean;
  user: SessionShape extends infer S ? (S extends { user: infer U } ? U : null) | null : null;
  isOpen: boolean;
  request: SignInRequest | null;
  /** Opens the modal. If already authed, immediately resolves true. */
  requireAuth: (req?: SignInRequest) => boolean;
  /** Closes the modal. */
  close: () => void;
  /** Called by the modal after successful sign-in. */
  onSignedIn: () => void;
};

const SignInContext = createContext<SignInContextValue | null>(null);

export function useSignIn() {
  const ctx = useContext(SignInContext);
  if (!ctx) {
    throw new Error("useSignIn must be used inside SignInProvider");
  }
  return ctx;
}

export function SignInProvider({
  session,
  children,
}: {
  session: SessionShape;
  children: React.ReactNode;
}) {
  const [currentSession, setCurrentSession] = useState(session);
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState<SignInRequest | null>(null);

  // Re-sync when the layout passes a new session (after router.refresh()).
  useEffect(() => {
    setCurrentSession(session);
  }, [session]);

  const requireAuth = useCallback(
    (req?: SignInRequest): boolean => {
      if (currentSession?.user) return true;
      setRequest(req ?? null);
      setIsOpen(true);
      return false;
    },
    [currentSession],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setRequest(null);
  }, []);

  const onSignedIn = useCallback(() => {
    setIsOpen(false);
    setRequest(null);
    // The page calls router.refresh() on success which re-runs the layout
    // and feeds a new session prop — useEffect above re-syncs.
  }, []);

  const value = useMemo<SignInContextValue>(
    () => ({
      isAuthed: Boolean(currentSession?.user),
      user: currentSession?.user ?? null,
      isOpen,
      request,
      requireAuth,
      close,
      onSignedIn,
    }),
    [currentSession, isOpen, request, requireAuth, close, onSignedIn],
  );

  return (
    <SignInContext.Provider value={value}>{children}</SignInContext.Provider>
  );
}
