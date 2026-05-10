import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  // Default landing for everyone is the Memos dashboard. CIOs land on
  // /review instead since that's their primary surface.
  if (session?.user.role === "cio") redirect("/review");
  redirect("/memos");
}
