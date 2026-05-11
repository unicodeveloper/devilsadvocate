import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { suggestPrivatePeers } from "@/lib/suggest-private-peers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    ticker?: string;
    name?: string;
    sector?: string | null;
  };

  if (!body.ticker || !body.name) {
    return NextResponse.json(
      { error: "ticker and name are required" },
      { status: 400 },
    );
  }

  try {
    const competitors = await suggestPrivatePeers({
      ticker: body.ticker,
      name: body.name,
      sector: body.sector ?? null,
      accessToken: session.user.accessToken,
    });
    return NextResponse.json({ competitors });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "suggestion failed",
        competitors: [],
      },
      { status: 500 },
    );
  }
}
