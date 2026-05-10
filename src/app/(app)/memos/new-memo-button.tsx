"use client";

import { useRouter } from "next/navigation";
import { useSignIn } from "@/components/sign-in-provider";
import { Button } from "@/components/ui";

export function NewMemoButton() {
  const router = useRouter();
  const { isAuthed, requireAuth, user } = useSignIn();

  function go() {
    if (!isAuthed) {
      requireAuth({
        reason: "Sign in as a Fund Manager to compose a new memo.",
      });
      return;
    }
    if (user?.role !== "fund_manager") {
      return;
    }
    router.push("/memos/new");
  }

  return (
    <Button
      onClick={go}
      iconLeft={
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      }
    >
      New memo
    </Button>
  );
}
