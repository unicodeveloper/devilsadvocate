import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoById } from "@/lib/memos";
import {
  channelToNdjsonStream,
  getChannel,
  startRunDetached,
} from "@/lib/agents/run-channels";
import { fileToValyuAttachment } from "@/lib/valyu";

export const runtime = "nodejs";
export const maxDuration = 300;

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
} as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "fund_manager") {
    return NextResponse.json(
      { error: "Only Fund Managers can run stress-tests" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const memo = await getMemoById(id, { ownerId: session.user.id });
  if (!memo) {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let attachments: Awaited<ReturnType<typeof fileToValyuAttachment>>[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const fileEntries = formData.getAll("files").filter((v): v is File => v instanceof File);
    attachments = await Promise.all(
      fileEntries.map((f) =>
        fileToValyuAttachment(
          f,
          `Uploaded by analyst at memo run-time: ${f.name}`,
        ),
      ),
    );
  }

  // Detached: the orchestrator runs independently of this HTTP response.
  // The client can navigate away — agents keep working, results land in
  // the DB. Returning the channel-backed stream just gives them live
  // progress while they happen to still be connected.
  const channel = startRunDetached({
    memoId: memo.id,
    attachments,
    accessToken: session.user.accessToken,
  });

  return new Response(channelToNdjsonStream(channel), { headers: NDJSON_HEADERS });
}

/**
 * Subscribe to an in-flight run for this memo. Returns:
 *   - 200 with an NDJSON stream of buffered + future events if a run is
 *     currently in flight (or just finished and still in the grace window)
 *   - 204 if no run is in flight — the client should fall back to
 *     whatever DB-backed state was already rendered
 *
 * Used by the RunPanel on mount to detect and reconnect to a run the user
 * started before navigating away.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const memo = await getMemoById(id, { ownerId: session.user.id });
  if (!memo) {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }

  const channel = getChannel(memo.id);
  if (!channel) {
    return new Response(null, { status: 204 });
  }

  return new Response(channelToNdjsonStream(channel), { headers: NDJSON_HEADERS });
}
