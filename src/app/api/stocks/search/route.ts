import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchStocks } from "@/lib/stocks";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query } = (await req.json().catch(() => ({}))) as { query?: string };
  if (!query || query.trim().length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchStocks(query, 6);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "search failed" },
      { status: 500 },
    );
  }
}
