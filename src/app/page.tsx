import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  // CIOs land on /review (their primary surface); everyone else (including
  // unauthed visitors browsing read-only) lands on /memos.
  if (session?.user.role === "cio") redirect("/review");
  redirect("/memos");
}
